import { describe, expect, test } from 'bun:test';
import { parse, Timeline } from '../src/notation';
import { Judge } from '../src/judge';

const judgeOf = (notation: string, bpm = 60) => new Judge(new Timeline(parse(notation), 60 / bpm));

describe('Judge', () => {
  test('a hit on the stroke is perfect; windows widen to good and ok', () => {
    const j = judgeOf('q: R L R L');                  // strokes at 0, 1, 2, 3 s
    expect(j.hit(0, null)).toMatchObject({ n: 0, result: 'perfect' });
    expect(j.hit(1.04, null)).toMatchObject({ n: 1, result: 'good' });
    expect(j.hit(1.92, null)).toMatchObject({ n: 2, result: 'ok' });
  });

  test('a hit near nothing is an extra and breaks the combo', () => {
    const j = judgeOf('q: R L');
    j.hit(0, null);
    expect(j.hit(0.5, null).result).toBe('extra');
    expect(j.stats.combo).toBe(0);
  });

  test('each stroke is judged once: a second hit goes to the next stroke or is an extra', () => {
    const j = judgeOf('q: R L');
    j.hit(0, null);
    expect(j.hit(0.01, null).result).toBe('extra');
  });

  test('sweep marks strokes nobody hit as misses; a missed grace is a flat flam', () => {
    const j = judgeOf('8: lR rL');
    j.hit(0, null);                                   // the main note of the first flam, grace missed
    const v = j.sweep(0.4);
    expect(v.map(x => x.result)).toEqual(['flat']);
    expect(j.stats.flat).toBe(1);
    expect(j.stats.miss).toBe(0);
    j.sweep(1.0);                                     // second flam, both strokes missed
    expect(j.stats.miss).toBe(1);
    expect(j.stats.flat).toBe(2);
  });

  test('accents are judged against the player\'s own taps, not a fixed loudness', () => {
    const j = judgeOf('q: R L R >L');
    j.hit(0, 0.1); j.hit(1, 0.1); j.hit(2, 0.1);
    expect(j.hit(3, 0.2).accent).toBe('ok');
    const k = judgeOf('q: R L R >L');
    k.hit(0, 0.1); k.hit(1, 0.1); k.hit(2, 0.1);
    expect(k.hit(3, 0.12).accent).toBe('soft');
  });

  test('flam spread is measured from grace to main note', () => {
    const j = judgeOf('8: lR rL');
    const g = j.timeline.stroke(0).time;
    j.hit(g + 0.005, null); j.hit(0, null);
    expect(j.stats.flams[0]).toBeCloseTo(-g - 0.005, 5);
  });

  test('a keyboard tap has no loudness and gets no accent verdict', () => {
    const j = judgeOf('q: >R L');
    expect(j.hit(0, null).accent).toBeUndefined();
  });
});
