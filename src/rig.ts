// One arm: sleeve, wrist, a hand in American grip, and the stick it holds. Metres; the
// pad's surface is y = 0. No renderer here, so the geometry can be tested.
//
//   elbow ── forearm ── wrist (flexes) ── hand (rolled ~30°) ── fulcrum (fingers turn the stick) ── stick
//
// The stick pivots between thumb and index, 8 cm ahead of the wrist. Slow strokes turn the
// wrist; fast ones turn the stick in the fingers, and the back fingers open to let the
// butt drop. Whatever the arm and fingers do, the wrist angle is solved each pose so
// that height 0 puts the tip on the pad.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Hand } from './notation';
import { HAND_COLOR } from './canvas';

export const PAD_TOUCH = 0.005;      // tip centre height when the bead touches the pad
const STICK = 0.406, REACH = 0.27;   // a 16-inch stick, held a third of the way up
const FOREARM = 0.25;
const TRAVEL = 1.1;                  // rad of turn at height 1: about a foot of tip travel
const ARM_BASE = -0.06;              // the forearm slopes down a little to the wrist
const ROLL = 0.5;                    // American grip: thumb side up
const STICK_YAW = 0.25, STICK_PITCH = -0.15;   // the stick crosses the palm, thumb-front to heel

const SKIN = new THREE.MeshPhysicalMaterial({ color: 0xc98e6d, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xffc9a8), sheenRoughness: 0.6 });

function stickGeometry() {
  // radius, distance along the stick from the butt
  const profile: [number, number][] = [[0, 0], [0.0066, 0.001], [0.0072, 0.008], [0.0072, 0.25], [0.0062, 0.325], [0.0043, 0.372],
    [0.0036, 0.386], [0.0047, 0.392], [0.0051, 0.398], [0.0042, 0.4035], [0, STICK]];
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  g.rotateX(-Math.PI / 2);           // butt at z = 0, tip at z = −STICK
  g.translate(0, 0, STICK - REACH);  // the fulcrum at the origin, the tip at z = −REACH
  return g;
}

// a capsule from the origin along −z
function bone(length: number, radius: number, material: THREE.Material) {
  const g = new THREE.CapsuleGeometry(radius, length, 6, 12);
  g.rotateX(-Math.PI / 2); g.translate(0, 0, -length / 2);
  const m = new THREE.Mesh(g, material); m.castShadow = true;
  return m;
}

// a finger: three bones, each hinged at its joint; curl bends every joint toward the palm
class Finger {
  readonly root = new THREE.Group();
  private readonly joints: THREE.Group[] = [];
  constructor(lengths: number[], radius: number, private readonly bends: number[]) {
    let parent: THREE.Object3D = this.root;
    lengths.forEach((len, i) => {
      const j = i === 0 ? this.root : new THREE.Group();
      if (i > 0) { j.position.z = -lengths[i - 1]!; parent.add(j); }
      j.add(bone(len, radius * (1 - i * 0.1), SKIN));
      this.joints.push(j); parent = j;
    });
  }
  curl(k: number) { this.joints.forEach((j, i) => { j.rotation.x = -this.bends[i]! * k; }); }
}

export class HandRig {
  readonly root = new THREE.Group();
  readonly tip = new THREE.Object3D();
  readonly contact = new THREE.Vector3();          // where the tip met the pad at this pose's rest
  wristAngle = 0;
  private readonly elbow = new THREE.Group();
  private readonly wrist = new THREE.Group();
  private readonly stick = new THREE.Group();
  private readonly backFingers: Finger[] = [];
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private rest = 0;                                  // last solved wrist angle, the next solve's start

  constructor(hand: Hand) {
    const s = hand === 'R' ? 1 : -1;
    const color = new THREE.Color(HAND_COLOR[hand]);

    this.elbow.position.set(s * 0.215, 0.11, 0.58);
    this.elbow.rotation.order = 'YXZ';
    this.elbow.rotation.y = s * 0.12;
    const sleeve = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.55), roughness: 0.8 });
    const arm = new THREE.CylinderGeometry(0.024, 0.034, FOREARM - 0.05, 24);
    arm.rotateX(-Math.PI / 2); arm.translate(0, 0, -(FOREARM - 0.05) / 2);
    const forearm = new THREE.Mesh(arm, sleeve); forearm.castShadow = true;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.004, 10, 32), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    cuff.position.z = -(FOREARM - 0.05);
    const wristBone = bone(0.05, 0.023, SKIN); wristBone.position.z = -(FOREARM - 0.05);
    this.elbow.add(forearm, cuff, wristBone);

    this.wrist.position.z = -FOREARM;
    this.elbow.add(this.wrist);
    const handG = new THREE.Group();
    handG.rotation.z = -s * ROLL;
    this.wrist.add(handG);

    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.09, 4, 0.012), SKIN);
    palm.position.set(0, 0, -0.047); palm.castShadow = true;
    handG.add(palm);

    // index curls under the stick at the fulcrum; the back three wrap it and open for finger strokes
    const knuckles: [number, number, number[], number[]][] = [
      [-0.027, -0.094, [0.042, 0.026, 0.02], [0.9, 1.45, 1.0]],
      [-0.009, -0.096, [0.046, 0.029, 0.021], [1.05, 1.6, 1.1]],
      [0.009, -0.094, [0.043, 0.027, 0.02], [1.15, 1.6, 1.1]],
      [0.026, -0.088, [0.034, 0.021, 0.018], [1.25, 1.55, 1.1]],
    ];
    knuckles.forEach(([x, z, lengths, bends], i) => {
      const f = new Finger(lengths, i === 3 ? 0.0075 : 0.0085, bends);
      f.root.position.set(s * x, -0.004, z); f.root.rotation.y = -s * x * 1.2; f.curl(1);
      handG.add(f.root);
      if (i > 0) this.backFingers.push(f);
    });
    const thumb = new Finger([0.036, 0.03], 0.0095, [0.25, 0.3]);
    thumb.root.position.set(-s * 0.037, -0.014, -0.03);      // lies along the stick's side, its pad at the fulcrum
    thumb.root.rotation.order = 'YXZ'; thumb.root.rotation.y = s * 0.22; thumb.root.rotation.x = -0.28; thumb.curl(1);
    handG.add(thumb.root);

    this.stick.position.set(-s * 0.026, -0.03, -0.082);     // in the fingers, not the palm
    this.stick.rotation.order = 'YXZ'; this.stick.rotation.y = s * STICK_YAW;
    const wood = new THREE.Mesh(stickGeometry(), new THREE.MeshPhysicalMaterial({ color: 0xd9bc8f, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25 }));
    wood.castShadow = true;
    this.tip.position.z = -REACH;
    this.stick.add(wood, this.tip);
    handG.add(this.stick);

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.011, 0.015, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    // the upper arm, back up to the shoulder; it does not move, so the arm leaves the frame the way a player's does
    const shoulder = new THREE.Vector3(s * 0.2, 0.36, 0.8), elbowAt = this.elbow.position;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, shoulder.distanceTo(elbowAt), 24), sleeve);
    upper.position.copy(elbowAt).lerp(shoulder, 0.5);
    upper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shoulder.clone().sub(elbowAt).normalize());
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), sleeve);
    joint.position.copy(elbowAt);
    upper.castShadow = joint.castShadow = true;
    this.root.add(this.elbow, this.ring, upper, joint);
    this.pose(0, 0, 0);
  }

  // height: 0 = tip on the pad, 1 = a full accent; lift: forearm lift, rad; fingers: share of the stroke the fingers play
  pose(height: number, lift: number, fingers: number) {
    this.elbow.rotation.x = ARM_BASE + lift;
    this.stick.rotation.x = STICK_PITCH;
    this.rest = this.solveRest(this.rest);
    this.tip.getWorldPosition(this.contact);
    this.ring.position.set(this.contact.x, 0.0015, this.contact.z);

    const turn = height * TRAVEL;
    this.wristAngle = this.wrist.rotation.x = this.rest + turn * (1 - fingers);
    this.stick.rotation.x = STICK_PITCH + turn * fingers;
    const open = fingers > 0 ? (turn * fingers) / (TRAVEL * 0.7) : 0;
    for (const f of this.backFingers) f.curl(1 - 0.45 * open);
    this.root.updateMatrixWorld(true);
  }

  // the wrist angle that sets the tip on the pad, by Newton's method from the last one
  private solveRest(start: number) {
    const v = new THREE.Vector3(), y = (w: number) => { this.wrist.rotation.x = w; return this.tip.getWorldPosition(v).y - PAD_TOUCH; };
    let w = start;
    for (let i = 0; i < 8; i++) {
      const e = y(w);
      if (Math.abs(e) < 1e-5) break;
      w -= e / ((y(w + 1e-4) - e) / 1e-4);
    }
    y(w);
    return w;
  }

  // the ring that spreads from the contact point after a hit
  strike(age: number | null, color: string) {
    const m = this.ring.material;
    if (age === null || age < 0 || age >= 0.12) { m.opacity = 0; return; }
    const k = age / 0.12;
    m.color.set(color); m.opacity = 0.9 * (1 - k); this.ring.scale.setScalar(1 + k * 3.5);
  }
}
