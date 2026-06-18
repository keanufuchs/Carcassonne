import * as THREE from 'three';
import type { TilePrototype } from '../core/types/tile';
import type { Rotation } from '../core/types';
import { layoutRegions } from './layoutRegions';
import { generateTile } from './generateTile';
import { disposeObject } from '../ui/board/board3d';

/**
 * Renders a tile prototype to a PNG data URL using the same procedural geometry,
 * camera and lighting as `TilePreview3D`, but through a single shared offscreen
 * WebGL renderer. This lets many thumbnails (e.g. the whole move history) show
 * the real 3D tile without each mounting its own `<Canvas>` — browsers cap the
 * number of live WebGL contexts (~16), which a per-card canvas would exhaust.
 *
 * Results are cached by `prototypeId@rotation`, so each distinct thumbnail is
 * rendered at most once.
 */

const SIZE = 128; // square render target; the <img> is scaled down by CSS.

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;

function ensureRenderer(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null {
  if (typeof document === 'undefined') return null;
  if (renderer && scene && camera) return { renderer, scene, camera };

  const canvas = document.createElement('canvas');
  let r: THREE.WebGLRenderer;
  try {
    r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null; // No WebGL available (e.g. some test/headless envs).
  }
  r.setSize(SIZE, SIZE, false);
  r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.08;

  const s = new THREE.Scene();
  // Same lighting as PreviewLighting in TilePreview3D.
  s.add(new THREE.HemisphereLight(0xe4ecff, 0x6a7a4a, 0.7));
  s.add(new THREE.AmbientLight(0xffffff, 0.35));
  const dir = new THREE.DirectionalLight(0xfff2da, 1.5);
  dir.position.set(2, 4, 3);
  s.add(dir);

  // Same framing as the TilePreview3D camera.
  const c = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  c.position.set(0.95, 1.3, 2.05);
  c.lookAt(0, 0, 0);

  renderer = r;
  scene = s;
  camera = c;
  return { renderer: r, scene: s, camera: c };
}

/**
 * Returns a PNG data URL of the tile, or `null` if rendering is unavailable
 * (caller should fall back to the flat SVG image).
 */
export function getTileSnapshot(proto: TilePrototype, rotation: Rotation): string | null {
  const key = `${proto.id}@${rotation}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const ctx = ensureRenderer();
  if (!ctx) return null;

  const seed = proto.id;
  const group = generateTile(proto, layoutRegions(proto, seed), seed);
  // Mirror the board/preview: clockwise rotation steps map to negative Y rotation.
  group.rotation.y = -(rotation * Math.PI) / 180;

  ctx.scene.add(group);
  ctx.renderer.render(ctx.scene, ctx.camera);
  const url = ctx.renderer.domElement.toDataURL('image/png');
  ctx.scene.remove(group);
  disposeObject(group);

  cache.set(key, url);
  return url;
}
