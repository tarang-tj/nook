// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// The error bar for any number that comes from taps. monte-carlo.ts does this
// for one distance from one sheet. Here the caller hands over a closure that
// works the number out, so the same loop serves a wall, an area or a gap, and
// it does not matter whether the plane map came from one sheet or several.
import type { Pt } from "./homography";
import {
  DEFAULT_SAMPLES,
  DEFAULT_SEED,
  gaussian,
  MIN_SAMPLES,
  seededRandom,
  TAP_SIGMA_SCREEN_PX,
  type Spread,
} from "./monte-carlo";

/** One standard normal draw (mean 0, standard deviation 1). */
export type Draw = () => number;

export type SpreadResult =
  | { value: number; spread: Spread }
  | { value: null; reason: string };

/** A value with the half-width of its bar (2 standard deviations), or the
 * reason there is no honest number. */
export type Bar =
  | { value: number; error: number; warning: string | null }
  | { value: null; reason: string };

/** Share of simulated taps that must give a number for the bar to be shown. */
const MIN_KEPT = 0.8;

/** Move a point by its own tap uncertainty `s` (photo pixels) in x and in y.
 * A point placed without one gets the page's default. */
export function jitterPoint(p: Pt, draw: Draw): Pt {
  const sd = p.s ?? TAP_SIGMA_SCREEN_PX;
  const dx = sd * draw();
  const dy = sd * draw();
  return { x: p.x + dx, y: p.y + dy };
}

/** The value at the taps as placed, and how far it spreads when every tap is
 * misplaced. `evaluate(null)` is the value as placed. `evaluate(draw)` is the
 * value after the closure has moved every tap with `draw` (jitterPoint) and
 * solved again. A trial that returns null or a non-number is dropped, and if
 * more than a fifth are dropped there is no bar, because it would mislead. */
export function spreadOf(
  evaluate: (draw: Draw | null) => number | null,
  options: { samples?: number; seed?: number } = {},
): SpreadResult {
  const value = evaluate(null);
  if (value === null || !Number.isFinite(value))
    return { value: null, reason: "The taps as placed do not give a number here." };

  const n = Math.max(MIN_SAMPLES, Math.floor(options.samples ?? DEFAULT_SAMPLES));
  const draw = gaussian(seededRandom(options.seed ?? DEFAULT_SEED));
  let sum = 0;
  let sumSq = 0;
  let used = 0;
  for (let i = 0; i < n; i++) {
    const v = evaluate(draw);
    if (v === null || !Number.isFinite(v)) continue;
    used++;
    sum += v;
    sumSq += v * v;
  }
  if (used < MIN_KEPT * n)
    return {
      value: null,
      reason:
        `No trustworthy error bar here: only ${Math.floor((used / n) * 100)}% of the simulated taps gave a number, ` +
        "so small changes in the taps swing the answer too far. " +
        "Move the points closer to the sheet, or retake the photo from higher up.",
    };
  const mean = sum / used;
  const variance = Math.max(0, (sumSq - used * mean * mean) / (used - 1));
  return { value, spread: { sd: Math.sqrt(variance), kept: used / n } };
}

/** Turn a spread into the bar that is shown: plus or minus 2 standard
 * deviations. A `size` (a length or an area) whose bar is as large as itself
 * is refused, because "0 ± 400 cm" reads as a result but is not one. A
 * `signed` value (room to spare, which may honestly be near zero) is not. */
export function withBar(result: SpreadResult, kind: "size" | "signed" = "size"): Bar {
  if (result.value === null) return result;
  const { value, spread } = result;
  if (!(spread.sd > 0) || !Number.isFinite(spread.sd))
    return { value: null, reason: "No trustworthy error bar here: the simulated taps did not move the answer." };
  const error = 2 * spread.sd;
  if (kind === "size" && (value <= 0 || error >= value))
    return {
      value: null,
      reason:
        "Too uncertain to call a measurement: the error bar is as large as the value itself. " +
        "Put the sheet nearer what you are measuring, or take the photo closer.",
    };
  return {
    value,
    error,
    warning:
      spread.kept < 1
        ? `Only ${Math.floor(spread.kept * 100)}% of the simulated taps could be used. The bar is a lower bound here, so do not read this value as precise.`
        : null,
  };
}
