// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// The least-squares search behind the fused solve. It starts from the map the
// first sheet gives by itself and moves the unknowns downhill until every known
// size is missed by as little as possible (the Levenberg-Marquardt method: a
// Gauss-Newton step that is shortened whenever a full step would make things
// worse). Pure and deterministic: the same start always ends in the same place.
import { solveLinear } from "./homography";
import { residuals, type Scaled } from "./fused-residuals";

/** How far each unknown is nudged to measure the slope of the misses. */
const STEP = 1e-6;
/** Stop when no unknown moves by more than this. The unknowns are of order
 * one, so this is far below anything a tap could resolve. */
const TOLERANCE = 1e-8;
const MAX_ITERATIONS = 30;
const MAX_SHORTENINGS = 12;

export type Refined = {
  /** The unknowns at the best fit. */
  p: number[];
  /** Sum of squared misses there, each in standard deviations. */
  cost: number;
  /** Number of misses: two per corner tap, one per known length. */
  rows: number;
};

const sumSq = (v: Float64Array): number => {
  let t = 0;
  for (let k = 0; k < v.length; k++) t += v[k] * v[k];
  return t;
};

/** Refine the unknowns from `start`. Null when the start itself puts a tapped
 * point at or past the horizon, so there is nothing to refine from. */
export function refine(sc: Scaled, start: number[]): Refined | null {
  const n = start.length;
  const rows = 8 + 8 * sc.rects.length + sc.spans.length;
  let p = start.slice();
  let r = new Float64Array(rows);
  let trial = new Float64Array(rows);
  if (!residuals(p, sc, r)) return null;
  let cost = sumSq(r);
  let damping = 1e-3;
  const slope = Array.from({ length: n }, () => new Float64Array(rows));
  const normal = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const downhill = new Array<number>(n).fill(0);
  const nudged = new Array<number>(n).fill(0);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Slope of every miss with respect to every unknown, by nudging each one.
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) nudged[k] = p[k];
      nudged[i] += STEP;
      if (!residuals(nudged, sc, slope[i])) return { p, cost, rows };
      for (let k = 0; k < rows; k++) slope[i][k] = (slope[i][k] - r[k]) / STEP;
    }
    for (let i = 0; i < n; i++) {
      let g = 0;
      for (let k = 0; k < rows; k++) g += slope[i][k] * r[k];
      downhill[i] = -g;
      for (let j = i; j < n; j++) {
        let s = 0;
        for (let k = 0; k < rows; k++) s += slope[i][k] * slope[j][k];
        normal[i][j] = normal[j][i] = s;
      }
    }
    let improved = false;
    let settled = false;
    for (let tries = 0; tries < MAX_SHORTENINGS && !improved && !settled; tries++) {
      const damped = normal.map((row, i) =>
        row.map((v, k) => (i === k ? v * (1 + damping) + 1e-14 : v)),
      );
      const step = solveLinear(damped, downhill);
      const small = step !== null && step.every((v) => Math.abs(v) < TOLERANCE);
      const next = step ? p.map((v, i) => v + step[i]) : null;
      if (next && residuals(next, sc, trial) && sumSq(trial) < cost) {
        p = next;
        [r, trial] = [trial, r];
        cost = sumSq(r);
        damping = Math.max(damping / 10, 1e-9);
        improved = true;
        settled = small;
      } else if (small) settled = true;
      else damping *= 10;
    }
    if (settled || !improved) break;
  }
  return { p, cost, rows };
}
