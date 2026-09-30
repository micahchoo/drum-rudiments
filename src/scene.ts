// One three.js scene — a practice pad, two sticks, two hands — drawn by one renderer
// into two viewports: from the player's right side, and from behind the player's eyes.
// Units are metres; the pad's playing surface is y = 0.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Hand } from './notation';
import { HandRig } from './rig';

interface View { el: HTMLElement; cam: THREE.PerspectiveCamera; halfW: number; halfH: number; dist: number }

export class PadScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rigs = {} as Record<Hand, HandRig>;
  private readonly views: View[];

  constructor(canvas: HTMLCanvasElement, side: HTMLElement, front: HTMLElement) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.lights(); this.pad();
    for (const h of ['R', 'L'] as const) { this.rigs[h] = new HandRig(h); this.scene.add(this.rigs[h].root); }

    const view = (el: HTMLElement, pos: [number, number, number], look: [number, number, number], halfW: number, halfH: number): View => {
      const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 10);
      cam.position.set(...pos); cam.lookAt(...look);
      return { el, cam, halfW, halfH, dist: cam.position.distanceTo(new THREE.Vector3(...look)) };
    };
    this.views = [
      view(side, [1.05, 0.17, 0.2], [0, 0.1, 0.2], 0.36, 0.2),
      view(front, [0, 0.62, 0.84], [0, 0.03, 0.12], 0.34, 0.27),
    ];
  }

  private lights() {
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(0.25, 1.2, 0.35); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -0.35, right: 0.35, top: 0.35, bottom: -0.35, near: 0.2, far: 2.5 });
    key.shadow.radius = 5; key.shadow.bias = -0.0004;
    const rim = new THREE.DirectionalLight(0x9cc2ff, 1.1); rim.position.set(-0.7, 0.5, -0.7);
    this.scene.add(key, rim);
  }

  private pad() {
    const body = new THREE.Mesh(
      new THREE.LatheGeometry([[0, -0.032], [0.156, -0.032], [0.163, -0.027], [0.163, -0.007], [0.157, -0.003], [0, -0.003]].map(([x, y]) => new THREE.Vector2(x, y)), 96),
      new THREE.MeshPhysicalMaterial({ color: 0x17191d, roughness: 0.45, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.4 }));
    const gum = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.146, 0.004, 96), new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.96 }));
    gum.position.y = -0.002; gum.receiveShadow = true;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.95, 24), new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.85, roughness: 0.3 }));
    pole.position.y = -0.51;
    this.scene.add(body, gum, pole);
  }

  // height: stick height (0 = on the pad); lift: forearm lift, rad; fingers: the fingers' share; strike: the ring after a hit
  pose(h: Hand, height: number, lift: number, fingers: number, strike: { age: number; color: string } | null) {
    this.rigs[h].pose(height, lift, fingers);
    this.rigs[h].strike(strike?.age ?? null, strike?.color ?? '');
  }

  render() {
    const canvas = this.renderer.domElement, box = canvas.getBoundingClientRect();
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== box.width || size.y !== box.height) this.renderer.setSize(box.width, box.height, false);
    this.renderer.setScissorTest(false); this.renderer.setClearColor(0, 0); this.renderer.clear();
    this.renderer.setScissorTest(true);
    for (const v of this.views) {
      const b = v.el.getBoundingClientRect(), w = b.width, h = b.height;
      if (w < 2 || h < 2) continue;
      const x = b.left - box.left, y = box.bottom - b.bottom;
      this.renderer.setViewport(x, y, w, h); this.renderer.setScissor(x, y, w, h);
      v.cam.aspect = w / h;
      v.cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(v.halfH, v.halfW / v.cam.aspect) * 1.08 / v.dist));
      v.cam.updateProjectionMatrix();
      this.renderer.render(this.scene, v.cam);
    }
  }
}
