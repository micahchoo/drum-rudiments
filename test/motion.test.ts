import { describe, expect, test } from 'bun:test';
import { parse, Timeline, type Hand } from '../src/notation';
import { stickHeight, fingerShare, HEIGHT, REST } from '../src/motion';
import { RUDIMENTS } from '../src/rudiments';

const at = (notation: string, bpm: number) => new Timeline(parse(notation), 60 / bpm);
function peakBetween(tl: Timeline, hand: Hand, a: number, b: number) {
  let m = 0;
  for (let t = a + 0.001; t < b; t += 0.001) m = Math.max(m, stickHeight(tl, hand, t).h);
  return m;
}

describe('stick height', () => {
  test('the stick is on the pad at every stroke of its hand', () => {
    const tl = at('16: >R L R R >L R L L', 80);
    for (let n = 0; n < 16; n++) {
      const s = tl.stroke(n);
      expect(stickHeight(tl, s.hand, s.time).h).toBeCloseTo(0, 5);
    }
  });

  test('down stroke: after an accent the stick stops low, at the next tap\'s height', () => {
    const tl = at('8: >R L R L', 60);                  // R: accent at 0, tap at 1 s
    expect(peakBetween(tl, 'R', 0, 1)).toBeCloseTo(HEIGHT.tap, 2);
  });

  test('up stroke: after a tap the stick rises to full height for the accent that follows', () => {
    const tl = at('8: R L >R L', 60);                  // R: tap at 0, accent at 1 s
    expect(peakBetween(tl, 'R', 0, 1)).toBeCloseTo(HEIGHT.accent, 2);
  });

  test('speed caps height: fast diddles stay low, as a drummer\'s do', () => {
    const tl = at('32: R R L L R R L L', 240);          // 31 ms between the strokes of a diddle
    expect(peakBetween(tl, 'R', tl.stroke(0).time, tl.stroke(1).time)).toBeLessThan(0.2);
  });

  test('a drag\'s graces barely leave the pad', () => {
    const tl = at('8: llR rrL', 60);
    const [g1, g2] = [tl.stroke(0), tl.stroke(1)];
    expect(g1.level).toBe('grace');
    expect(peakBetween(tl, 'L', g1.time, g2.time)).toBeLessThan(HEIGHT.grace + 1e-9);
  });

  test('before playing, both sticks rest', () => {
    const tl = at('16: R L R L', 60);
    expect(stickHeight(tl, 'R', -5).h).toBe(REST);
    expect(stickHeight(tl, 'L', -5).h).toBe(REST);
  });

  test('a buzz stays pressed into the pad before it lifts', () => {
    const tl = at('8: Rz Lz', 30);
    expect(peakBetween(tl, 'R', 0, 0.1)).toBeLessThan(0.06);
  });

  test('slow strokes are wrist strokes; fast ones are played mostly with the fingers', () => {
    expect(fingerShare(0.6)).toBe(0);
    expect(fingerShare(0.08)).toBeGreaterThanOrEqual(0.5);
    expect(fingerShare(0.2)).toBeGreaterThan(fingerShare(0.3));
    expect(fingerShare(0.001)).toBeLessThanOrEqual(0.7);    // the wrist never stops altogether
  });

  test('the height carries the gap it is travelling across', () => {
    const tl = at('8: R L R L', 60);                         // R every second
    expect(stickHeight(tl, 'R', 0.5).gap).toBeCloseTo(1, 5);
  });

  test.each([10, 60, 200])('motion is continuous for every rudiment at %i bpm', bpm => {
    for (const r of RUDIMENTS) {
      const tl = new Timeline(parse(r.notation), 60 / bpm);
      for (const hand of ['R', 'L'] as const) {
        let last = stickHeight(tl, hand, -0.6).h;
        for (let t = -0.6; t < tl.cycleSec * 2; t += 0.0005) {
          const h = stickHeight(tl, hand, t).h;
          if (Math.abs(h - last) > 0.03) throw new Error(`${r.name} ${hand} at ${bpm} bpm jumps ${(h - last).toFixed(3)} at t=${t.toFixed(4)}`);
          last = h;
        }
      }
    }
  });
});
