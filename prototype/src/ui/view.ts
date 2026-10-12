// The conversion between screen positions and photo pixels, which the taps
// depend on. Drawing lives in ./draw.
import type { Pt } from "../measure/homography";

/** How the photo sits in its box: photo pixel * scale + offset = screen px. */
export type Fit = { scale: number; dx: number; dy: number };

/** Fit the whole photo inside the box, centred, without cropping. */
export function fitContain(imgW: number, imgH: number, boxW: number, boxH: number): Fit {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  return { scale, dx: (boxW - imgW * scale) / 2, dy: (boxH - imgH * scale) / 2 };
}

export const toImage = (fit: Fit, x: number, y: number): Pt => ({
  x: (x - fit.dx) / fit.scale,
  y: (y - fit.dy) / fit.scale,
});

export const toScreen = (fit: Fit, p: Pt): Pt => ({
  x: p.x * fit.scale + fit.dx,
  y: p.y * fit.scale + fit.dy,
});

/** Index of the point within `radius` photo pixels of `p`, or -1. */
export function nearest(points: Pt[], p: Pt, radius: number): number {
  let best = -1;
  let bestD = radius;
  points.forEach((q, i) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}
