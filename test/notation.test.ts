import { describe, expect, test } from 'bun:test';
import { parse, Timeline } from '../src/notation';
import { RUDIMENTS } from '../src/rudiments';

describe('parse', () => {
  test('sixteenths advance a quarter beat each; accents and hands are kept', () => {
    const p = parse('16: >R L R R >L R L L');
    expect(p.beats).toBe(2);
    expect(p.notes.map(n => n.start)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
    expect(p.notes.map(n => n.hand).join('')).toBe('RLRRLRLL');
    expect(p.notes.filter(n => n.accent).map(n => n.start)).toEqual([0, 1]);
  });

  test('a lowercase prefix is a grace by the other hand: one is a flam, two a drag', () => {
    const [flam, drag] = parse('8: lR rrL').notes;
    expect(flam).toMatchObject({ hand: 'R', graces: 1 });
    expect(drag).toMatchObject({ hand: 'L', graces: 2 });
  });

  test('a grace by the same hand as its note is refused', () => {
    expect(() => parse('8: rR')).toThrow();
  });

  test('tuplets divide the beat: 3/8 in thirds, 6/16 in sixths', () => {
    expect(parse('3/8: R L R').notes.map(n => n.start)).toEqual([0, 1 / 3, 2 / 3]);
    const six = parse('6/16: R L R L R L');
    expect(six.beats).toBeCloseTo(1);
    expect(six.notes[5]!.tuplet).toBe(6);
  });

  test('a rest advances time and makes no note; z marks a buzz', () => {
    const p = parse('8: Rz - Lz -');
    expect(p.notes.map(n => n.start)).toEqual([0, 1]);
    expect(p.notes.every(n => n.buzz)).toBe(true);
    expect(p.beats).toBe(2);
  });

  test('an unknown token is refused, not skipped', () => {
    expect(() => parse('16: R X')).toThrow();
    expect(() => parse('R L')).toThrow();   // no duration given
  });
});

describe('the 40 PAS rudiments', () => {
  test('are numbered 1 to 40 once each', () => {
    expect(RUDIMENTS.map(r => r.number)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
  });

  test.each(RUDIMENTS.map(r => [r.number, r.name, r] as const))('%i %s parses to whole beats', (_n, _name, r) => {
    const p = parse(r.notation);
    expect(p.notes.length).toBeGreaterThan(0);
    expect(Math.abs(p.beats - Math.round(p.beats))).toBeLessThan(1e-9);
  });

  test('flam and drag rudiments carry their graces', () => {
    const by = (name: string) => parse(RUDIMENTS.find(r => r.name === name)!.notation);
    expect(by('Flam').notes.every(n => n.graces === 1)).toBe(true);
    expect(by('Drag').notes.every(n => n.graces === 2)).toBe(true);
    expect(by('Multiple Bounce Roll').notes.every(n => n.buzz)).toBe(true);
  });
});

describe('Timeline', () => {
  test('a flam is two strokes: the grace by the other hand, just before the note', () => {
    const tl = new Timeline(parse('8: lR rL'), 60 / 60);
    const [g, m] = [tl.stroke(0), tl.stroke(1)];
    expect(g).toMatchObject({ hand: 'L', level: 'grace' });
    expect(m).toMatchObject({ hand: 'R', level: 'tap', time: 0 });
    expect(m.time - g.time).toBeGreaterThan(0.01);
    expect(m.time - g.time).toBeLessThanOrEqual(0.035);
  });

  test('strokes repeat each cycle', () => {
    const tl = new Timeline(parse('16: R L R L'), 0.5);
    expect(tl.stroke(4).time).toBeCloseTo(0.5);
    expect(tl.stroke(4).hand).toBe('R');
  });

  test.each([10, 60, 240])('every rudiment at %i bpm gives strictly increasing stroke times', bpm => {
    for (const r of RUDIMENTS) {
      const tl = new Timeline(parse(r.notation), 60 / bpm);
      for (let n = 1; n < tl.perCycle * 3; n++) {
        if (!(tl.stroke(n).time > tl.stroke(n - 1).time)) throw new Error(`${r.name} at ${bpm}: stroke ${n}`);
      }
    }
  });

  test('indexAt finds the first stroke at or after a time', () => {
    const tl = new Timeline(parse('16: R L R L'), 1);
    expect(tl.indexAt(0)).toBe(0);
    expect(tl.indexAt(0.3)).toBe(2);
    expect(tl.indexAt(1.1)).toBe(5);
  });
});
