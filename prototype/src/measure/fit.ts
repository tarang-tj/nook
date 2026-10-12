// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// "Will it fit", on the floor only. A gap with an error bar is compared with
// the size of the thing, and the answer is only "fits" or "does not fit" when
// the whole bar is on one side. Otherwise it says "too close to call".
// Height is not here: one photo and a flat sheet cannot see it, so a thing
// that fits on the floor may still not fit under a shelf.
import type { Pt } from "./homography";
import { formatMeasured, roundOutward } from "./format";
import { measured } from "./noise";
import { outlineProblem, segmentsCross } from "./outline";
import type { Bar } from "./spread";
import { fromMm, toMm, type Unit } from "./units";

/** What a verdict rests on, word for word. The counts are from
 * tests/fit.test.ts, which retakes a made-up scene 300 times. */
export const FIT_BASIS =
  "Floor only: this compares sizes on the floor and says nothing about height, doors or stairs. " +
  "It says fits or does not fit only when the whole error bar, as written, is on one side, and too close to call otherwise. " +
  "In simulated retakes of a made-up scene, a thing 2 cm off the true gap got the wrong call in at most 2 retakes in 100. " +
  "The error bar covers tap placement only, and this method has not yet been checked against a tape measure.";

export type Gap ={ value: number; error: number } | { value: null; reason: string };

export type Verdict<Word extends string> =
  | { verdict: Word | "too close to call"; sentence: string; /** Past the bar's near edge, mm. Negative when short. */ spareMm: number }
  | { verdict: "cannot say"; sentence: string; reason: string };
export type FitVerdict = Verdict<"fits" | "does not fit">;
export type InsideVerdict = Verdict<"inside" | "outside">;

const cannot = (reason: string) => ({ verdict: "cannot say" as const, sentence: `Cannot say: ${reason}`, reason });
const plain = (mm: number, unit: Unit): string => `${Number(fromMm(mm, unit).toFixed(1))} ${unit}`;
const withError = (mm: number, errorMm: number, unit: Unit): string =>
  formatMeasured(measured(fromMm(mm, unit), fromMm(errorMm, unit), unit, ""));
const honest = (gap: Gap | Bar): gap is { value: number; error: number } =>
  gap.value !== null && Number.isFinite(gap.value) && Number.isFinite(gap.error) && gap.error >= 0;

const EPS = 1e-6; // closer than this counts as touching, mm
const HAIR = 1e-9; // rounding in a unit change, mm; far below EPS

/** The bar as it is written in the sentence, back in mm. It is never narrower
 * than the bar worked out, and the verdict is decided on it, so the words
 * never disagree with the figures printed beside them. */
function written(mm: number, errorMm: number, unit: Unit): { value: number; error: number } {
  if (errorMm === 0) return { value: mm, error: 0 };
  const shown = roundOutward(fromMm(mm, unit), fromMm(errorMm, unit));
  return { value: toMm(shown.value, unit), error: toMm(shown.error, unit) };
}

/** Compare a need with what is there. `yes` only when even the low end of the
 * bar is enough, `no` only when even the high end is not. */
function compare<Word extends string>(
  worked: number, workedError: number, need: number, yes: Word, no: Word, lead: string, unit: Unit,
): Verdict<Word> {
  const { value: have, error } = written(worked, workedError, unit);
  // Figures written in inches come back to mm a hair off; equal counts as reaching.
  if (have - error >= need - HAIR)
    return { verdict: yes, spareMm: have - error - need, sentence: `${lead}: ${yes}, with at least ${plain(have - error - need, unit)} to spare.` };
  if (have + error < need - HAIR)
    return { verdict: no, spareMm: have + error - need, sentence: `${lead}: ${no}, short by at least ${plain(need - have - error, unit)}.` };
  return {
    verdict: "too close to call",
    spareMm: have - error - need,
    sentence: `${lead}: too close to call. The difference (${plain(Math.abs(have - need), unit)}) is inside the error bar.`,
  };
}

/** Does a thing `sizeMm` across pass through a measured gap? `gap.error` is
 * the half-width of the gap's bar, mm. */
export function fitVerdict(gap: Gap | Bar, sizeMm: number, unit: Unit = "cm"): FitVerdict {
  if (gap.value === null) return cannot(gap.reason);
  if (!honest(gap)) return cannot("The gap has no honest number.");
  if (!Number.isFinite(sizeMm) || sizeMm <= 0) return cannot("The size of the thing is missing or is not above zero.");
  const lead = `The gap is ${withError(gap.value, gap.error, unit)} and the thing needs ${plain(sizeMm, unit)}`;
  return compare(gap.value, gap.error, sizeMm, "fits", "does not fit", lead, unit);
}

/** The four floor corners (mm) of a thing `widthMm` by `depthMm` centred on
 * `center` and turned by `angleRad`. Corner 0 is at minus half the width and
 * minus half the depth before the turn. */
export function footprint(center: Pt, widthMm: number, depthMm: number, angleRad: number): Pt[] {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
    const u = (i * widthMm) / 2;
    const v = (j * depthMm) / 2;
    return { x: center.x + u * c - v * s, y: center.y + u * s + v * c };
  });
}

const STEPS = 16; // points checked along each side of the footprint

function pointToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
const sides = (poly: Pt[]): [Pt, Pt][] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
const toBoundary = (p: Pt, poly: Pt[]): number =>
  Math.min(...sides(poly).map(([a, b]) => pointToSegment(p, a, b)));

/** Inside by counting how many sides a ray from the point crosses. */
function rayInside(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (const [a, b] of sides(poly))
    if (a.y > p.y !== b.y > p.y && p.x < a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x)) inside = !inside;
  return inside;
}

/** The room a footprint has inside an outline, mm. Positive: the smallest
 * distance from the footprint to any wall. Negative when any part is outside:
 * minus the furthest a checked point of the footprint's edge lies beyond the
 * outline (or how deep an inner corner of an L-shaped room pokes into it).
 * Where only a sliver pokes out it is just below zero, never positive.
 * The outline need not be convex. Wrap this in spreadOf to get its bar. */
export function clearance(foot: Pt[], outline: Pt[]): number {
  let over = 0;
  let out = false;
  const beyond = (d: number) => {
    out = true;
    over = Math.max(over, d);
  };
  for (const [a, b] of sides(foot))
    for (let i = 0; i < STEPS; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / STEPS, y: a.y + ((b.y - a.y) * i) / STEPS };
      const d = toBoundary(p, outline);
      if (d > EPS && !rayInside(p, outline)) beyond(d);
    }
  for (const corner of outline) {
    const d = toBoundary(corner, foot);
    if (d > EPS && rayInside(corner, foot)) beyond(d);
  }
  let gap = Infinity;
  for (const [a, b] of sides(foot))
    for (const [c, d] of sides(outline)) {
      // Sides cross although no checked point was outside: something thin
      // pokes through between them. How far is not known, only that it does.
      if (segmentsCross(a, b, c, d)) beyond(EPS);
      gap = Math.min(gap, pointToSegment(a, c, d), pointToSegment(b, c, d), pointToSegment(c, a, b), pointToSegment(d, a, b));
    }
  return out ? 0 - over : gap;
}

/** Is the footprint inside the outline with `clearanceMm` to spare all round?
 * `outlineErrorMm` is the half-width of the bar on the room it has, which
 * comes from the outline's taps: withBar(spreadOf(clearance of the footprint
 * in the re-tapped outline), "signed").error. */
export function insideOutline(
  foot: Pt[], outline: Pt[], outlineErrorMm: number, clearanceMm = 0, unit: Unit = "cm",
): InsideVerdict {
  const problem = outlineProblem(outline);
  if (problem) return cannot(problem);
  if (foot.length < 3 || !foot.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    return cannot("The thing has no footprint on the floor.");
  if (!Number.isFinite(outlineErrorMm) || outlineErrorMm < 0) return cannot("The outline has no honest error bar.");
  if (!Number.isFinite(clearanceMm) || clearanceMm < 0) return cannot("The clearance asked for is not a number at or above zero.");
  const room = clearance(foot, outline);
  if (!Number.isFinite(room)) return cannot("The room around the thing could not be worked out.");
  const lead =
    `The thing has ${withError(room, outlineErrorMm, unit)} of room inside the outline` +
    (clearanceMm > 0 ? ` and needs ${plain(clearanceMm, unit)}` : "");
  return compare(room, outlineErrorMm, clearanceMm, "inside", "outside", lead, unit);
}
