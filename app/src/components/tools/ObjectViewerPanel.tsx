'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useToast } from '@/context/ToastContext';
import {
  s4mmToolsService,
  type CasItemsResult,
  type BodyPartMesh,
  type CasSwatchInfo,
  type ClipDetail,
  type ClipSummary,
  type ModelChunk,
} from '@/lib/services/S4mmToolsService';
import { sims4PathDetector } from '@/lib/services/Sims4PathDetector';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

function chunksToGeometry(chunks: ModelChunk[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const chunk of chunks) {
    for (const vertex of chunk.vertex) {
      const position = vertex.p ?? [vertex.x ?? 0, vertex.y ?? 0, vertex.z ?? 0];
      const uv = Array.isArray(vertex.u) ? vertex.u : [vertex.u ?? 0, vertex.v ?? 0];
      positions.push(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
      uvs.push(uv[0] ?? 0, 1 - (uv[1] ?? 0));
    }
    for (const face of chunk.faces) {
      indices.push(face[0] + vertexOffset, face[1] + vertexOffset, face[2] + vertexOffset);
    }
    vertexOffset += chunk.vertex.length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvs.some((value) => value !== 0)) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.center();
  return geometry;
}

type BodyGender = 'woman' | 'man';

function skinnedChunkGeometry(chunk: ModelChunk, hashToIndex: Map<number, number>): THREE.BufferGeometry | null {
  const boneHashes = chunk.boneHashes;
  if (!boneHashes || boneHashes.length === 0 || chunk.vertex.length === 0) return null;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const skinIndex = new Uint16Array(chunk.vertex.length * 4);
  const skinWeight = new Float32Array(chunk.vertex.length * 4);
  const boneIndex = boneHashes.map((hash) => hashToIndex.get(hash) ?? -1);

  chunk.vertex.forEach((vertex, index) => {
    const position = vertex.p ?? [vertex.x ?? 0, vertex.y ?? 0, vertex.z ?? 0];
    const normal = vertex.n;
    const uv = Array.isArray(vertex.u) ? vertex.u : [0, 0];
    positions.push(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
    if (normal) normals.push(normal[0] ?? 0, normal[1] ?? 0, normal[2] ?? 0);
    uvs.push(uv[0] ?? 0, 1 - (uv[1] ?? 0));

    const blend = vertex.b ?? [0, 0, 0, 0];
    const weight = vertex.w ?? [1, 0, 0, 0];
    let total = 0;
    for (let slot = 0; slot < 4; slot += 1) {
      const mapped = boneIndex[blend[slot] ?? 0] ?? -1;
      const value = mapped < 0 ? 0 : weight[slot] || 0;
      skinIndex[index * 4 + slot] = Math.max(mapped, 0);
      skinWeight[index * 4 + slot] = value;
      total += value;
    }
    if (total > 0) {
      for (let slot = 0; slot < 4; slot += 1) skinWeight[index * 4 + slot] /= total;
    } else {
      skinIndex[index * 4] = 0;
      skinWeight[index * 4] = 1;
    }
  });

  for (const face of chunk.faces) {
    indices.push(face[0], face[1], face[2]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(indices);
  return geometry;
}

function buildClipFigure(
  detail: ClipDetail,
  parts: BodyPartMesh[],
  gender: BodyGender
): { root: THREE.Group; mixer: THREE.AnimationMixer } | null {
  if (!detail.rig) return null;

  const root = new THREE.Group();
  const bones: THREE.Bone[] = [];
  const byHash = new Map<number, THREE.Bone>();
  const hashToIndex = new Map<number, number>();
  detail.rig.bones.forEach((bone, index) => {
    const node = new THREE.Bone();
    node.name = bone.name;
    node.position.fromArray(bone.position);
    node.quaternion.fromArray(bone.orientation);
    node.scale.fromArray(bone.scale);
    bones.push(node);
    byHash.set(bone.hash, node);
    hashToIndex.set(bone.hash, index);
  });
  detail.rig.bones.forEach((bone, index) => {
    if (bone.parent >= 0 && bones[bone.parent]) bones[bone.parent].add(bones[index]);
    else root.add(bones[index]);
  });
  root.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton(bones);
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  const material = new THREE.MeshStandardMaterial({ color: 0xd7b79e, roughness: 0.72, metalness: 0.02, side: THREE.DoubleSide });
  const prefix = `${gender}_adult_`;
  let meshCount = 0;
  for (const part of parts) {
    if (!part.name.startsWith(prefix) && part.name !== 'teeth_adult') continue;
    for (const chunk of part.chunks) {
      const geometry = skinnedChunkGeometry(chunk, hashToIndex);
      if (!geometry) continue;
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.name = part.name;
      body.add(mesh);
      mesh.bind(skeleton, mesh.matrixWorld);
      meshCount += 1;
    }
  }
  if (meshCount === 0) {
    material.dispose();
    return null;
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const frameDuration = detail.clip.frameDuration || 1 / 30;
  for (const track of detail.clip.tracks) {
    const bone = byHash.get(track.key);
    if (!bone) continue;
    if (track.orientation && track.orientation.length > 0) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${bone.uuid}.quaternion`,
          track.orientation.map((frame) => frame.frame * frameDuration),
          track.orientation.flatMap((frame) => frame.values)
        )
      );
    }
    if (track.position && track.position.length > 0) {
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${bone.uuid}.position`,
          track.position.map((frame) => frame.frame * frameDuration),
          track.position.flatMap((frame) => frame.values)
        )
      );
    }
  }

  const animation = new THREE.AnimationClip(
    detail.clip.clipName || 'clip',
    detail.clip.duration > 0 ? detail.clip.duration : -1,
    tracks
  );
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(animation);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  action.paused = Boolean(detail.clip.isPose);
  mixer.update(0);
  root.updateMatrixWorld(true);
  return { root, mixer };
}

export default function ObjectViewerPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [items, setItems] = useState<CasItemsResult | null>(null);
  const [clips, setClips] = useState<ClipSummary[]>([]);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [bodyGender, setBodyGender] = useState<BodyGender>('woman');
  const [selectedSwatch, setSelectedSwatch] = useState<CasSwatchInfo | null>(null);
  const [selectedLod, setSelectedLod] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  const [useTexture, setUseTexture] = useState(true);

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    mesh: THREE.Mesh | null;
    clipRoot: THREE.Group | null;
    disposed: boolean;
  } | null>(null);
  const clipTickRef = useRef<((delta: number) => void) | null>(null);
  const clockRef = useRef(new THREE.Clock());

  // Set up the three.js scene once.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 640;
    const height = 420;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
    camera.position.set(0, 0.2, 1.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const directional = new THREE.DirectionalLight(0xffffff, 1.4);
    directional.position.set(1, 2, 2);
    scene.add(directional);

    const state = {
      renderer,
      scene,
      camera,
      controls,
      mesh: null as THREE.Mesh | null,
      clipRoot: null as THREE.Group | null,
      disposed: false,
    };
    sceneRef.current = state;

    const animate = () => {
      if (state.disposed) return;
      requestAnimationFrame(animate);
      clipTickRef.current?.(clockRef.current.getDelta());
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      state.disposed = true;
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
    };
  }, []);

  const showModel = useCallback(
    async (swatch: CasSwatchInfo, lodIndex: number, applyTexture: boolean, asWireframe: boolean) => {
      const state = sceneRef.current;
      if (!state || !filePath) return;

      const lod = swatch.lodLevels[lodIndex] ?? swatch.lodLevels[0];
      if (!lod || lod.list.length === 0) {
        showToast({
          type: 'warning',
          title: 'No mesh',
          message: 'This swatch has no LOD meshes to display (it may be a recolor).',
          duration: 3000,
        });
        return;
      }

      setLoading(true);
      try {
        const result = await s4mmToolsService.getModels(filePath, lod.list);
        if (result.models.length === 0) {
          showToast({
            type: 'warning',
            title: 'Mesh not found',
            message: 'The mesh lives in another package (recolor); rendering is not available.',
            duration: 3500,
          });
          return;
        }

        const chunks = result.models.flatMap((model) => model.data);
        const geometry = chunksToGeometry(chunks);

        let material: THREE.Material;
        if (asWireframe) {
          material = new THREE.MeshBasicMaterial({ color: 0x7cf262, wireframe: true });
        } else {
          const standard = new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
          if (applyTexture && swatch.diffuseAddress) {
            try {
              const address =
                typeof swatch.diffuseAddress === 'string'
                  ? swatch.diffuseAddress
                  : (swatch.diffuseAddress.key ?? '');
              if (address) {
                const texture = await s4mmToolsService.getTexture(filePath, address);
                if (texture.dataUrl) {
                  const loaded = await new THREE.TextureLoader().loadAsync(texture.dataUrl);
                  loaded.flipY = false;
                  standard.map = loaded;
                  standard.color = new THREE.Color(0xffffff);
                }
              }
            } catch {
              // Texture is optional; render untextured on failure.
            }
          }
          material = standard;
        }

        clearClip();
        if (state.mesh) {
          state.scene.remove(state.mesh);
          state.mesh.geometry.dispose();
        }
        const mesh = new THREE.Mesh(geometry, material);
        state.scene.add(mesh);
        state.mesh = mesh;

        // Frame the mesh.
        geometry.computeBoundingSphere();
        const radius = geometry.boundingSphere?.radius ?? 1;
        state.camera.position.set(0, radius * 0.2, radius * 2.6);
        state.controls.target.set(0, 0, 0);
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Failed to load model',
          message: error?.message || 'Unable to load mesh data.',
          duration: 3500,
        });
      } finally {
        setLoading(false);
      }
    },
    [filePath, showToast]
  );

  useEffect(() => {
    if (selectedSwatch) {
      void showModel(selectedSwatch, selectedLod, useTexture, wireframe);
    }
  }, [selectedSwatch, selectedLod, useTexture, wireframe, showModel]);

  function clearClip() {
    clipTickRef.current = null;
    const state = sceneRef.current;
    if (!state?.clipRoot) return;
    state.scene.remove(state.clipRoot);
    state.clipRoot.traverse((child) => {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
      else mesh.material?.dispose();
    });
    state.clipRoot = null;
  }

  async function showClip(clip: ClipSummary, packagePath: string | null = filePath, gender: BodyGender = bodyGender) {
    if (!packagePath) return;
    setSelectedClip(clip.address);
    setSelectedSwatch(null);
    setLoading(true);
    try {
      const paths = await sims4PathDetector.getPaths();
      const [detail, bodyParts] = await Promise.all([
        s4mmToolsService.getClip(packagePath, clip.address, paths.gamePath),
        s4mmToolsService.getBodyParts(paths.gamePath),
      ]);
      const state = sceneRef.current;
      if (!state) return;
      if (!detail.rig) {
        showToast({
          type: 'warning',
          title: 'No matching skeleton',
          message:
            detail.rigCount > 0
              ? 'No game skeleton covers this clip. Set the Sims 4 install path in Settings if the scan was empty.'
              : 'No skeletons found. Set the Sims 4 install path in Settings so the viewer can read the game rigs.',
          duration: 4500,
        });
        return;
      }

      const figure = buildClipFigure(detail, bodyParts, gender);
      if (!figure) {
        showToast({
          type: 'warning',
          title: 'Body mesh missing',
          message: 'The adult Sim body was not found in Data/Client/ClientDeltaBuild0.package. Set the Sims 4 install path in Settings.',
          duration: 4500,
        });
        return;
      }
      clearClip();
      if (state.mesh) {
        state.scene.remove(state.mesh);
        state.mesh.geometry.dispose();
        state.mesh = null;
      }
      state.scene.add(figure.root);
      state.clipRoot = figure.root;
      clipTickRef.current = (delta) => {
        figure.mixer.update(delta);
      };
      const bounds = new THREE.Box3().setFromObject(figure.root);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.4);
      state.controls.target.copy(center);
      state.camera.position.set(center.x, center.y + radius * 0.15, center.z + radius * 2.4);
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to load animation',
        message: error?.message || 'Unable to read this clip.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
    }
  }

  async function pickPackage() {
    const result = await window.electron.ipcRenderer.invoke('dialog:open', {
      properties: ['openFile'],
      filters: [{ name: 'Sims 4 package', extensions: ['package'] }],
    });
    if (!result || result.canceled || !result.filePaths?.[0]) return;

    const packagePath = result.filePaths[0];
    setLoading(true);
    setItems(null);
    setClips([]);
    setSelectedClip(null);
    setSelectedSwatch(null);
    clearClip();
    try {
      const [casItems, clipList] = await Promise.all([
        s4mmToolsService.getCasItems(packagePath),
        s4mmToolsService.listClips(packagePath),
      ]);
      setFilePath(packagePath);
      setItems(casItems);
      setClips(clipList);
      if (casItems.swatches.length === 0 && clipList.length === 0) {
        showToast({
          type: 'warning',
          title: 'Nothing to preview',
          message: 'This package has no CAS parts or animation clips.',
          duration: 3000,
        });
      } else if (casItems.swatches.length === 0 && clipList.length > 0) {
        await showClip(clipList[0], packagePath);
      }
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to open package',
        message: error?.message || 'Unable to read this package.',
        duration: 3500,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <S4mmPanelShell
      title="3D CAS viewer"
      description="Renders CAS meshes and plays animation clips on the adult Sim body from your game install."
      onClose={onClose}
      loading={loading}
      actions={<S4mmActionButton onClick={() => void pickPackage()} disabled={loading}>Open package…</S4mmActionButton>}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-72 lg:shrink-0">
          {!items && <S4mmEmptyState message="Open a .package file to view its CAS meshes or animation clips." />}
          {clips.length > 0 && (
            <div className="mb-3 max-h-40 space-y-1 overflow-y-auto pr-1">
              <p className="px-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Animations
              </p>
              {clips.map((clip) => (
                <button
                  key={clip.address}
                  onClick={() => void showClip(clip)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm"
                  style={{
                    backgroundColor:
                      selectedClip === clip.address ? 'rgba(79, 195, 247, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="block truncate font-semibold">{clip.name || clip.address}</span>
                  <span className="block truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {clip.isPose ? 'Pose' : `${clip.duration.toFixed(2)}s`}
                    {clip.frameCount ? ` · ${clip.frameCount} frames` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {items && items.swatches.length > 0 && (
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {items.swatches.map((swatch, index) => (
                <button
                  key={`${swatch.instance}-${index}`}
                  onClick={() => {
                    setSelectedClip(null);
                    setSelectedSwatch(swatch);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm"
                  style={{
                    backgroundColor:
                      selectedSwatch?.instance === swatch.instance
                        ? 'rgba(124, 242, 98, 0.14)'
                        : 'rgba(255, 255, 255, 0.03)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span className="block truncate font-semibold">Swatch {index + 1}</span>
                  <span className="block truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {[swatch.age, swatch.gender].filter(Boolean).join(' ') || swatch.instance}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              LOD
              <select
                value={selectedLod}
                onChange={(event) => setSelectedLod(Number(event.target.value))}
                className="rounded-lg px-2 py-1 text-sm"
                style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
              >
                {(selectedSwatch?.lodLevels ?? [{ level: 0, list: [] }]).map((lod, index) => (
                  <option key={index} value={index}>
                    LOD {lod.level}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={useTexture} onChange={(event) => setUseTexture(event.target.checked)} />
              Texture
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={wireframe} onChange={(event) => setWireframe(event.target.checked)} />
              Wireframe
            </label>
            {clips.length > 0 && (
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                Body
                <select
                  value={bodyGender}
                  onChange={(event) => {
                    const next = event.target.value === 'man' ? 'man' : 'woman';
                    setBodyGender(next);
                    const clip = clips.find((item) => item.address === selectedClip);
                    if (clip) void showClip(clip, filePath, next);
                  }}
                  className="rounded-lg px-2 py-1 text-sm"
                  style={{ backgroundColor: 'var(--ui-hover)', color: 'var(--text-primary)' }}
                >
                  <option value="woman">Feminine</option>
                  <option value="man">Masculine</option>
                </select>
              </label>
            )}
          </div>
          <div
            ref={mountRef}
            className="w-full overflow-hidden rounded-xl"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)', minHeight: 420 }}
          />
        </div>
      </div>
    </S4mmPanelShell>
  );
}
