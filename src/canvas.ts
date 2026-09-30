// Shared 2D canvas helpers: size the backing store to the element, crisp on any screen.

export function fit2d(cv: HTMLCanvasElement): [CanvasRenderingContext2D, number, number] {
  const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
  const W = Math.round(r.width * d), H = Math.round(r.height * d);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d')!;
  g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, r.width, r.height);
  return [g, r.width, r.height];
}

export const HAND_COLOR = { R: '#ff8a4c', L: '#4aa8ff' } as const;
export const FONT = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif';
export const JUDGE_COLOR = { perfect: '#5fe0a0', good: '#c2e05a', ok: '#f0c64a', miss: '#ff5d5d', flat: '#ff5d5d', extra: '#ff5d5d' } as const;
