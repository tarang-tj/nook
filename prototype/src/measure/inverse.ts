// The plane map backwards: from floor millimetres to photo pixels. The page
// needs it to draw something that exists only on the floor (the footprint of
// a thing being tried for fit) onto the photo. Pure maths.
import { applyHomography, type Mat3, type Pt } from "./homography";

/** The inverse of a 3x3 matrix (cofactors over the determinant), or null
 * when it has none. */
export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const scale = Math.max(...m.map(Math.abs));
  if (!Number.isFinite(det) || !(scale > 0) || Math.abs(det) < 1e-14 * scale ** 3) return null;
  const out = [
    A, c * h - b * i, b * f - c * e,
    B, a * i - c * g, c * d - a * f,
    C, b * g - a * h, a * e - b * d,
  ].map((v) => v / det);
  return out.every(Number.isFinite) ? (out as unknown as Mat3) : null;
}

/** Floor positions (mm) to photo pixels through the inverse of a plane map.
 * Null when the map has no inverse or a point lies behind the camera. */
export function floorToPhoto(h: Mat3, floor: Pt[]): Pt[] | null {
  const inverse = invert3(h);
  if (!inverse) return null;
  const out: Pt[] = [];
  for (const p of floor) {
    // The true inverse keeps the sign of the third coordinate, so the same
    // "in front of the camera" test works in this direction too.
    const q = applyHomography(inverse, p);
    if (!q) return null;
    out.push(q);
  }
  return out;
}
