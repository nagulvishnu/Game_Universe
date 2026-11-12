import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WeaponId } from '../game/types';
import { WEAPONS } from '../game/data/weapons';
import { buildWeapon } from '../game/weaponModels';

const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null, envTex: THREE.Texture | null = null;

/** Renders the real 3D weapon model to a PNG data-url (used as card artwork). */
export function weaponArt(id: WeaponId, skin = 0, awakened = false): string {
  const key = `${id}:${skin}:${awakened}`; const hit = cache.get(key); if (hit !== undefined) return hit;
  let url = '';
  try {
    const W = 360, H = 520;
    if (!renderer) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.toneMapping = THREE.ACESFilmicToneMapping;
      const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(new RoomEnvironment(), .04).texture;
    }
    const wp = WEAPONS[id], sk = wp.skins[skin] ?? wp.skins[0];
    const scene = new THREE.Scene(); scene.environment = envTex; scene.environmentIntensity = .9;
    const m = buildWeapon(id, sk.color, sk.color2);
    for (let i = 0; i < 20; i++) m.update(i * .1, awakened, .1);
    const root = new THREE.Group(); root.add(m.group);
    if (m.second) { m.second.position.x = .0; root.add(m.second); m.group.rotation.z = -.28; m.second.rotation.z = .28; m.group.position.x = .1; m.second.position.x = -.1; m.group.rotation.y = .5; m.second.rotation.y = -.5; }
    if (m.back) root.add(m.back);
    root.rotation.z = m.second ? 0 : -.5; root.rotation.y = m.second ? 0 : .5; scene.add(root);
    // frame
    root.updateMatrixWorld(true); const box = new THREE.Box3();
    root.traverse(o => { const me = o as THREE.Mesh; const mt = me.material as THREE.Material | undefined; if (!me.isMesh || (mt && mt.transparent && mt.opacity < .05)) return; me.geometry.computeBoundingBox(); box.union(me.geometry.boundingBox!.clone().applyMatrix4(me.matrixWorld)); });
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    root.position.sub(c);
    const cam = new THREE.PerspectiveCamera(30, W / H, .1, 100); const fit = Math.max(size.y / (2 * Math.tan(15 * Math.PI / 180)) * 1.12, size.x / (2 * Math.tan(15 * Math.PI / 180) * (W / H)) * 1.15, 4);
    cam.position.set(0, 0, fit + size.z); cam.lookAt(0, 0, 0);
    const key1 = new THREE.DirectionalLight(0xffffff, 4.5); key1.position.set(3, 4, 6); const rim = new THREE.DirectionalLight(sk.color, 8); rim.position.set(-5, 2, -3); scene.add(key1, rim, new THREE.AmbientLight(0x606080, 1.8));
    const bgc = document.createElement('canvas'); bgc.width = 64; bgc.height = 64; const g = bgc.getContext('2d')!; const grd = g.createRadialGradient(32, 32, 0, 32, 32, 40);
    const col = new THREE.Color(sk.color); grd.addColorStop(0, `rgba(${col.r * 120 + 10 | 0},${col.g * 120 + 10 | 0},${col.b * 120 + 10 | 0},1)`); grd.addColorStop(1, 'rgba(6,6,12,1)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    scene.background = new THREE.CanvasTexture(bgc);
    renderer.render(scene, cam); url = renderer.domElement.toDataURL('image/png');
    scene.traverse(o => { const me = o as THREE.Mesh; me.geometry?.dispose?.(); });
  } catch { url = ''; }
  cache.set(key, url); return url;
}
