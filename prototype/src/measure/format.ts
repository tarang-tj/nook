// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
import { isMeasured, type Measured } from "./noise";

/** An error rounded to one significant figure, and the number of decimal
 * places that leaves (negative when it rounds to tens or hundreds). */
export function roundError(error: number): { error: number; decimals: number } {
  let exponent = Math.floor(Math.log10(error));
  let lead = Math.round(error / 10 ** exponent);
  // 0.96 rounds to 1.0, which is one place coarser than 0.9 was.
  if (lead === 10) {
    lead = 1;
    exponent++;
  }
  return { error: lead * 10 ** exponent, decimals: 0 - exponent };
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

/** "123.4 ± 0.6 cm": the error to one significant figure, the value to the
 * same decimal place. Anything that is not a real measurement is written
 * "not measured", never as a bare number. */
export function formatMeasured(m: Measured): string {
  if (!isMeasured(m)) return "not measured";
  const unit = m.unit ? ` ${m.unit}` : "";
  if (m.error === 0) return `${Number(m.value.toPrecision(3))} ± 0${unit}`;
  const { error, decimals } = roundError(m.error);
  return `${fixed(m.value, decimals)} ± ${fixed(error, decimals)}${unit}`;
}
