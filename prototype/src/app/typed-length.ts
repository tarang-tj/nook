// A length typed into a box. The box shows a bare number, so the page has to
// remember what that number meant: the length itself, in millimetres, beside
// the text it was read from. Changing Units then rewrites the text and leaves
// the length alone, so "80" typed as centimetres never turns into 80 inches.
// Pure.
import { fromMm, toMm, type Unit } from "../measure/units";

/** A length in mm (NaN when the box is empty or not a number) and the text
 * in the box that stands for it. */
export type TypedLength = { mm: number; text: string };

export const EMPTY_LENGTH: TypedLength = { mm: NaN, text: "" };

/** Read the box. Text the person has not touched keeps the length it has;
 * new text is a number in the unit showing as it is typed. */
export function readTyped(held: TypedLength, text: string, unit: Unit): TypedLength {
  if (text === held.text) return held;
  const value = text.trim() === "" ? NaN : Number(text);
  return { mm: toMm(value, unit), text };
}

/** A known length written for the box in `unit`. The length stays exact; only
 * the text is rounded. */
export function typedFrom(mm: number, unit: Unit): TypedLength {
  return Number.isFinite(mm) ? { mm, text: String(Number(fromMm(mm, unit).toFixed(2))) } : EMPTY_LENGTH;
}

/** One look at the box. `was` is the unit that was showing at the last look
 * and `now` the one showing at this one. When they differ the same length is
 * written out again in the new unit. */
export function stepTyped(held: TypedLength, text: string, was: Unit, now: Unit): TypedLength {
  const read = readTyped(held, text, was);
  return was === now ? read : typedFrom(read.mm, now);
}
