// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// The error bar. Nobody taps exactly on a corner, so we simulate it: nudge the
// four sheet corners and both floor points by a small random amount, measure
// again, and repeat a few hundred times. How much the answers spread is the
// bar. (This kind of repeated random trial is called a Monte Carlo method.)
// The random numbers are seeded, so the same taps always give the same bar.
import { planeDistance, solveHomography, type Pt } from "./homography";
import type { Sheet } from "./sheet";

export const MIN_SAMPLES = 300;
export const DEFAULT_SAMPLES = 400;
export const DEFAULT_SEED = 20261008;

/** How far a tap may land from where it was meant, as one standard deviation
 * in screen pixels. It is an assumption, not a measurement of real fingers. */
export const TAP_SIGMA_SCREEN_PX = 1.5;

/** What the bar covers, word for word. Shown beside every result. */
export const BASIS =
  "The ± is 2 standard deviations over 400 simulated sets of taps, each landing about 1.5 screen pixels off. " +
  "It covers tap placement only. It leaves out: lens distortion, points that are not on the floor, " +
  "a curled or folded sheet, and paper that is not the size selected. " +
  "This method has not yet been checked against a tape measure.";

/** Small, fast, seedable random generator (mulberry32): uniform in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bell-curve random numbers (Box-Muller) from a uniform generator. */
export function gaussian(random: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    const u = 1 - random(); // in (0, 1], so the log is finite
    const r = Math.sqrt(-2 * Math.log(u));
    const t = 2 * Math.PI * random();
    spare = r * Math.sin(t);
    return r * Math.cos(t);
  };
}

export type Spread = {
  /** Standard deviation of the simulated distances, mm. */
  sd: number;
  /** Share of trials that gave a usable distance (1 means all of them). */
  kept: number;
};

/** Spread of the distance (mm) over simulated taps. Trials where a nudged
 * point crosses the horizon, or the corners stop defining a plane, are
 * dropped. Null when fewer than 80% survive, because the bar would mislead. */
export function distanceSpread(
  sheet: Sheet,
  a: Pt,
  b: Pt,
  sigmaPx: number,
  seed = DEFAULT_SEED,
  samples = DEFAULT_SAMPLES,
): Spread | null {
  const n = Math.max(MIN_SAMPLES, Math.floor(samples));
  const normal = gaussian(seededRandom(seed));
  // Each point is nudged by the uncertainty it was placed with.
  const jitter = (p: Pt): Pt => {
    const sd = p.s ?? sigmaPx;
    return { x: p.x + sd * normal(), y: p.y + sd * normal() };
  };
  let sum = 0;
  let sumSq = 0;
  let used = 0;
  for (let i = 0; i < n; i++) {
    const h = solveHomography(sheet.ordered.map(jitter), sheet.plane);
    const d = h ? planeDistance(h, jitter(a), jitter(b)) : null;
    if (d === null || !Number.isFinite(d)) continue;
    used++;
    sum += d;
    sumSq += d * d;
  }
  if (used < 0.8 * n) return null;
  const mean = sum / used;
  const variance = Math.max(0, (sumSq - used * mean * mean) / (used - 1));
  return { sd: Math.sqrt(variance), kept: used / n };
}
