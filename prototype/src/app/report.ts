// The words under the photo: what to do next, and the result or the reason
// there is none. Pure: the page only copies these strings onto the screen.
import { measureFloorDistance } from "../measure/floor-distance";
import { referenceById } from "../measure/references";
import { degenerateReason, orderCorners } from "../measure/sheet";
import type { Unit } from "../measure/units";
import { SAMPLE_TRUTH } from "../sample/floor";
import { sheetWords, sideText } from "./sheet-edges";
import type { State } from "./state";

/** The choices made with the controls, read off the page by main.ts. */
export type Settings = { paper: string; swap: boolean; unit: Unit };

/** What the page itself knows: whether a photo is loaded, and a message
 * that must stay up until something replaces it (a file that would not open). */
export type Page = { hasPhoto: boolean; notice: string; /** The made-up sample floor is showing. */ sample?: boolean };

/** The one sentence that is always on screen, even with the long text folded away. */
export const UNCHECKED = "Not checked against a tape measure or a real photo. The ± covers tap placement only.";

export type Report = {
  notice: string;
  step: string;
  result: string;
  problem: boolean;
  /** What the ± covers and leaves out, in full. */
  basis: string;
  /** The paper size and long side the page assumed for the sheet. */
  sheet: string;
  /** On the made-up floor only: the true value, to compare with the result. */
  truth: string;
};

export function report(s: State, page: Page, settings: Settings): Report {
  const words = wordsFor(s, page.hasPhoto, settings);
  const sheet =
    s.points.sheet.length === 4 ? sheetWords("Sheet", referenceById(settings.paper), settings.swap, settings.unit) : "";
  const truth =
    page.sample && s.points.ends.length === 2
      ? `True value on this made-up floor: A to B is ${sideText(SAMPLE_TRUTH.distance, settings.unit)}.`
      : "";
  return { ...words, notice: page.notice, sheet, truth };
}

type Words = Omit<Report, "notice" | "sheet" | "truth">;

const problem = (step: string, text: string): Words => ({
  step, result: `No measurement. ${text}`, problem: true, basis: "",
});

function wordsFor(s: State, hasPhoto: boolean, settings: Settings): Words {
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
  const step = "Both spots are placed. Drag any point to adjust it, zoom in to place it better, or press Undo to place one again.";
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
