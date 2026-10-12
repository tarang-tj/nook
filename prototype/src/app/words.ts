// Small pieces of text the report is built from: a number with its bar, the
// step line for each tool, and the true values of the made-up floor. Pure.
import { measured, type Measured } from "../measure/noise";
import type { Bar } from "../measure/spread";
import { fromMm, type Unit } from "../measure/units";
import { SAMPLE_TRUTH } from "../sample/floor";
import { sideText } from "./sheet-edges";
import { LIMIT, target, type State } from "./state";

/** A length bar (mm) as a measurement in the chosen unit, or null. */
export function lengthOf(bar: Bar | undefined, unit: Unit, basis: string): Measured | null {
  if (!bar || bar.value === null) return null;
  return measured(fromMm(bar.value, unit), fromMm(bar.error, unit), unit, basis);
}

/** Square millimetres per square metre and per square foot. A floor area
 * reads better in these than in square centimetres or square inches. */
const AREA: Record<Unit, { per: number; name: string }> = {
  cm: { per: 1_000_000, name: "m²" },
  in: { per: 92_903.04, name: "ft²" },
};

/** An area bar (mm squared) as square metres or square feet, or null. */
export function areaOf(bar: Bar | undefined, unit: Unit, basis: string): Measured | null {
  if (!bar || bar.value === null) return null;
  const { per, name } = AREA[unit];
  return measured(bar.value / per, bar.error / per, name, basis);
}

export const areaText = (mm2: number, unit: Unit): string =>
  `${Number((mm2 / AREA[unit].per).toFixed(2))} ${AREA[unit].name}`;

/** The first sentence of a refusal, for a line in a list. */
export const firstSentence = (reason: string): string => reason.split(/(?<=\.)\s/)[0];

/** What to do next, by tool. */
export function stepText(s: State, hasPhoto: boolean): string {
  if (!hasPhoto) return "Step 1: take or choose a photo, or try the sample.";
  const n = (group: keyof State["points"]) => s.points[group].length;
  const next = target(s);
  if (next === "sheet") return `Step 2: tap the four corners of the sheet (${n("sheet")} of 4). Zoom in first to tap more exactly.`;
  if (next === "second") return `Second sheet: tap its four corners (${n("second")} of 4).`;
  if (next === "span") return `Known length: tap its two ends (${n("span")} of 2), then type its length.`;
  if (s.tool === "distance")
    return next
      ? `Step 3: tap the two spots on the floor to measure between (${n("ends")} of 2).`
      : "Both spots are placed. Drag any point to adjust it, zoom in to place it better, or press Undo to place one again.";
  if (s.tool === "room") {
    if (s.closed) return "The outline is closed. Drag a corner to adjust it, or press Undo to open it again.";
    if (!next) return `An outline takes at most ${LIMIT.room} corners. Press Close outline.`;
    return n("room") < 3
      ? `Step 3: tap the room's corners where the walls meet the floor, in order, going round (${n("room")} so far).`
      : `Keep tapping corners in order (${n("room")} so far). To finish, tap corner 1 again or press Close outline.`;
  }
  return next
    ? `Step 3: tap the two sides of a gap on the floor (${n("gap")} of 2).`
    : "The gap is placed. Type the thing's width and depth. Drag any point to adjust it.";
}

/** The true values of the made-up floor for the chosen tool. */
export function truthText(s: State, unit: Unit): string[] {
  const t = SAMPLE_TRUTH;
  if (s.tool === "distance")
    return s.points.ends.length === 2 ? [`True value on this made-up floor: A to B is ${sideText(t.distance, unit)}.`] : [];
  if (s.tool === "room")
    return s.closed
      ? [
          `True values on this made-up floor: walls ${t.walls.map((w) => Number(fromMm(w, unit).toFixed(1))).join(", ")} ${unit}, ` +
            `perimeter ${sideText(t.perimeter, unit)}, floor area ${areaText(t.area, unit)}.`,
        ]
      : [];
  return s.points.gap.length === 2
    ? [`True value on this made-up floor: the gap between the two red crosses is ${sideText(t.gap, unit)}.`]
    : [];
}
