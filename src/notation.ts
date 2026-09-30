// The notation language every rudiment is written in, and the strokes it yields in time.
//
//   16: >R L R R        a duration marker, then notes of that value until the next marker
//   q 8 16 32           quarter, eighth, sixteenth, thirty-second
//   3/8 3/16 6/16       tuplets: eighth triplets, sixteenth triplets, sextuplets
//   >                   accent
//   lR  rrL             graces by the other hand before the note: one = flam, two = drag
//   Rz                  buzz (multiple bounce)
//   -                   rest of the current value

export type Hand = 'R' | 'L';
export type NoteValue = 'q' | '8' | '16' | '32';

export interface Note {
  start: number;        // beats from the cycle's start
  dur: number;          // beats
  value: NoteValue;
  tuplet: 0 | 3 | 6;
  hand: Hand;
  accent: boolean;
  graces: number;       // by the other hand
  buzz: boolean;
}

export interface Pattern { notes: Note[]; beats: number }

const DURATIONS: Record<string, { dur: number; value: NoteValue; tuplet: 0 | 3 | 6 }> = {
  'q': { dur: 1, value: 'q', tuplet: 0 },
  '8': { dur: 1 / 2, value: '8', tuplet: 0 },
  '16': { dur: 1 / 4, value: '16', tuplet: 0 },
  '32': { dur: 1 / 8, value: '32', tuplet: 0 },
  '3/8': { dur: 1 / 3, value: '8', tuplet: 3 },
  '3/16': { dur: 1 / 6, value: '16', tuplet: 3 },
  '6/16': { dur: 1 / 6, value: '16', tuplet: 6 },
};
const NOTE = /^(>?)([rl]*)([RL])(z?)$/;
const other = (h: Hand): Hand => (h === 'R' ? 'L' : 'R');

export function parse(src: string): Pattern {
  const notes: Note[] = [];
  let t = 0, current: (typeof DURATIONS)[string] | undefined;
  for (const tok of src.trim().split(/\s+/)) {
    if (tok.endsWith(':')) {
      current = DURATIONS[tok.slice(0, -1)];
      if (!current) throw new Error(`unknown duration "${tok}"`);
      continue;
    }
    if (!current) throw new Error(`"${tok}" comes before any duration marker`);
    if (tok !== '-') {
      const m = NOTE.exec(tok);
      if (!m) throw new Error(`unknown token "${tok}"`);
      const [, accent = '', graces = '', hand = 'R', buzz = ''] = m;
      const h = hand as Hand;
      if ([...graces].some(g => g.toUpperCase() !== other(h))) throw new Error(`"${tok}": a grace is played by the other hand`);
      notes.push({ start: t, dur: current.dur, value: current.value, tuplet: current.tuplet, hand: h, accent: accent === '>', graces: graces.length, buzz: buzz === 'z' });
    }
    t += current.dur;
  }
  return { notes, beats: Math.round(t * 1e9) / 1e9 };
}

// ─── strokes ───

export type Level = 'accent' | 'tap' | 'grace';

export interface Stroke {
  n: number;            // global index, counting from the first stroke of cycle 0
  time: number;         // seconds from beat 0 of cycle 0; a grace of the first note is negative
  hand: Hand;
  level: Level;
  buzz: boolean;
  note: Note;
}

const FLAM_GAP = 0.03, DRAG_GAP = 0.035;   // s between a grace and what follows it

// One rudiment at one tempo: stroke n, for any n ≥ 0, looping the cycle forever.
export class Timeline {
  readonly perCycle: number;
  readonly cycleSec: number;
  private readonly cycle: Omit<Stroke, 'n'>[];

  constructor(readonly pattern: Pattern, readonly spb: number) {
    this.cycleSec = pattern.beats * spb;
    const ns = pattern.notes;
    this.cycle = ns.flatMap((note, i) => {
      const at = note.start * spb;
      const main = { time: at, hand: note.hand, level: (note.accent ? 'accent' : 'tap') as Level, buzz: note.buzz, note };
      if (!note.graces) return [main];
      // graces sit inside the gap to the previous note, never on top of it
      const prev = ns[(i - 1 + ns.length) % ns.length]!;
      const gapSec = (((note.start - prev.start) % pattern.beats) + pattern.beats) % pattern.beats * spb || this.cycleSec;
      const step = Math.min(note.graces > 1 ? DRAG_GAP : FLAM_GAP, (gapSec * 0.8) / (note.graces + 1));
      const graces = Array.from({ length: note.graces }, (_, k) => ({
        time: at - step * (note.graces - k), hand: note.hand === 'R' ? 'L' as Hand : 'R' as Hand, level: 'grace' as Level, buzz: false, note,
      }));
      return [...graces, main];
    });
    this.perCycle = this.cycle.length;
  }

  stroke(n: number): Stroke {
    const c = Math.floor(n / this.perCycle), s = this.cycle[n - c * this.perCycle]!;
    return { ...s, n, time: s.time + c * this.cycleSec };
  }

  // the first stroke whose time is at or after t
  indexAt(t: number): number {
    const c = Math.floor(t / this.cycleSec);
    let n = Math.max(0, (c - 1) * this.perCycle);
    while (this.stroke(n).time < t) n++;
    return n;
  }
}
