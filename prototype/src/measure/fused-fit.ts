// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// From taps in photo pixels to the scaled problem the search works on, and
// back to a map in photo pixels and millimetres. Pure.
import { mul, solveHomography, type Mat3, type Pt } from "./homography";
import { core, normOf, poses, spanSd, type Rect, type Scaled, type Tap } from "./fused-residuals";
import { refine, type Refined } from "./fused-solve";
import { TAP_SIGMA_SCREEN_PX } from "./monte-carlo";
import type { Sheet } from "./sheet";

/** The known sizes must miss each other by more than this many times what tap
 * error explains before the solve refuses. Chance alone almost never does
 * that; a wrong paper size or a mistyped length does. */
export const CONFLICT_SDS = 5;

/** A tap's uncertainty in photo pixels. A tap that carries none gets the same
 * fallback measureFloorDistance uses. */
export const sigmaOf = (p: Pt): number =>
  p.s !== undefined && p.s > 0 ? p.s : TAP_SIGMA_SCREEN_PX;

/** A known size beyond the first sheet. */
export type Extra =
  | { name: string; kind: "sheet"; taps: Pt[]; plane: Pt[] }
  | { name: string; kind: "span"; a: Pt; b: Pt; mm: number };

/** How much of the first sheet's perspective each attempt starts with. The
 * first sheet read alone, with sloppy taps, can put the floor's horizon in
 * front of a far reference, which is no place to start a search from. A start
 * with less perspective has its horizon further off (none at all at 0), and
 * the search then puts the perspective back from all the known sizes. */
const STARTS = [1, 0.5, 0];

const NOT_A_FLOOR = "The known sizes do not describe one flat floor seen by a camera.";

/** The best map for the first sheet plus `extras`, and how badly the known
 * sizes disagree there (about 1 when they agree as well as tap error allows).
 * A string is the reason there is no map. */
export function fit(sheet: Sheet, extras: Extra[]): { h: Mat3; chi: number } | string {
  const image = normOf(sheet.ordered);
  const plane = normOf(sheet.plane);
  if (!image || !plane) return NOT_A_FLOOR;
  const tap = (t: Pt): Tap => ({
    x: (t.x - image.cx) / image.s,
    y: (t.y - image.cy) / image.s,
    s: sigmaOf(t) / image.s,
  });
  const first: Rect = {
    taps: sheet.ordered.map(tap),
    plane: sheet.plane.map((c) => ({ x: (c.x - plane.cx) / plane.s, y: (c.y - plane.cy) / plane.s })),
  };
  const alone = solveHomography(first.taps, first.plane);
  if (!alone) return NOT_A_FLOOR;
  const rects: Rect[] = [];
  const lengths: { a: Tap; b: Tap; len: number }[] = [];
  for (const e of extras) {
    // A further sheet is only scaled, not centred: where it lies is an unknown.
    if (e.kind === "sheet")
      rects.push({ taps: e.taps.map(tap), plane: e.plane.map((c) => ({ x: c.x / plane.s, y: c.y / plane.s })) });
    else lengths.push({ a: tap(e.a), b: tap(e.b), len: e.mm / plane.s });
  }
  const spare = 8 * rects.length + lengths.length - 3 * rects.length;
  const chiOf = (r: Refined) => (spare > 0 ? Math.sqrt(Math.max(0, r.cost) / spare) : 0);

  let best: Refined | null = null;
  for (const ease of STARTS) {
    const eight = alone.slice(0, 8).map((v, i) => (v / alone[8]) * (i >= 6 ? ease : 1));
    const from = core(eight);
    const lie = poses(from, rects);
    const spans = lengths.map((l) => ({ ...l, sd: spanSd(from, l.a, l.b) }));
    if (!lie || spans.some((s) => s.sd === null)) continue;
    const sc: Scaled = { first, rects, spans: spans as Scaled["spans"] };
    const got = refine(sc, [...eight, ...lie]);
    if (got && (!best || got.cost < best.cost)) best = got;
    // Good enough: the known sizes agree, so there is no need to try again.
    if (best && chiOf(best) <= CONFLICT_SDS) break;
  }
  if (!best) return NOT_A_FLOOR;

  // Back from scaled coordinates to photo pixels in, millimetres out.
  const toScaled: Mat3 = [1 / image.s, 0, -image.cx / image.s, 0, 1 / image.s, -image.cy / image.s, 0, 0, 1];
  const toMm: Mat3 = [plane.s, 0, plane.cx, 0, plane.s, plane.cy, 0, 0, 1];
  const h = mul(toMm, mul(core(best.p), toScaled));
  return h.every(Number.isFinite) ? { h, chi: chiOf(best) } : NOT_A_FLOOR;
}
