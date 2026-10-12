// The words under the photo: what to do next, and the result or the reason
// there is none. Pure: the page only copies these strings onto the screen.
import { measureFloorDistance } from "../measure/floor-distance";
import { referenceById } from "../measure/references";
import { degenerateReason, orderCorners } from "../measure/sheet";
import type { Unit } from "../measure/units";
import type { State } from "./state";

/** The choices made with the controls, read off the page by main.ts. */
export type Settings = { paper: string; swap: boolean; unit: Unit };

export type Report = { step: string; result: string; problem: boolean; basis: string };

const problem = (step: string, text: string): Report => ({
  step, result: `No measurement. ${text}`, problem: true, basis: "",
});

export function report(s: State, hasPhoto: boolean, settings: Settings): Report {
  const blank = { result: "", problem: false, basis: "" };
  if (!hasPhoto) return { step: "Step 1 of 3: take or choose a photo.", ...blank };
  const { sheet, ends } = s.points;
  if (sheet.length < 4)
    return { step: `Step 2 of 3: tap the four corners of the sheet (${sheet.length} of 4). Drag a point to adjust it.`, ...blank };
  if (ends.length < 2) {
    const step = `Step 3 of 3: tap the two spots on the floor to measure between (${ends.length} of 2).`;
    const why = degenerateReason(orderCorners(sheet));
    return why ? problem(step, `The four corners cannot be used: ${why}. Drag them or press Undo.`) : { step, ...blank };
  }
  const step = "Drag any point to adjust it. Start over clears the points.";
  const outcome = measureFloorDistance({
    corners: sheet, a: ends[0], b: ends[1],
    reference: referenceById(settings.paper), unit: settings.unit, swapSides: settings.swap,
  });
  if (!outcome.ok) return problem(step, outcome.reason);
  return {
    step,
    result: `A to B: ${outcome.text}`,
    problem: false,
    basis: (outcome.warning ? `${outcome.warning} ` : "") + outcome.measured.basis,
  };
}
