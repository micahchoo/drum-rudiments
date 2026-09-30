// Play mode's scoring. It hears when and how loud, never which hand: each hit is
// matched to the nearest unjudged stroke in time, whichever hand it was written for.

import type { Timeline } from './notation';

export type Result = 'perfect' | 'good' | 'ok' | 'miss' | 'flat' | 'extra';
export interface Verdict { n: number; result: Result; err: number; accent?: 'ok' | 'soft' | 'loud' }

export const WINDOW = { perfect: 0.025, good: 0.05, ok: 0.1 };
const LATE = 0.12;          // s after a stroke before an unhit one counts as missed
const POINTS = { perfect: 100, good: 60, ok: 25 };

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export function newStats() {
  return {
    score: 0, combo: 0, best: 0, perfect: 0, good: 0, ok: 0, miss: 0, flat: 0, extra: 0,
    errs: [] as number[], accentPeaks: [] as number[], tapPeaks: [] as number[], flams: [] as number[],
  };
}
export type Stats = ReturnType<typeof newStats>;

export class Judge {
  readonly stats: Stats = newStats();
  readonly verdicts = new Map<number, Verdict>();
  private from = 0;
  private readonly graceAt = new Map<number, number>();

  constructor(public timeline: Timeline) {}

  // t: when the hit happened, seconds from beat 0, already corrected for latency. peak: loudness, null from a key.
  hit(t: number, peak: number | null): Verdict {
    const tl = this.timeline;
    let best = -1, bestErr = Infinity;
    for (let n = Math.max(0, this.from - 2); ; n++) {
      const s = tl.stroke(n);
      if (s.time > t + WINDOW.ok) break;
      if (this.verdicts.has(n)) continue;
      const err = t - s.time;
      if (Math.abs(err) <= WINDOW.ok && Math.abs(err) < Math.abs(bestErr)) { best = n; bestErr = err; }
    }
    const st = this.stats;
    if (best < 0) { st.extra++; st.combo = 0; return { n: -1, result: 'extra', err: 0 }; }

    const s = tl.stroke(best), ms = Math.abs(bestErr);
    const result = ms <= WINDOW.perfect ? 'perfect' : ms <= WINDOW.good ? 'good' : 'ok';
    st[result]++; st.errs.push(bestErr); st.combo++; st.best = Math.max(st.best, st.combo);
    st.score += POINTS[result] * (1 + Math.min(st.combo, 50) / 50);
    const v: Verdict = { n: best, result, err: bestErr };

    if (peak != null && s.level !== 'grace') {
      const accent = s.level === 'accent';
      (accent ? st.accentPeaks : st.tapPeaks).push(peak);
      const taps = median(st.tapPeaks), accents = median(st.accentPeaks);
      if (accent && taps) v.accent = peak >= taps * 1.6 ? 'ok' : 'soft';
      else if (!accent && accents && peak > accents * 0.8) v.accent = 'loud';
      if (v.accent === 'ok') st.score += 30;
    }
    if (s.level === 'grace') this.graceAt.set(best, t);
    else if (this.graceAt.has(best - 1)) st.flams.push(t - this.graceAt.get(best - 1)!);

    this.verdicts.set(best, v);
    return v;
  }

  // Everything nobody hit by `now` is missed. A missed grace is a flat flam or drag.
  sweep(now: number): Verdict[] {
    const out: Verdict[] = [];
    for (;;) {
      const s = this.timeline.stroke(this.from);
      if (s.time >= now - LATE) break;
      if (!this.verdicts.has(this.from)) {
        const v: Verdict = { n: this.from, result: s.level === 'grace' ? 'flat' : 'miss', err: 0 };
        this.stats[v.result === 'flat' ? 'flat' : 'miss']++;
        this.stats.combo = 0;
        this.verdicts.set(this.from, v); out.push(v);
      }
      this.from++;
    }
    return out;
  }
}
