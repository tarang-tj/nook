// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
import { isMeasured, type Measured } from "./noise";

/** The error is written as this many steps of its last decimal place at
 * most: one figure from 2 to 9, two figures from 10 to 19. One figure alone
 * is too coarse when it is a 1 (14.9 would be written 10 or 20). */
const MOST_STEPS = 19;

/** A value and its error rounded for writing, and the decimal places used
 * (negative when they round to tens or hundreds). The value goes to the
 * nearest step. The error is rounded up, after adding how far the value
 * moved, so the written range always holds the whole worked-out range: a bar
 * on screen is never narrower than the bar that was worked out. */
export function roundOutward(value: number, error: number): { value: number; error: number; decimals: number } {
  let exponent = Math.floor(Math.log10(error));
  if (error / 10 ** exponent < 2) exponent--; // first figure 1: keep a second
  for (;;) {
    const step = 10 ** exponent;
    const shown = Math.round(value / step) * step;
    // The 1e-9 keeps an error that is already a whole number of steps as it is.
    const steps = Math.ceil((error + Math.abs(value - shown)) / step - 1e-9);
    if (steps <= MOST_STEPS) return { value: shown, error: steps * step, decimals: 0 - exponent };
    exponent++;
  }
}

/** `value` to `decimals` places as text. Negative places round to tens, hundreds. */
function fixed(value: number, decimals: number): string {
  const text =
    decimals >= 0
      ? value.toFixed(Math.min(20, decimals))
      : String(Math.round(value / 10 ** -decimals) * 10 ** -decimals);
  // A small negative number must not print as "-0.0".
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

/** The value and its error as they are written everywhere, on the page and
 * in the saved files. Null for anything that is not a real measurement. */
export function roundedParts(m: Measured): { value: string; error: string } | null {
  if (!isMeasured(m)) return null;
  if (m.error === 0) return { value: String(Number(m.value.toPrecision(3))), error: "0" };
  const { value, error, decimals } = roundOutward(m.value, m.error);
  return { value: fixed(value, decimals), error: fixed(error, decimals) };
}

/** "123.4 ± 0.6 cm". Anything that is not a real measurement is written
 * "not measured", never as a bare number. */
export function formatMeasured(m: Measured): string {
  const parts = roundedParts(m);
  if (!parts) return "not measured";
  return `${parts.value} ± ${parts.error}${m.unit ? ` ${m.unit}` : ""}`;
}
