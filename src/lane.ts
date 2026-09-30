// The lane: strokes fall toward the hit line, L on the left, R on the right, as the
// player sits. Size says loudness: an accent is wide, a tap narrow, a grace a dot.

import type { Timeline } from './notation';
import type { Verdict } from './judge';
import { fit2d, FONT, HAND_COLOR, JUDGE_COLOR } from './canvas';

export interface LaneState {
  t: number;                                  // seconds from beat 0
  playing: boolean;
  verdicts: Map<number, Verdict> | null;      // null in Watch mode
  popup: { text: string; color: string; age: number } | null;
}

export function drawLane(cv: HTMLCanvasElement, tl: Timeline, s: LaneState) {
  const [g, w, h] = fit2d(cv);
  const pad = 26, laneW = (w - pad * 2) / 2, x0 = pad, hitY = h - 78;
  const spb = tl.spb, look = Math.min(6, Math.max(1.6, 2.5 * spb)), pps = (hitY - 44) / look;
  const xOf = (hand: 'L' | 'R') => (hand === 'L' ? x0 : x0 + laneW);

  for (const hand of ['L', 'R'] as const) {
    const grd = g.createLinearGradient(0, 0, 0, hitY);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, hand === 'L' ? 'rgba(74,168,255,.07)' : 'rgba(255,138,76,.07)');
    g.fillStyle = grd; g.fillRect(xOf(hand) + 3, 0, laneW - 6, hitY);
  }

  // beat lines, with the count
  const beats = tl.pattern.beats;
  g.font = `500 10px ${FONT}`; g.textAlign = 'right';
  for (let b = Math.floor(s.t / spb) - 2; b * spb - s.t < look + 0.2; b++) {
    const y = hitY - (b * spb - s.t) * pps;
    if (y < 30 || y > h) continue;
    const inCycle = ((b % beats) + beats) % beats;
    g.strokeStyle = inCycle === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + laneW * 2, y); g.stroke();
    if (b >= 0) { g.fillStyle = '#4a5058'; g.fillText(String(inCycle + 1), x0 - 8, y + 3); }
  }

  const flash = s.popup ? Math.max(0, 1 - s.popup.age / 0.18) : 0;
  g.fillStyle = `rgba(236,235,231,${0.35 + flash * 0.5})`;
  g.beginPath(); g.roundRect(x0, hitY - 1.5, laneW * 2, 3, 2); g.fill();

  for (let n = Math.max(0, tl.indexAt(s.t - 0.6)); ; n++) {
    const st = tl.stroke(n), dt = st.time - s.t;
    if (dt > look + 0.1) break;
    const y = hitY - dt * pps, v = s.verdicts?.get(n), col = HAND_COLOR[st.hand], cx = xOf(st.hand) + laneW / 2;
    const glow = dt < 0 && dt > -0.15 ? 1 + dt / 0.15 : 0;
    const missed = v && (v.result === 'miss' || v.result === 'flat');
    g.globalAlpha = missed ? 0.18 : dt < 0 ? 0.35 + glow * 0.65 : 1;
    g.shadowColor = col; g.shadowBlur = 6 + glow * 22; g.fillStyle = col;
    if (st.level === 'grace') {
      g.beginPath(); g.arc(cx - laneW * 0.24, y, 4.5, 0, Math.PI * 2); g.fill();
    } else {
      const gw = laneW * (st.level === 'accent' ? 0.78 : 0.46), gh = st.level === 'accent' ? 18 : 10;
      g.beginPath(); g.roundRect(cx - gw / 2, y - gh / 2, gw, gh, gh / 2); g.fill();
      g.shadowBlur = 0;
      if (st.buzz) {  // a buzz: a zigzag through the gem
        g.strokeStyle = 'rgba(11,13,16,.8)'; g.lineWidth = 1.5; g.beginPath();
        for (let i = 0; i <= 6; i++) g.lineTo(cx - gw / 2 + 6 + i * (gw - 12) / 6, y + (i % 2 ? -2.5 : 2.5));
        g.stroke();
      }
      if (st.level === 'accent') { g.fillStyle = 'rgba(11,13,16,.85)'; g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.fillText('>', cx, y + 4.5); }
    }
    g.shadowBlur = 0;
    if (v && !missed) { g.strokeStyle = JUDGE_COLOR[v.result]; g.lineWidth = 2; g.beginPath(); g.arc(cx, y, st.level === 'accent' ? 16 : 11, 0, Math.PI * 2); g.stroke(); }
    g.globalAlpha = 1;
  }

  g.font = `600 13px ${FONT}`; g.textAlign = 'center';
  for (const hand of ['L', 'R'] as const) { g.fillStyle = HAND_COLOR[hand]; g.fillText(hand, xOf(hand) + laneW / 2, hitY + 34); }

  if (s.popup && s.popup.age < 0.65) {
    const k = s.popup.age / 0.65;
    g.globalAlpha = 1 - k; g.fillStyle = s.popup.color; g.font = `600 15px ${FONT}`;
    g.fillText(s.popup.text, w / 2, hitY - 26 - k * 10); g.globalAlpha = 1;
  }
  if (s.playing && s.t < 0) {
    g.fillStyle = 'rgba(236,235,231,.9)'; g.font = `600 ${Math.round(w * 0.28)}px ${FONT}`;
    g.fillText(String(Math.ceil(-s.t / spb)), w / 2, h * 0.45);
  }
}
