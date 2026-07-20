'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useToast } from '@/context/ToastContext';
import {
  s4mmToolsService,
  type CasItemsResult,
  type CasSwatchInfo,
  type ModelChunk,
} from '@/lib/services/S4mmToolsService';
import S4mmPanelShell, { S4mmActionButton, S4mmEmptyState } from './S4mmPanelShell';

function chunksToGeometry(chunks: ModelChunk[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const chunk of chunks) {
    for (const vertex of chunk.vertex) {
      positions.push(vertex.x ?? 0, vertex.y ?? 0, vertex.z ?? 0);
      uvs.push(vertex.u ?? 0, 1 - (vertex.v ?? 0));
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

export default function ObjectViewerPanel({ onClose }: { onClose?: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [items, setItems] = useState<CasItemsResult | null>(null);
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
    disposed: boolean;
  } | null>(null);

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

    const state = { renderer, scene, camera, controls, mesh: null as THREE.Mesh | null, disposed: false };
    sceneRef.current = state;

    const animate = () => {
      if (state.disposed) return;
      requestAnimationFrame(animate);
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

  async function pickPackage() {
    const result = await window.electron.ipcRenderer.invoke('dialog:open', {
      properties: ['openFile'],
      filters: [{ name: 'Sims 4 package', extensions: ['package'] }],
    });
    if (!result || result.canceled || !result.filePaths?.[0]) return;

    const packagePath = result.filePaths[0];
    setLoading(true);
    setItems(null);
    setSelectedSwatch(null);
    try {
      const casItems = await s4mmToolsService.getCasItems(packagePath);
      setFilePath(packagePath);
      setItems(casItems);
      if (casItems.swatches.length === 0) {
        showToast({
          type: 'warning',
          title: 'No CAS items',
          message: 'This package has no CAS parts to preview in 3D.',
          duration: 3000,
        });
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
      description="Renders CAS meshes (LODs and swatches) from a package file, with optional diffuse texture."
      onClose={onClose}
      loading={loading}
      actions={<S4mmActionButton onClick={() => void pickPackage()} disabled={loading}>Open package…</S4mmActionButton>}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-72 lg:shrink-0">
          {!items && <S4mmEmptyState message="Open a .package file to view its CAS meshes." />}
          {items && items.swatches.length > 0 && (
            <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {items.swatches.map((swatch, index) => (
                <button
                  key={`${swatch.instance}-${index}`}
                  onClick={() => setSelectedSwatch(swatch)}
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
