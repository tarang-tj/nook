// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// How far a candidate plane map misses each known size. Every miss is divided
// by its own standard deviation, so a corner tap and a typed length can be
// weighed against each other without a hand-set weight:
//   - a sheet corner: where the map says the corner should be in the photo,
//     minus where it was tapped, over the tap uncertainty;
//   - a known length: the length the map gives minus the typed length, over
//     the tap uncertainty of both ends carried onto the floor.
// Everything here is in centred, scaled coordinates so the numbers are of
// order one. Pure maths: no page, no clock, no randomness.
import { applyHomography, dist, type Mat3, type Pt } from "./homography";

/** Centre and spread of a point set: a coordinate becomes (v - c) / s. */
export type Norm = { cx: number; cy: number; s: number };

export function normOf(pts: Pt[]): Norm | null {
  const cx = pts.reduce((t, p) => t + p.x, 0) / pts.length;
  const cy = pts.reduce((t, p) => t + p.y, 0) / pts.length;
  const s = Math.sqrt(
    pts.reduce((t, p) => t + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / (2 * pts.length),
  );
  return s > 0 && Number.isFinite(s) ? { cx, cy, s } : null;
}

/** A tap with its uncertainty filled in. */
export type Tap = { x: number; y: number; s: number };
/** Four taps and the sheet's own corners, in the same order. */
export type Rect = { taps: Tap[]; plane: Pt[] };
/** A known length: two taps, the length, and one sd of that length. */
export type Span = { a: Tap; b: Tap; len: number; sd: number };
export type Scaled = { first: Rect; rects: Rect[]; spans: Span[] };

/** The first eight unknowns as a plane map (the ninth entry is fixed at 1). */
export const core = (p: number[]): Mat3 => [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], 1];

/** Inverse of a 3x3 matrix, or null when it has none. */
export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) + b * (f * g - d * i) + c * (d * h - e * g);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-300) return null;
  return [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}

/** A floor point back into the photo through `g`, the inverse of `h`. Null
 * when the point is at or beyond the horizon. */
function toPhoto(g: Mat3, h: Mat3, x: number, y: number): Pt | null {
  const w = g[6] * x + g[7] * y + g[8];
  const px = (g[0] * x + g[1] * y + g[2]) / w;
  const py = (g[3] * x + g[4] * y + g[5]) / w;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  return h[6] * px + h[7] * py + h[8] > 1e-6 ? { x: px, y: py } : null;
}

/** One sd of a known length as the map `h` reads it: each end's tap sd moved
 * along both photo axes. Worked out once, at the start of a solve, and held
 * fixed so the thing being minimised does not change shape under the solver. */
export function spanSd(h: Mat3, a: Tap, b: Tap): number | null {
  let variance = 0;
  for (const [end, other] of [[a, b], [b, a]]) {
    const e = end.s / 2;
    for (const [dx, dy] of [[e, 0], [0, e]]) {
      const up = applyHomography(h, { x: end.x + dx, y: end.y + dy });
      const down = applyHomography(h, { x: end.x - dx, y: end.y - dy });
      const far = applyHomography(h, other);
      if (!up || !down || !far) return null;
      variance += (dist(up, far) - dist(down, far)) ** 2;
    }
  }
  return variance > 0 && Number.isFinite(variance) ? Math.sqrt(variance) : null;
}

/** Fill `r` with every miss, in standard deviations. The unknowns `p` are the
 * map's eight numbers, then for each further sheet where it lies on the floor
 * (two offsets and a turn). False when a point has no place on the floor. */
export function residuals(p: number[], sc: Scaled, r: Float64Array): boolean {
  const h = core(p);
  const g = invert3(h);
  if (!g) return false;
  let at = 0;
  const corner = (x: number, y: number, tap: Tap): boolean => {
    const q = toPhoto(g, h, x, y);
    if (!q) return false;
    r[at++] = (q.x - tap.x) / tap.s;
    r[at++] = (q.y - tap.y) / tap.s;
    return true;
  };
  for (let k = 0; k < 4; k++)
    if (!corner(sc.first.plane[k].x, sc.first.plane[k].y, sc.first.taps[k])) return false;
  for (let j = 0; j < sc.rects.length; j++) {
    const rect = sc.rects[j];
    const tx = p[8 + 3 * j];
    const ty = p[9 + 3 * j];
    const cos = Math.cos(p[10 + 3 * j]);
    const sin = Math.sin(p[10 + 3 * j]);
    for (let k = 0; k < 4; k++) {
      const c = rect.plane[k];
      if (!corner(tx + c.x * cos - c.y * sin, ty + c.x * sin + c.y * cos, rect.taps[k]))
        return false;
    }
  }
  for (const s of sc.spans) {
    const pa = applyHomography(h, s.a);
    const pb = applyHomography(h, s.b);
    if (!pa || !pb) return false;
    r[at++] = (dist(pa, pb) - s.len) / s.sd;
  }
  return true;
}

/** Where each further sheet lies as the map `h` sees it: the offset and turn
 * that best lay its known rectangle over its four mapped taps. This is only
 * the starting guess; the solve moves it. Null when a tap is past the horizon. */
export function poses(h: Mat3, rects: Rect[]): number[] | null {
  const out: number[] = [];
  for (const rect of rects) {
    const q: Pt[] = [];
    for (const tap of rect.taps) {
      const at = applyHomography(h, tap);
      if (!at) return null;
      q.push(at);
    }
    const mean = (pts: Pt[], k: "x" | "y") => pts.reduce((t, v) => t + v[k], 0) / pts.length;
    const cx = mean(rect.plane, "x");
    const cy = mean(rect.plane, "y");
    const qx = mean(q, "x");
    const qy = mean(q, "y");
    let dot = 0;
    let cross = 0;
    rect.plane.forEach((c, k) => {
      dot += (c.x - cx) * (q[k].x - qx) + (c.y - cy) * (q[k].y - qy);
      cross += (c.x - cx) * (q[k].y - qy) - (c.y - cy) * (q[k].x - qx);
    });
    const turn = Math.atan2(cross, dot);
    out.push(
      qx - (cx * Math.cos(turn) - cy * Math.sin(turn)),
      qy - (cx * Math.sin(turn) + cy * Math.cos(turn)),
      turn,
    );
  }
  return out;
}
