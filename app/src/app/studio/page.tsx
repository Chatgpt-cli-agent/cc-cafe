'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Layout from '@/components/layouts/Layout';
import { useToast } from '@/context/ToastContext';
import { createStudioService } from '@/lib/services/CreateStudioService';
import { getActionableStudioStage, getStudioProgress } from '@/lib/studio/projectFactory';
import {
  STUDIO_ASSET_TYPES,
  STUDIO_PIPELINE_DEFINITIONS,
  type StudioAssetType,
  type StudioProject,
  type StudioProjectStatus,
  type StudioStageStatus,
} from '@/lib/studio/types';
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Cube,
  FileText,
  FolderOpen,
  ImageSquare,
  MagicWand,
  Plus,
  Robot,
  SpinnerGap,
  Sparkle,
  WarningCircle,
  X,
} from '@phosphor-icons/react';

interface ProjectFormState {
  name: string;
  prompt: string;
  assetType: StudioAssetType;
  swatchCount: number;
  notes: string;
  referenceImages: string[];
}

const INITIAL_FORM: ProjectFormState = {
  name: '',
  prompt: '',
  assetType: 'static-decor',
  swatchCount: 3,
  notes: '',
  referenceImages: [],
};

const STATUS_LABELS: Record<StudioProjectStatus, string> = {
  ready: 'Ready',
  running: 'Team working',
  'needs-approval': 'Needs approval',
  completed: 'Completed',
  failed: 'Needs attention',
};

const STAGE_STATUS_LABELS: Record<StudioStageStatus, string> = {
  waiting: 'Waiting',
  ready: 'Ready',
  running: 'Working',
  'needs-approval': 'Your approval',
  completed: 'Complete',
  failed: 'Failed',
};

function projectStatusStyles(status: StudioProjectStatus) {
  switch (status) {
    case 'running':
      return { backgroundColor: 'rgba(93, 188, 255, 0.14)', color: '#8fd1ff' };
    case 'needs-approval':
      return { backgroundColor: 'rgba(255, 193, 74, 0.16)', color: '#ffd16f' };
    case 'completed':
      return { backgroundColor: 'rgba(70, 200, 155, 0.16)', color: '#72efc4' };
    case 'failed':
      return { backgroundColor: 'rgba(255, 104, 104, 0.16)', color: '#ff9b9b' };
    default:
      return { backgroundColor: 'rgba(255, 255, 255, 0.07)', color: 'var(--text-secondary)' };
  }
}

function StageStatusIcon({ status }: { status: StudioStageStatus }) {
  if (status === 'completed') return <CheckCircle size={21} weight="fill" color="#72efc4" />;
  if (status === 'running') return <SpinnerGap size={21} className="animate-spin" color="#8fd1ff" />;
  if (status === 'needs-approval') return <WarningCircle size={21} weight="fill" color="#ffd16f" />;
  if (status === 'failed') return <WarningCircle size={21} weight="fill" color="#ff9b9b" />;
  if (status === 'ready') return <Sparkle size={21} weight="fill" color="#7cf262" />;
  return <Clock size={21} color="var(--text-secondary)" />;
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;
}

function formatProjectDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function CreateStudioPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState<ProjectFormState>(INITIAL_FORM);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedStage = selectedProject ? getActionableStudioStage(selectedProject) : null;

  useEffect(() => {
    void loadProjects();
  }, []);

  async function loadProjects(preferredProjectId?: string) {
    try {
      const loadedProjects = await createStudioService.listProjects();
      setProjects(loadedProjects);
      setSelectedProjectId((currentId) => {
        if (preferredProjectId && loadedProjects.some((project) => project.id === preferredProjectId)) {
          return preferredProjectId;
        }
        if (currentId && loadedProjects.some((project) => project.id === currentId)) {
          return currentId;
        }
        return loadedProjects[0]?.id ?? null;
      });
    } catch (error) {
      showError('Unable to load Create Studio', error);
    } finally {
      setLoading(false);
    }
  }

  function replaceProject(updatedProject: StudioProject) {
    setProjects((currentProjects) =>
      currentProjects
        .map((project) => (project.id === updatedProject.id ? updatedProject : project))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
    setSelectedProjectId(updatedProject.id);
  }

  async function handleChooseReferences() {
    try {
      const selectedPaths = await createStudioService.selectReferenceImages();
      if (selectedPaths.length === 0) {
        showToast({
          type: 'info',
          title: 'No images selected',
          message: 'Reference-image selection is available in the CC Café desktop app.',
          duration: 3000,
        });
        return;
      }

      setForm((current) => ({
        ...current,
        referenceImages: Array.from(new Set([...current.referenceImages, ...selectedPaths])),
      }));
    } catch (error) {
      showError('Unable to choose references', error);
    }
  }

  function removeReference(referencePath: string) {
    setForm((current) => ({
      ...current,
      referenceImages: current.referenceImages.filter((item) => item !== referencePath),
    }));
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;

    setCreating(true);
    try {
      const project = await createStudioService.createProject(form);
      setForm(INITIAL_FORM);
      await loadProjects(project.id);
      showToast({
        type: 'success',
        title: 'Studio project created',
        message: `${project.name} has a workspace and a waiting AI team.`,
        duration: 3500,
      });
    } catch (error) {
      showError('Unable to create project', error);
    } finally {
      setCreating(false);
    }
  }

  async function handleBuildBrief() {
    if (!selectedProject || busyAction) return;

    setBusyAction('creative-direction');
    try {
      const updatedProject = await createStudioService.generateCreativeBrief(selectedProject.id);
      replaceProject(updatedProject);
      showToast({
        type: 'success',
        title: 'Creative brief is ready',
        message: 'Review the brief and approve it to unlock the Concept Artist.',
        duration: 3500,
      });
    } catch (error) {
      await loadProjects(selectedProject.id);
      showError('Creative Director failed', error);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApproveBrief() {
    if (!selectedProject || busyAction) return;

    setBusyAction('approve-creative-direction');
    try {
      const updatedProject = await createStudioService.approveStage(
        selectedProject.id,
        'creative-direction',
      );
      replaceProject(updatedProject);
      showToast({
        type: 'success',
        title: 'Brief approved',
        message: 'The Concept Artist is now ready for the next integration step.',
        duration: 3500,
      });
    } catch (error) {
      showError('Unable to approve brief', error);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleOpenWorkspace() {
    if (!selectedProject) return;

    try {
      await createStudioService.openWorkspace(selectedProject);
    } catch (error) {
      showError('Unable to open workspace', error);
    }
  }

  async function handleRevealBrief() {
    const briefPath = selectedProject?.outputs.creativeBrief;
    if (!briefPath) return;

    try {
      await createStudioService.revealOutput(briefPath);
    } catch (error) {
      showError('Unable to reveal creative brief', error);
    }
  }

  function showError(title: string, error: unknown) {
    showToast({
      type: 'error',
      title,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      duration: 4000,
    });
  }

  return (
    <Layout>
      <main
        className="min-w-0 flex-1 overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="h-full overflow-y-auto px-5 py-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: '#7cf262' }}>
                <Sparkle size={17} weight="fill" />
                CC creation workspace
              </div>
              <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Create Studio
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                Describe a Sims 4 object, add references, and guide a structured AI production team from
                creative brief to a validated package.
              </p>
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]"
              style={{
                borderColor: 'rgba(124, 242, 98, 0.28)',
                backgroundColor: 'rgba(124, 242, 98, 0.09)',
                color: '#a8ff93',
              }}
            >
              <Robot size={17} weight="fill" />
              Foundation online
            </div>
          </header>

          <section
            className="mb-6 overflow-hidden rounded-[24px] border px-6 py-6 lg:px-8"
            style={{
              borderColor: 'rgba(124, 242, 98, 0.2)',
              background:
                'radial-gradient(circle at top right, rgba(124, 242, 98, 0.16), transparent 36%), var(--ui-panel)',
            }}
          >
            <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  Your AI CC team starts with a real project workspace.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  This first build creates persistent project folders, copies your references, tracks every
                  specialist, writes a production manifest, and gives the Creative Director an approval gate.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Static décor MVP', 'Local project files', 'Eight-stage pipeline', 'Approval checkpoints'].map(
                    (label) => (
                      <span
                        key={label}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
                      >
                        {label}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <div
                className="flex h-24 w-24 items-center justify-center rounded-[28px]"
                style={{ backgroundColor: 'rgba(124, 242, 98, 0.12)', color: '#7cf262' }}
              >
                <MagicWand size={48} weight="duotone" />
              </div>
            </div>
          </section>

          <div className="grid gap-6 2xl:grid-cols-[minmax(520px,0.9fr)_minmax(620px,1.1fr)]">
            <div className="space-y-6">
              <section
                className="rounded-[20px] border p-5 lg:p-6"
                style={{ backgroundColor: 'var(--ui-panel)', borderColor: 'var(--border-color)' }}
              >
                <div className="mb-5 flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'rgba(124, 242, 98, 0.1)', color: '#7cf262' }}
                  >
                    <Plus size={24} weight="bold" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      Start a new object
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Static Build/Buy décor is the safe first production category.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateProject} className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Project name
                    </span>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Pumpkin table decoration"
                      className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      What should the team create?
                    </span>
                    <textarea
                      value={form.prompt}
                      onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                      placeholder="A cute pumpkin-shaped decoration with carved star details, rounded proportions, and a cozy handcrafted look."
                      rows={5}
                      className="w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6 outline-none transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </label>

                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Object type
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {STUDIO_ASSET_TYPES.map((assetType) => {
                        const selected = form.assetType === assetType.id;
                        return (
                          <button
                            key={assetType.id}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, assetType: assetType.id }))}
                            className="rounded-xl border p-3 text-left transition-colors"
                            style={{
                              borderColor: selected ? '#7cf262' : 'var(--border-color)',
                              backgroundColor: selected ? 'rgba(124, 242, 98, 0.08)' : 'var(--bg-primary)',
                            }}
                          >
                            <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                              {assetType.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                              {assetType.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Swatches
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={form.swatchCount}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            swatchCount: Number.parseInt(event.target.value, 10) || 1,
                          }))
                        }
                        className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Extra notes
                      </span>
                      <input
                        value={form.notes}
                        onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Color ideas, proportions, or details to avoid"
                        className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Reference images
                      </span>
                      <button
                        type="button"
                        onClick={handleChooseReferences}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
                      >
                        <ImageSquare size={16} />
                        Choose images
                      </button>
                    </div>

                    <div
                      className="min-h-20 rounded-xl border border-dashed p-3"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
                    >
                      {form.referenceImages.length === 0 ? (
                        <div className="flex min-h-14 items-center justify-center text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Optional PNG, JPG, or WebP references will be copied into the project workspace.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {form.referenceImages.map((referencePath) => (
                            <div
                              key={referencePath}
                              className="flex items-center gap-2 rounded-lg px-3 py-2"
                              style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                            >
                              <ImageSquare size={17} color="#7cf262" />
                              <span className="min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {basename(referencePath)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeReference(referencePath)}
                                aria-label={`Remove ${basename(referencePath)}`}
                                className="rounded-md p-1"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-black transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: '#7cf262', color: '#101410' }}
                  >
                    {creating ? <SpinnerGap size={20} className="animate-spin" /> : <MagicWand size={20} weight="bold" />}
                    {creating ? 'Creating workspace…' : 'Create project and assemble team'}
                  </button>
                </form>
              </section>

              <section
                className="rounded-[20px] border p-5 lg:p-6"
                style={{ backgroundColor: 'var(--ui-panel)', borderColor: 'var(--border-color)' }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      Studio projects
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Every project is resumable and stored outside the Mods folder.
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
                  >
                    {projects.length}
                  </span>
                </div>

                {loading ? (
                  <div className="flex min-h-32 items-center justify-center">
                    <SpinnerGap size={28} className="animate-spin" color="#7cf262" />
                  </div>
                ) : projects.length === 0 ? (
                  <div
                    className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                  >
                    <Cube size={34} className="mb-3" />
                    <p className="text-sm font-semibold">Your first CC project will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projects.map((project) => {
                      const selected = project.id === selectedProjectId;
                      const progress = getStudioProgress(project);
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => setSelectedProjectId(project.id)}
                          className="w-full rounded-xl border p-4 text-left transition-colors"
                          style={{
                            borderColor: selected ? '#7cf262' : 'var(--border-color)',
                            backgroundColor: selected ? 'rgba(124, 242, 98, 0.07)' : 'var(--bg-primary)',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl"
                              style={{ backgroundColor: 'rgba(124, 242, 98, 0.1)', color: '#7cf262' }}
                            >
                              <Cube size={22} weight="duotone" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                  {project.name}
                                </h3>
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                                  style={projectStatusStyles(project.status)}
                                >
                                  {STATUS_LABELS[project.status]}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                                {project.prompt}
                              </p>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: '#7cf262' }} />
                                </div>
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                  {progress}%
                                </span>
                              </div>
                              <p className="mt-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                Updated {formatProjectDate(project.updatedAt)}
                              </p>
                            </div>
                            <ArrowRight size={18} color={selected ? '#7cf262' : 'var(--text-secondary)'} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <section
              className="min-h-[680px] rounded-[20px] border p-5 lg:p-6"
              style={{ backgroundColor: 'var(--ui-panel)', borderColor: 'var(--border-color)' }}
            >
              {!selectedProject ? (
                <div className="flex h-full min-h-[620px] flex-col items-center justify-center text-center">
                  <div
                    className="mb-4 flex h-20 w-20 items-center justify-center rounded-[24px]"
                    style={{ backgroundColor: 'rgba(124, 242, 98, 0.1)', color: '#7cf262' }}
                  >
                    <Robot size={42} weight="duotone" />
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    The team is waiting
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                    Create or select a project to see the eight specialists, their status, and each approval gate.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                          {selectedProject.name}
                        </h2>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                          style={projectStatusStyles(selectedProject.status)}
                        >
                          {STATUS_LABELS[selectedProject.status]}
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                        {selectedProject.prompt}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenWorkspace}
                      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      <FolderOpen size={17} />
                      Open workspace
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
                        Asset type
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {STUDIO_ASSET_TYPES.find((item) => item.id === selectedProject.assetType)?.label}
                      </p>
                    </div>
                    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
                        Swatches
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {selectedProject.swatchCount}
                      </p>
                    </div>
                    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
                        References
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {selectedProject.referenceImages.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
                        Production progress
                      </span>
                      <span className="text-xs font-bold" style={{ color: '#7cf262' }}>
                        {getStudioProgress(selectedProject)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${getStudioProgress(selectedProject)}%`, backgroundColor: '#7cf262' }}
                      />
                    </div>
                  </div>

                  {selectedProject.outputs.creativeBrief && (
                    <div
                      className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                      style={{ borderColor: 'rgba(124, 242, 98, 0.22)', backgroundColor: 'rgba(124, 242, 98, 0.06)' }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText size={24} color="#7cf262" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            Creative brief
                          </p>
                          <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {basename(selectedProject.outputs.creativeBrief)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRevealBrief}
                        className="rounded-full px-3 py-1.5 text-xs font-bold"
                        style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}
                      >
                        Show file
                      </button>
                    </div>
                  )}

                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                          AI production team
                        </h3>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Each worker receives structured files from the worker before it.
                        </p>
                      </div>
                      {selectedStage && (
                        <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                          Current: {STUDIO_PIPELINE_DEFINITIONS.find((item) => item.id === selectedStage.id)?.name}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {STUDIO_PIPELINE_DEFINITIONS.map((definition, index) => {
                        const stage = selectedProject.stages.find((item) => item.id === definition.id);
                        if (!stage) return null;

                        const isCreativeDirector = definition.id === 'creative-direction';
                        const canRunCreativeDirector = isCreativeDirector && stage.status === 'ready';
                        const canApproveCreativeDirector = isCreativeDirector && stage.status === 'needs-approval';
                        const isBusy = busyAction !== null &&
                          (busyAction === definition.id || busyAction === `approve-${definition.id}`);

                        return (
                          <div
                            key={definition.id}
                            className="rounded-xl border p-4"
                            style={{
                              borderColor: stage.status === 'ready' || stage.status === 'needs-approval'
                                ? 'rgba(124, 242, 98, 0.24)'
                                : 'var(--border-color)',
                              backgroundColor: stage.status === 'ready' || stage.status === 'needs-approval'
                                ? 'rgba(124, 242, 98, 0.045)'
                                : 'var(--bg-primary)',
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="pt-0.5">
                                <StageStatusIcon status={stage.status} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {definition.name}
                                  </h4>
                                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                                    {STAGE_STATUS_LABELS[stage.status]}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
                                  {stage.message || definition.description}
                                </p>

                                {canRunCreativeDirector && (
                                  <button
                                    type="button"
                                    onClick={handleBuildBrief}
                                    disabled={Boolean(busyAction)}
                                    className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black disabled:opacity-60"
                                    style={{ backgroundColor: '#7cf262', color: '#101410' }}
                                  >
                                    {isBusy ? <SpinnerGap size={16} className="animate-spin" /> : <MagicWand size={16} weight="bold" />}
                                    Build creative brief
                                  </button>
                                )}

                                {canApproveCreativeDirector && (
                                  <button
                                    type="button"
                                    onClick={handleApproveBrief}
                                    disabled={Boolean(busyAction)}
                                    className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black disabled:opacity-60"
                                    style={{ backgroundColor: '#ffd16f', color: '#211b0e' }}
                                  >
                                    {isBusy ? <SpinnerGap size={16} className="animate-spin" /> : <CheckCircle size={16} weight="bold" />}
                                    Approve brief
                                  </button>
                                )}

                                {!isCreativeDirector && stage.status === 'ready' && (
                                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <Clock size={15} />
                                    Worker integration is the next build step
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
}
