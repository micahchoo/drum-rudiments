// How high a stick is at any moment. The four stroke types are not stored: they fall
// out of one rule. After each stroke the stick rises to the height of its hand's NEXT
// stroke, holds, and falls — so an accent before a tap ends low (a down stroke) and a
// tap before an accent ends high (an up stroke). Speed caps height: there is only so
// far a stick can travel in the time it has, which is why fast diddles stay low.

import type { Hand, Level, Stroke, Timeline } from './notation';

export const HEIGHT: Record<Level, number> = { accent: 1, tap: 0.35, grace: 0.1 };
export const REST = 0.2;
const SPEED = 10;          // height units per second a stick can travel
const PREP = 0.5;          // s a resting stick takes to get ready for its first stroke
const BUZZ = 0.12;         // s a buzz stays pressed into the pad

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);
const easeIn = (x: number) => x * x;

function neighbours(tl: Timeline, hand: Hand, t: number) {
  const first = tl.indexAt(t), limit = tl.perCycle * 2;
  let next: Stroke | null = null, prev: Stroke | null = null;
  for (let n = first; n < first + limit; n++) { const s = tl.stroke(n); if (s.hand === hand) { next = s; break; } }
  for (let n = first - 1; n >= Math.max(0, first - limit); n--) { const s = tl.stroke(n); if (s.hand === hand) { prev = s; break; } }
  return { prev, next };
}

export interface Height { h: number; last: Stroke | null; gap: number }   // gap: s between the strokes this travel joins

export function stickHeight(tl: Timeline, hand: Hand, t: number): Height {
  const { prev, next } = neighbours(tl, hand, t);
  if (!next) return { h: REST, last: prev, gap: Infinity };
  const tn = next.time;
  let tp: number, h0: number;
  if (prev) { tp = prev.time; h0 = 0; }
  else { tp = tn - PREP; h0 = REST; if (t < tp) return { h: REST, last: null, gap: Infinity }; }

  // a buzz stays down, bouncing, before the lift begins
  if (prev?.buzz) {
    const hold = Math.min(BUZZ, (tn - tp) * 0.3);
    if (t < tp + hold) {
      const u = (t - tp) / hold;
      return { h: 0.03 * Math.abs(Math.sin(u * Math.PI * 7)) * (1 - u), last: prev, gap: tn - prev.time };
    }
    tp += hold;
  }

  const gap = tn - tp;
  const apex = Math.min(HEIGHT[next.level], h0 + (SPEED * gap) / 2);
  const rise = Math.min(0.14, gap * 0.4), fall = Math.min(0.12, gap * 0.45);
  let h: number;
  if (t >= tn - fall) h = apex * (1 - easeIn((t - (tn - fall)) / fall));
  else if (t < tp + rise) h = h0 + (apex - h0) * easeOut((t - tp) / rise);
  else h = apex;
  return { h, last: prev, gap };
}

// How much of a stroke the fingers play. Slow strokes are all wrist; as the time between
// one hand's strokes shrinks the fingers take over, though the wrist never stops.
export function fingerShare(gap: number): number {
  return Math.min(0.7, Math.max(0, (0.45 - gap) / 0.5));
}

// Moeller: on the way down the forearm leads the stick, and only big strokes use it.
// Taking the lower of now and a moment ahead keeps it at rest at every contact, so the
// tip still lands on the pad.
export function armLift(tl: Timeline, hand: Hand, t: number): number {
  const h = Math.min(stickHeight(tl, hand, t).h, stickHeight(tl, hand, t + 0.04).h);
  return 0.3 * h ** 1.5;
}
