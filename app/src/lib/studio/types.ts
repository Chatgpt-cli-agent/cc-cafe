export const STUDIO_ASSET_TYPES = [
  {
    id: 'static-decor',
    label: 'Static décor',
    description: 'Freestanding decorative objects without animation or routing.',
  },
  {
    id: 'tabletop-decor',
    label: 'Tabletop décor',
    description: 'Small objects designed for desks, counters, shelves, and tables.',
  },
  {
    id: 'wall-decor',
    label: 'Wall décor',
    description: 'Decorative objects intended to snap to a wall surface.',
  },
  {
    id: 'floor-decor',
    label: 'Floor décor',
    description: 'Larger static decorations placed directly on the floor.',
  },
] as const;

export type StudioAssetType = (typeof STUDIO_ASSET_TYPES)[number]['id'];

export const STUDIO_PIPELINE_DEFINITIONS = [
  {
    id: 'creative-direction',
    name: 'Creative Director',
    description: 'Turns the idea and references into a structured asset brief.',
  },
  {
    id: 'concept-art',
    name: 'Concept Artist',
    description: 'Creates consistent visual references for the model worker.',
  },
  {
    id: 'model-generation',
    name: '3D Artist',
    description: 'Generates the source mesh from the approved brief and concept.',
  },
  {
    id: 'blender-processing',
    name: 'Blender Technician',
    description: 'Repairs geometry, scale, UVs, normals, LODs, and collision meshes.',
  },
  {
    id: 'texturing',
    name: 'Texture Artist',
    description: 'Builds texture maps and the requested color swatches.',
  },
  {
    id: 'sims-packaging',
    name: 'Sims Specialist',
    description: 'Applies a Sims template and prepares the package structure.',
  },
  {
    id: 'quality-assurance',
    name: 'QA Tester',
    description: 'Validates geometry, textures, metadata, and package output.',
  },
  {
    id: 'publishing',
    name: 'Publisher',
    description: 'Creates thumbnails, records metadata, and prepares installation.',
  },
] as const;

export type StudioStageId = (typeof STUDIO_PIPELINE_DEFINITIONS)[number]['id'];

export type StudioStageStatus =
  | 'waiting'
  | 'ready'
  | 'running'
  | 'needs-approval'
  | 'completed'
  | 'failed';

export type StudioProjectStatus =
  | 'ready'
  | 'running'
  | 'needs-approval'
  | 'completed'
  | 'failed';

export interface StudioStageState {
  id: StudioStageId;
  status: StudioStageStatus;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface StudioProjectOutputs {
  creativeBrief?: string;
  conceptSheet?: string;
  sourceModel?: string;
  blenderFile?: string;
  texturesDirectory?: string;
  packageFile?: string;
  thumbnail?: string;
  validationReport?: string;
}

export interface StudioProject {
  schemaVersion: 1;
  id: string;
  name: string;
  slug: string;
  prompt: string;
  assetType: StudioAssetType;
  swatchCount: number;
  notes: string;
  referenceImages: string[];
  status: StudioProjectStatus;
  stages: StudioStageState[];
  outputs: StudioProjectOutputs;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudioProjectInput {
  name: string;
  prompt: string;
  assetType: StudioAssetType;
  swatchCount: number;
  notes?: string;
  referenceImages?: string[];
}

export interface StudioProjectStore {
  version: 1;
  projects: StudioProject[];
}
