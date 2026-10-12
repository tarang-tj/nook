// Does the error bar tell the truth? The page is expected to wrap a fused
// distance in a bar like this: move every tap by its own uncertainty
// (jitterFused, plus the two measured points), solve again, repeat, and show
// 2 standard deviations of the answers. This file simulates many retakes of
// the same photo and counts how often that bar holds the true distance.
//
// A 2 standard deviation bar on a bell curve holds the truth 95.4% of the
// time. Over 300 retakes that is 286, give or take 4 by luck. The pass mark of
// 276 (92%) was set before the counts were looked at, and the counts are
// pinned below exactly as measured: nothing here was tuned to pass.
//
// Each bar here uses 100 simulated tap sets, not the page's 400, to keep the
// run short. Fewer sets make the bar itself a little noisier, which can only
// lower the count, so this is a slightly harsh version of the page's bar.
import { describe, expect, it } from "vitest";
import { jitterFused, solveFused, type FusedInput } from "../src/measure/fused";
import { planeDistance, type Pt } from "../src/measure/homography";
import { DEFAULT_SEED, gaussian, seededRandom } from "../src/measure/monte-carlo";
import { FAR_SPAN, retake, type Case } from "./scene";

const RETAKES = 300;
const TAP_SETS = 100;
const PASS_SHARE = 0.92;

/** The distance and its Monte Carlo spread, the way the page would get them.
 * Null when there is no distance, or under 80% of the tap sets gave one (the
 * same rule distanceSpread uses for one sheet). */
function distanceWithBar(input: FusedInput, a: Pt, b: Pt): { mm: number; sd: number } | null {
  const solved = solveFused(input);
  const mm = solved.ok ? planeDistance(solved.h, a, b) : null;
  if (mm === null) return null;
  const normal = gaussian(seededRandom(DEFAULT_SEED));
  const move = (p: Pt): Pt => ({ x: p.x + (p.s ?? 0) * normal(), y: p.y + (p.s ?? 0) * normal() });
  let sum = 0;
  let sumSq = 0;
  let used = 0;
  for (let i = 0; i < TAP_SETS; i++) {
    const again = solveFused(jitterFused(input, normal));
    const d = again.ok ? planeDistance(again.h, move(a), move(b)) : null;
    if (d === null || !Number.isFinite(d)) continue;
    used++;
    sum += d;
    sumSq += d * d;
  }
  if (used < 0.8 * TAP_SETS) return null;
  const mean = sum / used;
  return { mm, sd: Math.sqrt(Math.max(0, (sumSq - used * mean * mean) / (used - 1))) };
}

/** Over RETAKES retakes: how many gave a bar, and how many of those bars held the truth. */
function coverage(which: Case, sigma: number): { held: number; withBar: number } {
  const normal = gaussian(seededRandom(20261011));
  let held = 0;
  let withBar = 0;
  for (let i = 0; i < RETAKES; i++) {
    const { input, a, b } = retake(which, sigma, normal);
    const got = distanceWithBar(input, a, b);
    if (!got) continue;
    withBar++;
    if (Math.abs(got.mm - FAR_SPAN.mm) <= 2 * got.sd) held++;
  }
  return { held, withBar };
}

// [case, tap noise in photo pixels, bars that held the truth, retakes that gave a bar]
const MEASURED: [Case, number, number, number][] = [
  // The one-sheet bar is the baseline, not new work. At 1.5 px it lands just
  // under the pass mark (91.0%): it is a little optimistic this far from the sheet.
  ["one sheet", 1.5, 273, 300],
  ["two sheets", 1.5, 292, 300],
  ["one sheet and one known length", 1.5, 290, 300],
  // At 5 px, 31 one-sheet retakes gave no bar at all (too few tap sets survived).
  ["one sheet", 5, 250, 269],
  ["two sheets", 5, 291, 300],
  // 99.7%: wider than it needs to be here, which errs on the safe side.
  ["one sheet and one known length", 5, 299, 300],
];

describe("how often a 2-sigma Monte Carlo bar around a fused distance holds the truth", () => {
  for (const [which, sigma, held, withBar] of MEASURED) {
    const passes = held / withBar >= PASS_SHARE;
    it(`${which}, taps ${sigma} px off: ${held} of ${withBar} bars hold the truth, ${passes ? "at or above" : "BELOW (optimistic)"} the 92% pass mark`, () => {
      const got = coverage(which, sigma);
      console.log(`fused coverage: ${which}, sigma ${sigma} px: ${got.held} of ${got.withBar} bars held, ${RETAKES - got.withBar} of ${RETAKES} retakes gave no bar`);
      expect(got).toEqual({ held, withBar });
      // Every fused case must clear the mark. One sheet alone is reported as it is.
      if (which !== "one sheet") expect(got.held / got.withBar).toBeGreaterThanOrEqual(PASS_SHARE);
    }, 60_000);
  }
});
