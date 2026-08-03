import {
  STUDIO_PIPELINE_DEFINITIONS,
  type CreateStudioProjectInput,
  type StudioProject,
  type StudioProjectStatus,
  type StudioStageId,
  type StudioStageStatus,
} from './types';

const MAX_SLUG_LENGTH = 64;

export function createStudioProjectId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeStudioSlug(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  return normalized || 'untitled-asset';
}

export function createStudioProject(
  input: CreateStudioProjectInput,
  options: {
    id?: string;
    workspacePath: string;
    referenceImages?: string[];
    now?: Date;
  },
): StudioProject {
  const now = options.now ?? new Date();
  const timestamp = now.toISOString();
  const name = input.name.trim() || 'Untitled asset';
  const referenceImages = Array.from(
    new Set((options.referenceImages ?? input.referenceImages ?? []).map((item) => item.trim()).filter(Boolean)),
  );

  return {
    schemaVersion: 1,
    id: options.id ?? createStudioProjectId(),
    name,
    slug: sanitizeStudioSlug(name),
    prompt: input.prompt.trim(),
    assetType: input.assetType,
    swatchCount: clampSwatchCount(input.swatchCount),
    notes: input.notes?.trim() ?? '',
    referenceImages,
    status: 'ready',
    stages: STUDIO_PIPELINE_DEFINITIONS.map((definition, index) => ({
      id: definition.id,
      status: index === 0 ? 'ready' : 'waiting',
      updatedAt: timestamp,
    })),
    outputs: {},
    workspacePath: options.workspacePath,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function deriveStudioProjectStatus(project: StudioProject): StudioProjectStatus {
  if (project.stages.every((stage) => stage.status === 'completed')) {
    return 'completed';
  }

  if (project.stages.some((stage) => stage.status === 'failed')) {
    return 'failed';
  }

  if (project.stages.some((stage) => stage.status === 'needs-approval')) {
    return 'needs-approval';
  }

  if (project.stages.some((stage) => stage.status === 'running')) {
    return 'running';
  }

  return 'ready';
}

export function updateStudioStage(
  project: StudioProject,
  stageId: StudioStageId,
  status: StudioStageStatus,
  options: { message?: string; now?: Date } = {},
): StudioProject {
  const timestamp = (options.now ?? new Date()).toISOString();
  let found = false;

  const stages = project.stages.map((stage) => {
    if (stage.id !== stageId) return stage;
    found = true;

    return {
      ...stage,
      status,
      message: options.message,
      startedAt: status === 'running' ? stage.startedAt ?? timestamp : stage.startedAt,
      completedAt: status === 'completed' ? timestamp : undefined,
      updatedAt: timestamp,
    };
  });

  if (!found) {
    throw new Error(`Unknown Create Studio stage: ${stageId}`);
  }

  const nextProject: StudioProject = {
    ...project,
    stages,
    updatedAt: timestamp,
  };

  return {
    ...nextProject,
    status: deriveStudioProjectStatus(nextProject),
  };
}

export function approveStudioStage(
  project: StudioProject,
  stageId: StudioStageId,
  now: Date = new Date(),
): StudioProject {
  const stageIndex = project.stages.findIndex((stage) => stage.id === stageId);
  if (stageIndex < 0) {
    throw new Error(`Unknown Create Studio stage: ${stageId}`);
  }

  if (project.stages[stageIndex].status !== 'needs-approval') {
    throw new Error('Only a stage waiting for approval can be approved.');
  }

  const timestamp = now.toISOString();
  const stages = project.stages.map((stage, index) => {
    if (index === stageIndex) {
      return {
        ...stage,
        status: 'completed' as const,
        message: 'Approved',
        completedAt: timestamp,
        updatedAt: timestamp,
      };
    }

    if (index === stageIndex + 1 && stage.status === 'waiting') {
      return {
        ...stage,
        status: 'ready' as const,
        message: 'Ready to begin',
        updatedAt: timestamp,
      };
    }

    return stage;
  });

  const nextProject: StudioProject = {
    ...project,
    stages,
    updatedAt: timestamp,
  };

  return {
    ...nextProject,
    status: deriveStudioProjectStatus(nextProject),
  };
}

export function getStudioProgress(project: StudioProject): number {
  if (project.stages.length === 0) return 0;
  const completed = project.stages.filter((stage) => stage.status === 'completed').length;
  return Math.round((completed / project.stages.length) * 100);
}

export function getActionableStudioStage(project: StudioProject) {
  return (
    project.stages.find((stage) => stage.status === 'running') ??
    project.stages.find((stage) => stage.status === 'needs-approval') ??
    project.stages.find((stage) => stage.status === 'ready') ??
    null
  );
}

function clampSwatchCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(12, Math.max(1, Math.round(value)));
}
