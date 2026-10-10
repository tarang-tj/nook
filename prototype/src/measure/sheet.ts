// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// From four taps on the corners of the sheet to a solved floor plane.
import { dist, solveHomography, type Mat3, type Pt } from "./homography";

/** Put four taps, made in any order, into one consistent order: clockwise on
 * screen, starting at the corner nearest the top left. */
export function orderCorners(points: Pt[]): Pt[] {
  if (points.length !== 4) return [...points];
  const cx = points.reduce((t, p) => t + p.x, 0) / 4;
  const cy = points.reduce((t, p) => t + p.y, 0) / 4;
  const byAngle = [...points].sort(
    (p, q) =>
      Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx) ||
      p.x - q.x ||
      p.y - q.y,
  );
  let first = 0;
  for (let i = 1; i < 4; i++) {
    const a = byAngle[i];
    const b = byAngle[first];
    if (
      a.x + a.y < b.x + b.y - 1e-9 ||
      (Math.abs(a.x + a.y - b.x - b.y) <= 1e-9 &&
        (a.y < b.y || (a.y === b.y && a.x < b.x)))
    )
      first = i;
  }
  return [0, 1, 2, 3].map((i) => byAngle[(first + i) % 4]);
}

export type Degenerate =
  | "needs four corners"
  | "corners overlap or are nearly in a line"
  | "corners do not form a convex four-sided shape"
  | "the sheet is too small in the photo to measure from";

/** Why four ordered corners cannot define the floor, or null when they can.
 * Rejects overlapping taps, three corners nearly in a line (a turn of under
 * about 3 degrees), a dented shape, and a tiny area. */
export function degenerateReason(ordered: Pt[], minArea = 100): Degenerate | null {
  if (ordered.length !== 4) return "needs four corners";
  let sign = 0;
  let area2 = 0;
  for (let i = 0; i < 4; i++) {
    const a = ordered[i];
    const b = ordered[(i + 1) % 4];
    const c = ordered[(i + 2) % 4];
    const ab = dist(a, b);
    const bc = dist(b, c);
    if (ab < 2 || bc < 2) return "corners overlap or are nearly in a line";
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) / (ab * bc) < 0.05)
      return "corners overlap or are nearly in a line";
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign)
      return "corners do not form a convex four-sided shape";
    area2 += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area2) / 2 < minArea
    ? "the sheet is too small in the photo to measure from"
    : null;
}

export type Sheet = {
  /** The four corners in photo pixels, ordered. */
  ordered: Pt[];
  /** The same corners on the floor, in millimetres. */
  plane: Pt[];
  /** Photo pixels to floor millimetres. */
  h: Mat3;
};

/** Solve the floor plane from ordered corners and the sheet's side lengths in
 * mm. The app cannot see which side of the paper is the long one, so it
 * guesses: the pair of opposite sides that looks longer in the photo is taken
 * as the long side. `swap` flips that guess (needed when the sheet's long
 * side points away from the camera and looks short). */
export function solveSheet(
  ordered: Pt[],
  long: number,
  short: number,
  swap: boolean,
): Sheet | null {
  if (ordered.length !== 4 || degenerateReason(ordered)) return null;
  const first = (dist(ordered[0], ordered[1]) + dist(ordered[3], ordered[2])) / 2;
  const second = (dist(ordered[1], ordered[2]) + dist(ordered[0], ordered[3])) / 2;
  const firstIsLong = first >= second !== swap;
  const w = firstIsLong ? long : short;
  const d = firstIsLong ? short : long;
  const plane = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
  const h = solveHomography(ordered, plane);
  return h ? { ordered, plane, h } : null;
}
