// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// Plane geometry, in photo pixels. Pure maths: no page, no clock, no randomness.
//
// What is a homography? It is a 3x3 matrix that maps points on one flat
// surface to another as a camera sees them, perspective included. If we know
// where four points of the floor land in the photo (the corners of a sheet of
// paper of known size), we can solve for it and turn any photo pixel on the
// floor into millimetres on the floor.

/** A point. `s` is how uncertain the tap was (one standard deviation, photo
 * pixels). It is stored on the point so the error bar does not change if the
 * window is resized later. */
export type Pt = { x: number; y: number; s?: number };

/** A 3x3 matrix written row by row. */
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

/** Solve A x = b by Gaussian elimination with partial pivoting.
 * Returns null when the equations have no single answer. */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let best = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(m[r][col]) > Math.abs(m[best][col])) best = r;
    if (Math.abs(m[best][col]) < 1e-12) return null;
    [m[col], m[best]] = [m[best], m[col]];
    for (let r = col + 1; r < n; r++) {
      const k = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= k * m[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = m[r][n];
    for (let c = r + 1; c < n; c++) sum -= m[r][c] * x[c];
    x[r] = sum / m[r][r];
  }
  return x;
}

/** Matrix product p * q. */
function mul(p: Mat3, q: Mat3): Mat3 {
  const out: number[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out.push(p[r * 3] * q[c] + p[r * 3 + 1] * q[3 + c] + p[r * 3 + 2] * q[6 + c]);
  return out as unknown as Mat3;
}

const centroid = (pts: Pt[]) => ({
  cx: pts.reduce((t, p) => t + p.x, 0) / pts.length,
  cy: pts.reduce((t, p) => t + p.y, 0) / pts.length,
});

/** The homography that takes four photo points (`src`) to four plane points
 * (`dst`). Both sets are centred and scaled before solving, which keeps the
 * arithmetic stable for pixel-sized numbers. Null when the four points do not
 * define a map (for example, three of them in a line). */
export function solveHomography(src: Pt[], dst: Pt[]): Mat3 | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  const norm = (pts: Pt[]) => {
    const { cx, cy } = centroid(pts);
    const spread = Math.sqrt(
      pts.reduce((t, p) => t + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / 8,
    );
    return { cx, cy, s: spread };
  };
  const ns = norm(src);
  const nd = norm(dst);
  if (!(ns.s > 0) || !(nd.s > 0)) return null;

  // Two equations per point pair, eight unknowns (the ninth entry is fixed at 1).
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const x = (src[i].x - ns.cx) / ns.s;
    const y = (src[i].y - ns.cy) / ns.s;
    const u = (dst[i].x - nd.cx) / nd.s;
    const v = (dst[i].y - nd.cy) / nd.s;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(a, b);
  if (!h) return null;
  const core: Mat3 = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];

  // Undo the centring and scaling.
  const ts: Mat3 = [1 / ns.s, 0, -ns.cx / ns.s, 0, 1 / ns.s, -ns.cy / ns.s, 0, 0, 1];
  const tdInv: Mat3 = [nd.s, 0, nd.cx, 0, nd.s, nd.cy, 0, 0, 1];
  const out = mul(tdInv, mul(core, ts));

  // Scale so the third coordinate (w) is exactly 1 at the middle of the sheet.
  // A point where w is zero or negative is at or past the floor's horizon.
  const wc = out[6] * ns.cx + out[7] * ns.cy + out[8];
  if (!Number.isFinite(wc) || Math.abs(wc) < 1e-12) return null;
  const scaled = out.map((v) => v / wc) as unknown as Mat3;
  return scaled.every(Number.isFinite) ? scaled : null;
}

/** Map a photo point onto the plane. Null at or beyond the horizon. */
export function applyHomography(h: Mat3, p: Pt): Pt | null {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  if (!Number.isFinite(w) || w < 1e-6) return null;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Distance on the plane (mm) between two photo points, or null. */
export function planeDistance(h: Mat3, a: Pt, b: Pt): number | null {
  const pa = applyHomography(h, a);
  const pb = applyHomography(h, b);
  return pa && pb ? dist(pa, pb) : null;
}
