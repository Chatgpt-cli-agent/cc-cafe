'use client';

import { z } from 'zod';
import {
  approveStudioStage,
  createStudioProject,
  createStudioProjectId,
  sanitizeStudioSlug,
  updateStudioStage,
} from '@/lib/studio/projectFactory';
import {
  STUDIO_ASSET_TYPES,
  type CreateStudioProjectInput,
  type StudioProject,
  type StudioProjectStore,
  type StudioStageId,
} from '@/lib/studio/types';

const STORE_KEY = 'cc-cafe:create-studio-projects:v1';
const STUDIO_DIRECTORY = 'create-studio';
const PROJECTS_DIRECTORY = 'projects';
const INDEX_FILENAME = 'projects.json';
const MANIFEST_FILENAME = 'project.json';

const studioStageStatusSchema = z.enum([
  'waiting',
  'ready',
  'running',
  'needs-approval',
  'completed',
  'failed',
]);

const studioProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  prompt: z.string(),
  assetType: z.enum(['static-decor', 'tabletop-decor', 'wall-decor', 'floor-decor']),
  swatchCount: z.number().int().min(1).max(12),
  notes: z.string(),
  referenceImages: z.array(z.string()),
  status: z.enum(['ready', 'running', 'needs-approval', 'completed', 'failed']),
  stages: z.array(
    z.object({
      id: z.enum([
        'creative-direction',
        'concept-art',
        'model-generation',
        'blender-processing',
        'texturing',
        'sims-packaging',
        'quality-assurance',
        'publishing',
      ]),
      status: studioStageStatusSchema,
      message: z.string().optional(),
      startedAt: z.string().optional(),
      completedAt: z.string().optional(),
      updatedAt: z.string(),
    }),
  ),
  outputs: z.object({
    creativeBrief: z.string().optional(),
    conceptSheet: z.string().optional(),
    sourceModel: z.string().optional(),
    blenderFile: z.string().optional(),
    texturesDirectory: z.string().optional(),
    packageFile: z.string().optional(),
    thumbnail: z.string().optional(),
    validationReport: z.string().optional(),
  }),
  workspacePath: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const studioProjectStoreSchema = z.object({
  version: z.literal(1),
  projects: z.array(studioProjectSchema),
});

const PROJECT_SUBDIRECTORIES = [
  'references',
  'brief',
  'concept',
  'models/source',
  'models/processed',
  'textures',
  'sims',
  'previews',
  'reports',
  'logs',
] as const;

class CreateStudioService {
  private rootPathPromise: Promise<string> | null = null;

  async listProjects(): Promise<StudioProject[]> {
    const store = this.hasElectronBridge()
      ? await this.readElectronStore()
      : this.readBrowserStore();

    return [...store.projects].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  async createProject(input: CreateStudioProjectInput): Promise<StudioProject> {
    this.validateInput(input);

    const id = createStudioProjectId();
    const directoryName = `${sanitizeStudioSlug(input.name)}-${id.slice(0, 8)}`;

    if (!this.hasElectronBridge()) {
      const project = createStudioProject(input, {
        id,
        workspacePath: `browser-preview/${directoryName}`,
        referenceImages: input.referenceImages ?? [],
      });
      await this.saveProject(project);
      return project;
    }

    const rootPath = await this.getRootPath();
    const projectsPath = await this.joinPath(rootPath, PROJECTS_DIRECTORY);
    const workspacePath = await this.joinPath(projectsPath, directoryName);

    await this.invoke('fs:mkdir', workspacePath, { recursive: true });
    for (const relativePath of PROJECT_SUBDIRECTORIES) {
      const directoryPath = await this.joinPath(workspacePath, relativePath);
      await this.invoke('fs:mkdir', directoryPath, { recursive: true });
    }

    const copiedReferences = await this.copyReferenceImages(
      workspacePath,
      input.referenceImages ?? [],
    );

    const project = createStudioProject(input, {
      id,
      workspacePath,
      referenceImages: copiedReferences,
    });

    await this.saveProject(project);
    return project;
  }

  async selectReferenceImages(): Promise<string[]> {
    if (!this.hasElectronBridge()) return [];

    const result = await this.invoke('dialog:open', {
      title: 'Choose reference images',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp'],
        },
      ],
    });

    if (result?.canceled || !Array.isArray(result?.filePaths)) return [];
    return result.filePaths.filter((filePath: unknown): filePath is string => typeof filePath === 'string');
  }

  async generateCreativeBrief(projectId: string): Promise<StudioProject> {
    let project = await this.requireProject(projectId);
    const creativeStage = project.stages.find((stage) => stage.id === 'creative-direction');

    if (!creativeStage || creativeStage.status !== 'ready') {
      throw new Error('The Creative Director is not ready to run for this project.');
    }

    project = updateStudioStage(project, 'creative-direction', 'running', {
      message: 'Building the first production brief.',
    });
    await this.saveProject(project);

    try {
      const brief = this.buildCreativeBrief(project);
      let briefPath = 'brief/asset-brief.md';

      if (this.hasElectronBridge()) {
        briefPath = await this.joinPath(project.workspacePath, 'brief', 'asset-brief.md');
        await this.invoke('fs:writeFile', briefPath, brief);
      }

      project = {
        ...project,
        outputs: {
          ...project.outputs,
          creativeBrief: briefPath,
        },
      };
      project = updateStudioStage(project, 'creative-direction', 'needs-approval', {
        message: 'Creative brief ready for your approval.',
      });
      await this.saveProject(project);
      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to build the creative brief.';
      project = updateStudioStage(project, 'creative-direction', 'failed', { message });
      await this.saveProject(project);
      throw error;
    }
  }

  async approveStage(projectId: string, stageId: StudioStageId): Promise<StudioProject> {
    const project = await this.requireProject(projectId);
    const updatedProject = approveStudioStage(project, stageId);
    await this.saveProject(updatedProject);
    return updatedProject;
  }

  async openWorkspace(project: StudioProject): Promise<void> {
    if (!this.hasElectronBridge()) {
      throw new Error('Project folders can only be opened in the CC Café desktop app.');
    }

    const errorMessage = await this.invoke('shell:openPath', project.workspacePath);
    if (typeof errorMessage === 'string' && errorMessage.length > 0) {
      throw new Error(errorMessage);
    }
  }

  async revealOutput(outputPath: string): Promise<void> {
    if (!this.hasElectronBridge()) {
      throw new Error('Output files can only be opened in the CC Café desktop app.');
    }

    await this.invoke('shell:showItemInFolder', outputPath);
  }

  private async requireProject(projectId: string): Promise<StudioProject> {
    const project = (await this.listProjects()).find((item) => item.id === projectId);
    if (!project) throw new Error('Create Studio project not found.');
    return project;
  }

  private async saveProject(project: StudioProject): Promise<void> {
    const projects = await this.listProjects();
    const existingIndex = projects.findIndex((item) => item.id === project.id);

    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    const store: StudioProjectStore = {
      version: 1,
      projects: projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    };

    if (this.hasElectronBridge()) {
      await this.writeElectronStore(store);
      const manifestPath = await this.joinPath(project.workspacePath, MANIFEST_FILENAME);
      await this.invoke('fs:writeFile', manifestPath, JSON.stringify(project, null, 2));
    } else {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    }
  }

  private async readElectronStore(): Promise<StudioProjectStore> {
    const rootPath = await this.getRootPath();
    const indexPath = await this.joinPath(rootPath, INDEX_FILENAME);
    const exists = await this.invoke('fs:exists', indexPath);
    if (!exists) return { version: 1, projects: [] };

    try {
      const contents = await this.invoke('fs:readTextFile', indexPath);
      return this.parseStore(contents);
    } catch (error) {
      console.warn('Unable to read Create Studio project index:', error);
      return { version: 1, projects: [] };
    }
  }

  private readBrowserStore(): StudioProjectStore {
    if (typeof window === 'undefined') return { version: 1, projects: [] };

    const contents = window.localStorage.getItem(STORE_KEY);
    if (!contents) return { version: 1, projects: [] };

    try {
      return this.parseStore(contents);
    } catch (error) {
      console.warn('Unable to read browser Create Studio project index:', error);
      return { version: 1, projects: [] };
    }
  }

  private async writeElectronStore(store: StudioProjectStore): Promise<void> {
    const rootPath = await this.getRootPath();
    const indexPath = await this.joinPath(rootPath, INDEX_FILENAME);
    await this.invoke('fs:writeFile', indexPath, JSON.stringify(store, null, 2));
  }

  private parseStore(contents: string): StudioProjectStore {
    return studioProjectStoreSchema.parse(JSON.parse(contents)) as StudioProjectStore;
  }

  private async getRootPath(): Promise<string> {
    if (!this.rootPathPromise) {
      this.rootPathPromise = (async () => {
        const appDataPath = await this.invoke('path:appDataDir');
        const rootPath = await this.joinPath(appDataPath, STUDIO_DIRECTORY);
        const projectsPath = await this.joinPath(rootPath, PROJECTS_DIRECTORY);
        await this.invoke('fs:mkdir', rootPath, { recursive: true });
        await this.invoke('fs:mkdir', projectsPath, { recursive: true });
        return rootPath;
      })();
    }

    return this.rootPathPromise;
  }

  private async copyReferenceImages(workspacePath: string, sourcePaths: string[]): Promise<string[]> {
    const referencesPath = await this.joinPath(workspacePath, 'references');
    const copiedPaths: string[] = [];

    for (const [index, sourcePath] of sourcePaths.entries()) {
      const originalName = await this.invoke('path:basename', sourcePath);
      const safeName = this.sanitizeFilename(`${index + 1}-${originalName}`);
      const destinationPath = await this.joinPath(referencesPath, safeName);
      const contents = await this.invoke('fs:readFile', sourcePath);
      await this.invoke('fs:writeFile', destinationPath, contents);
      copiedPaths.push(destinationPath);
    }

    return copiedPaths;
  }

  private buildCreativeBrief(project: StudioProject): string {
    const assetType = STUDIO_ASSET_TYPES.find((item) => item.id === project.assetType);
    const references = project.referenceImages.length
      ? project.referenceImages.map((reference, index) => `${index + 1}. ${reference}`).join('\n')
      : 'No reference images were supplied.';

    return `# Asset Brief: ${project.name}

Generated by the CC Café Create Studio foundation pipeline.

## Creator request

${project.prompt}

## Asset profile

- **MVP category:** ${assetType?.label ?? project.assetType}
- **Purpose:** ${assetType?.description ?? 'Static Sims 4 Build/Buy content.'}
- **Requested swatches:** ${project.swatchCount}
- **Compatibility goal:** Base-game static decorative object
- **Animation or routing:** None in the first production version

## Reference images

${references}

## Production direction

- Preserve the main silhouette and the most recognizable details from the request.
- Keep the object readable from the normal Sims 4 camera distance.
- Build one clean primary mesh before creating lower-detail versions.
- Avoid loose floating geometry, inaccessible cavities, and details that depend on transparency unless approved.
- Keep materials separated only where the texture or swatch workflow needs them.
- Prepare the asset for deterministic Blender cleanup, UV inspection, LOD creation, collision generation, and thumbnail rendering.

## Required deliverables

1. Approved concept reference.
2. Source 3D model.
3. Cleaned Blender project with game-ready scale and orientation.
4. Texture maps and ${project.swatchCount} swatch${project.swatchCount === 1 ? '' : 'es'}.
5. Sims 4 package assembled from an approved decorative-object template.
6. Validation report and catalog thumbnail.

## Creator notes

${project.notes || 'No additional notes were supplied.'}

## Approval gate

Confirm that this brief captures the intended object, style, category, and swatch count. Approval unlocks the Concept Artist stage.
`;
  }

  private validateInput(input: CreateStudioProjectInput): void {
    if (!input.name.trim()) throw new Error('Give the project a name.');
    if (!input.prompt.trim()) throw new Error('Describe the object you want the team to create.');
    if (!STUDIO_ASSET_TYPES.some((item) => item.id === input.assetType)) {
      throw new Error('Choose a supported Create Studio asset type.');
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim();
  }

  private hasElectronBridge(): boolean {
    return typeof window !== 'undefined' && Boolean(window.electron?.ipcRenderer);
  }

  private async joinPath(...parts: string[]): Promise<string> {
    return this.invoke('path:join', ...parts);
  }

  private async invoke(channel: string, ...args: unknown[]): Promise<any> {
    if (!this.hasElectronBridge()) {
      throw new Error(`Electron bridge is unavailable for ${channel}.`);
    }

    return window.electron.ipcRenderer.invoke(channel, ...args);
  }
}

export const createStudioService = new CreateStudioService();
