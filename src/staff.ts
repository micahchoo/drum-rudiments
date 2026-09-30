// One cycle of the rudiment, engraved the way the PAS chart writes it: a one-line
// percussion staff, stems up, beamed by the beat, sticking underneath. A cursor walks
// it in time with the lane.

import type { Note, Pattern } from './notation';
import { fit2d, FONT, HAND_COLOR } from './canvas';

const INK = '#d9d7d2';
const BEAMS: Record<Note['value'], number> = { q: 0, '8': 1, '16': 2, '32': 3 };
const EPS = 1e-9;

interface Rest { start: number; dur: number }
interface Placed { x: number; start: number }

function rests(p: Pattern): Rest[] {
  const out: Rest[] = [], ns = p.notes;
  ns.forEach((n, i) => {
    const end = n.start + n.dur, next = i + 1 < ns.length ? ns[i + 1]!.start : p.beats;
    if (next - end > EPS) out.push({ start: end, dur: next - end });
  });
  return out;
}

// x positions: each item is given room by the square root of its length, as engravers do
function layout(p: Pattern, left: number, right: number) {
  const items = [...p.notes.map(n => ({ start: n.start, dur: n.dur, graces: n.graces })), ...rests(p).map(r => ({ ...r, graces: 0 }))]
    .sort((a, b) => a.start - b.start);
  const room = items.map(it => 18 + 56 * Math.sqrt(it.dur) + 11 * it.graces);
  const scale = (right - left) / room.reduce((a, b) => a + b, 0);
  let x = left;
  const placed: Placed[] = items.map((it, i) => { const at = x + (11 * it.graces + 9) * scale; x += room[i]! * scale; return { x: at, start: it.start }; });
  return { placed, scale, end: right };
}

function xAt(placed: Placed[], beats: number, end: number, beat: number) {
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i]!, b = placed[i + 1] ?? { x: end, start: beats };
    if (beat < b.start || i === placed.length - 1) return a.x + (b.x - a.x) * Math.min(1, Math.max(0, (beat - a.start) / (b.start - a.start)));
  }
  return end;
}

export function drawStaff(cv: HTMLCanvasElement, p: Pattern, beat: number | null) {
  const [g, w, h] = fit2d(cv);
  const left = 64, right = w - 40, lineY = Math.round(h * 0.6), stemTop = lineY - 38;
  const { placed, end } = layout(p, left, right);
  const xOf = (start: number) => placed.find(q => Math.abs(q.start - start) < EPS)!.x;

  // staff, clef, end barline
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(22, lineY); g.lineTo(w - 22, lineY); g.stroke();
  g.fillStyle = INK; g.fillRect(32, lineY - 12, 3, 24); g.fillRect(38, lineY - 12, 3, 24);
  g.fillRect(w - 28, lineY - 14, 1.2, 28); g.fillRect(w - 25, lineY - 14, 3.5, 28);

  // where are we
  let current = -1;
  if (beat !== null) {
    const x = xAt(placed, p.beats, end, beat);
    g.fillStyle = 'rgba(236,235,231,.06)'; g.fillRect(x - 14, 26, 28, h - 34);
    g.fillStyle = 'rgba(236,235,231,.35)'; g.fillRect(x - 0.5, 26, 1, h - 34);
    p.notes.forEach((n, i) => { if (n.start <= beat + EPS) current = i; });
  }

  // rests
  for (const r of rests(p)) {
    const x = xOf(r.start);
    g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 1.6;
    if (r.dur >= 1 - EPS) {   // quarter rest
      g.beginPath(); g.moveTo(x - 2, lineY - 14); g.lineTo(x + 3, lineY - 7); g.lineTo(x - 2, lineY - 1); g.lineTo(x + 3, lineY + 6);
      g.quadraticCurveTo(x - 5, lineY + 3, x, lineY + 12); g.stroke();
    } else {                   // eighth rest
      g.beginPath(); g.arc(x - 2, lineY - 6, 2.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(x - 2, lineY - 4); g.quadraticCurveTo(x + 2, lineY - 3, x + 4, lineY - 8); g.lineTo(x - 1, lineY + 8); g.stroke();
    }
  }

  // notes
  p.notes.forEach((n, i) => {
    const x = xOf(n.start), on = i === current, col = HAND_COLOR[n.hand];
    g.fillStyle = on ? col : INK; g.strokeStyle = on ? col : INK;
    if (on) { g.shadowColor = col; g.shadowBlur = 14; }
    g.beginPath(); g.ellipse(x, lineY, 6.2, 4.6, -0.35, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 5.6, lineY - 1.5); g.lineTo(x + 5.6, stemTop); g.stroke();
    if (n.buzz) { g.lineWidth = 1.3; g.beginPath(); g.moveTo(x + 1.5, lineY - 22); g.lineTo(x + 9.5, lineY - 22); g.lineTo(x + 1.5, lineY - 15); g.lineTo(x + 9.5, lineY - 15); g.stroke(); }
    if (n.accent) { g.lineWidth = 1.6; g.strokeStyle = INK; g.beginPath(); g.moveTo(x - 3, stemTop - 24); g.lineTo(x + 7, stemTop - 20); g.lineTo(x - 3, stemTop - 16); g.stroke(); }
    if (n.graces) graces(g, x, lineY, n);
    g.fillStyle = col; g.globalAlpha = on || current < 0 ? 1 : 0.8;
    g.font = `600 13px ${FONT}`; g.textAlign = 'center'; g.fillText(n.hand, x, lineY + 26); g.globalAlpha = 1;
  });

  // beams by the beat; a note alone in its beat gets flags
  g.fillStyle = INK; g.strokeStyle = INK;
  const groups: Note[][] = [];
  p.notes.forEach((n, i) => {
    if (n.value === 'q') return;
    const prev = p.notes[i - 1], last = groups[groups.length - 1];
    const joined = prev && last && last[last.length - 1] === prev && Math.floor(prev.start + EPS) === Math.floor(n.start + EPS) && Math.abs(prev.start + prev.dur - n.start) < EPS;
    if (joined) last.push(n); else groups.push([n]);
  });
  for (const grp of groups) {
    const sx = (n: Note) => xOf(n.start) + 5.6;
    if (grp.length === 1) {
      const n = grp[0]!;
      for (let k = 0; k < BEAMS[n.value]; k++) {
        g.lineWidth = 1.6; g.beginPath(); const y = stemTop + k * 6;
        g.moveTo(sx(n), y); g.quadraticCurveTo(sx(n) + 9, y + 7, sx(n) + 7, y + 15); g.stroke();
      }
      continue;
    }
    for (let level = 1; level <= 3; level++) {
      const y = stemTop + (level - 1) * 6;
      for (let i = 0; i < grp.length; i++) {
        if (BEAMS[grp[i]!.value] < level) continue;
        let j = i; while (j + 1 < grp.length && BEAMS[grp[j + 1]!.value] >= level) j++;
        const a = sx(grp[i]!), b = sx(grp[j]!);
        if (j > i) g.fillRect(a - 0.7, y, b - a + 1.4, 3.6);
        else { const toward = i + 1 < grp.length ? 1 : -1; g.fillRect(toward > 0 ? a - 0.7 : a - 8, y, 8.7, 3.6); }   // a stub
        i = j;
      }
    }
    // tuplet numbers, one per tuplet unit
    let unit: Note[] = [], span = 0;
    const flush = () => {
      if (!unit.length) return;
      const a = sx(unit[0]!), b = sx(unit[unit.length - 1]!);
      g.font = `italic 600 11px ui-serif,Georgia,serif`; g.textAlign = 'center';
      g.fillText(String(unit[0]!.tuplet), (a + b) / 2, stemTop - 5);
      unit = []; span = 0;
    };
    for (const n of grp) {
      if (!n.tuplet) { flush(); continue; }
      if (!unit.length) span = n.tuplet === 6 || n.value === '8' ? 1 : 0.5;
      unit.push(n);
      if (unit.reduce((s, u) => s + u.dur, 0) >= span - EPS) flush();
    }
    flush();
  }
}

// a flam is one small slashed note; a drag, two small beamed ones
function graces(g: CanvasRenderingContext2D, x: number, lineY: number, n: Note) {
  const hand = n.hand === 'R' ? 'L' : 'R', xs = n.graces === 1 ? [x - 14] : [x - 23, x - 13];
  g.fillStyle = INK; g.strokeStyle = INK; g.lineWidth = 1;
  for (const gx of xs) {
    g.beginPath(); g.ellipse(gx, lineY + 1, 3.6, 2.7, -0.35, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(gx + 3.2, lineY); g.lineTo(gx + 3.2, lineY - 20); g.stroke();
  }
  const top = lineY - 20, a = xs[0]! + 3.2, b = xs[xs.length - 1]! + 3.2;
  if (xs.length === 1) { g.beginPath(); g.moveTo(a, top); g.quadraticCurveTo(a + 6, top + 5, a + 5, top + 10); g.stroke(); }
  else { g.fillRect(a, top, b - a, 2); g.fillRect(a, top + 4, b - a, 2); }
  g.beginPath(); g.moveTo(a - 4, top + 12); g.lineTo(b + 4, top + 2); g.stroke();      // the slash
  g.fillStyle = HAND_COLOR[hand]; g.font = `600 10px ${FONT}`; g.textAlign = 'center';
  g.fillText(hand.toLowerCase(), (xs[0]! + xs[xs.length - 1]!) / 2, lineY + 26);
}
