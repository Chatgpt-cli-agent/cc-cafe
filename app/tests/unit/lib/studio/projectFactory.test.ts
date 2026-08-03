import { describe, expect, it } from 'vitest';
import {
  approveStudioStage,
  createStudioProject,
  deriveStudioProjectStatus,
  getActionableStudioStage,
  getStudioProgress,
  sanitizeStudioSlug,
  updateStudioStage,
} from '@/lib/studio/projectFactory';

const fixedNow = new Date('2026-08-03T12:00:00.000Z');

function makeProject(swatchCount = 3) {
  return createStudioProject(
    {
      name: 'Pumpkin Table Décor',
      prompt: 'Create a rounded pumpkin decoration with carved star details.',
      assetType: 'tabletop-decor',
      swatchCount,
      notes: 'Keep the silhouette soft and readable.',
    },
    {
      id: 'studio-project-1',
      workspacePath: '/tmp/create-studio/pumpkin-table-decor',
      referenceImages: ['/tmp/pumpkin.png', '/tmp/pumpkin.png'],
      now: fixedNow,
    },
  );
}

describe('sanitizeStudioSlug', () => {
  it('creates a stable filesystem-friendly slug', () => {
    expect(sanitizeStudioSlug('  Pumpkin Table Décor!  ')).toBe('pumpkin-table-decor');
    expect(sanitizeStudioSlug('***')).toBe('untitled-asset');
  });

  it('limits long slugs without leaving a trailing separator', () => {
    const slug = sanitizeStudioSlug(`${'a'.repeat(70)} extra`);
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('createStudioProject', () => {
  it('creates the eight-stage pipeline with only the Creative Director ready', () => {
    const project = makeProject();

    expect(project.schemaVersion).toBe(1);
    expect(project.slug).toBe('pumpkin-table-decor');
    expect(project.status).toBe('ready');
    expect(project.stages).toHaveLength(8);
    expect(project.stages[0]).toMatchObject({
      id: 'creative-direction',
      status: 'ready',
    });
    expect(project.stages.slice(1).every((stage) => stage.status === 'waiting')).toBe(true);
    expect(project.referenceImages).toEqual(['/tmp/pumpkin.png']);
  });

  it('clamps swatch counts to the supported range', () => {
    expect(makeProject(0).swatchCount).toBe(1);
    expect(makeProject(99).swatchCount).toBe(12);
  });
});

describe('studio stage transitions', () => {
  it('tracks running and approval states at the project level', () => {
    let project = makeProject();

    project = updateStudioStage(project, 'creative-direction', 'running', {
      message: 'Writing brief',
      now: new Date('2026-08-03T12:01:00.000Z'),
    });
    expect(project.status).toBe('running');
    expect(project.stages[0].startedAt).toBe('2026-08-03T12:01:00.000Z');

    project = updateStudioStage(project, 'creative-direction', 'needs-approval', {
      message: 'Brief ready',
      now: new Date('2026-08-03T12:02:00.000Z'),
    });
    expect(project.status).toBe('needs-approval');
    expect(getActionableStudioStage(project)?.id).toBe('creative-direction');
  });

  it('completes an approved stage and unlocks the next worker', () => {
    let project = makeProject();
    project = updateStudioStage(project, 'creative-direction', 'needs-approval', {
      now: new Date('2026-08-03T12:02:00.000Z'),
    });
    project = approveStudioStage(
      project,
      'creative-direction',
      new Date('2026-08-03T12:03:00.000Z'),
    );

    expect(project.stages[0]).toMatchObject({
      status: 'completed',
      message: 'Approved',
      completedAt: '2026-08-03T12:03:00.000Z',
    });
    expect(project.stages[1]).toMatchObject({
      id: 'concept-art',
      status: 'ready',
    });
    expect(project.status).toBe('ready');
    expect(getStudioProgress(project)).toBe(13);
    expect(getActionableStudioStage(project)?.id).toBe('concept-art');
  });

  it('rejects approval when a stage is not waiting for approval', () => {
    expect(() => approveStudioStage(makeProject(), 'creative-direction')).toThrow(
      'Only a stage waiting for approval can be approved.',
    );
  });

  it('derives failed and completed project states', () => {
    const failed = updateStudioStage(makeProject(), 'creative-direction', 'failed');
    expect(deriveStudioProjectStatus(failed)).toBe('failed');

    const completed = {
      ...makeProject(),
      stages: makeProject().stages.map((stage) => ({ ...stage, status: 'completed' as const })),
    };
    expect(deriveStudioProjectStatus(completed)).toBe('completed');
    expect(getStudioProgress(completed)).toBe(100);
  });
});
