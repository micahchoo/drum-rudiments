import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { HandRig, PAD_TOUCH } from '../src/rig';

const tipAt = (rig: HandRig, height: number, lift: number, fingers = 0) => {
  rig.pose(height, lift, fingers);
  return rig.tip.getWorldPosition(new THREE.Vector3());
};

describe('HandRig', () => {
  test.each(['R', 'L'] as const)('%s: at height 0 the tip touches the pad, however the arm and fingers share the stroke', hand => {
    const rig = new HandRig(hand);
    for (const lift of [0, 0.05, 0.2]) for (const fingers of [0, 0.4, 0.7]) {
      expect(Math.abs(tipAt(rig, 0, lift, fingers).y - PAD_TOUCH)).toBeLessThan(0.002);
    }
  });

  test.each(['R', 'L'] as const)('%s: the tip lands on the pad, on its own side of the centre', hand => {
    const p = tipAt(new HandRig(hand), 0, 0);
    expect(Math.hypot(p.x, p.z)).toBeLessThan(0.09);
    expect(p.x * (hand === 'R' ? 1 : -1)).toBeGreaterThan(0.02);   // sticks two inches or so apart
  });

  test('an accent lifts the tip about a foot; a tap a few inches', () => {
    const rig = new HandRig('R');
    expect(tipAt(rig, 1, 0).y).toBeGreaterThan(0.22);
    const tap = tipAt(rig, 0.35, 0).y;
    expect(tap).toBeGreaterThan(0.04);
    expect(tap).toBeLessThan(0.14);
  });

  test('a finger stroke reaches about the same height with less wrist travel', () => {
    const rig = new HandRig('R');
    tipAt(rig, 0, 0); const down = rig.wristAngle;
    const wristY = tipAt(rig, 0.35, 0, 0).y, wristTravel = Math.abs(rig.wristAngle - down);
    const fingerY = tipAt(rig, 0.35, 0, 0.7).y, fingerTravel = Math.abs(rig.wristAngle - down);
    expect(Math.abs(wristY - fingerY)).toBeLessThan(0.03);
    expect(fingerTravel).toBeLessThan(wristTravel * 0.5);
  });

  test('the two hands mirror each other', () => {
    const r = tipAt(new HandRig('R'), 0.5, 0.1, 0.3), l = tipAt(new HandRig('L'), 0.5, 0.1, 0.3);
    expect(r.x).toBeCloseTo(-l.x, 5);
    expect(r.y).toBeCloseTo(l.y, 5);
    expect(r.z).toBeCloseTo(l.z, 5);
  });
});
