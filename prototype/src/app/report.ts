// The words under the photo: what to do next, and each result or the reason
// there is none. Pure: the page only copies these strings onto the screen.
import { FIT_BASIS, fitVerdict, insideOutline } from "../measure/fit";
import { formatMeasured } from "../measure/format";
import { BASIS } from "../measure/monte-carlo";
import type { Measured } from "../measure/noise";
import { OUTLINE_BASIS } from "../measure/outline";
import { referenceById } from "../measure/references";
import { toMm } from "../measure/units";
import type { Bars, Settings, Solved } from "./numbers";
import { sheetWords } from "./sheet-edges";
import type { State } from "./state";
import { areaOf, firstSentence, lengthOf, stepText, truthText } from "./words";

export type { Settings } from "./numbers";

/** What the page itself knows: whether a photo is loaded, whether it is the
 * made-up sample floor, and a message that must stay up until something
 * replaces it (a file that would not open). */
export type Page = { hasPhoto: boolean; notice: string; sample?: boolean };

/** The one sentence that is always on screen, even with the long text folded away. */
export const UNCHECKED = "Not checked against a tape measure or a real photo. The ± covers tap placement only.";

/** One number in a list: its bar, or the refusal in words. */
export type Row = { name: string; measured: Measured | null; text: string };

export type Report = {
  notice: string;
  step: string;
  /** The error bars are still being worked out: show this, and no number. */
  working: boolean;
  /** The one big result of the distance tool. */
  headline: string;
  /** Why there is no measurement at all. */
  problem: string;
  /** The room tool's numbers: each wall, the perimeter, the floor area. */
  rows: Row[];
  /** The fit tool's sentences. */
  verdicts: string[];
  /** Refusals in full, and warnings about a bar. Each said once. */
  notes: string[];
  /** On the made-up floor only: the true values, to compare with. */
  truth: string[];
  /** What the ± covers and leaves out, in full. Empty when nothing is shown. */
  basis: string;
  /** The paper size and long side the page assumed for the sheet. */
  sheet: string;
};

const ZOOM_HINT = "Taps made zoomed out count as far less exact: zoom in and drag each point onto its spot.";

export function report(s: State, page: Page, set: Settings, solved: Solved | null, bars: Bars | null): Report {
  const out: Report = {
    notice: page.notice,
    step: stepText(s, page.hasPhoto),
    working: false, headline: "", problem: "", rows: [], verdicts: [], notes: [], truth: [], basis: "",
    sheet: s.points.sheet.length === 4 ? sheetWords("Sheet", referenceById(set.paper), set.swap, set.unit) : "",
  };
  if (!page.hasPhoto || !solved) return out;
  if (!solved.ok) {
    out.problem = `No measurement. ${solved.reason} Drag the points or press Undo.`;
    return out;
  }
  if (Object.keys(solved.values).length === 0) return out; // nothing to measure yet
  if (page.sample) out.truth = truthText(s, set.unit);
  if (!bars) {
    out.working = true;
    return out;
  }
  const note = (text: string | null | undefined) => {
    if (text && !out.notes.includes(text)) out.notes.push(text);
  };
  const refusal = (reason: string): string => {
    note(/uncertain|trustworthy/.test(reason) ? `${reason} ${ZOOM_HINT}` : reason);
    return `no number. ${firstSentence(reason)}`;
  };
  const warn = (key: string) => {
    const bar = bars[key];
    if (bar && bar.value !== null) note(bar.warning);
  };
  const reasonOf = (key: string): string => {
    const bar = bars[key];
    return bar && bar.value === null ? bar.reason : solved.outlineProblem ?? "The taps as placed do not give a number here.";
  };

  if (s.tool === "distance") {
    const m = lengthOf(bars.distance, set.unit, BASIS);
    if (m) out.headline = `A to B: ${formatMeasured(m)}`;
    else out.problem = `No measurement. ${refusal(reasonOf("distance")).replace(/^no number\. /, "")}`;
    if (m) warn("distance");
    out.basis = BASIS;
    return out;
  }

  if ("perimeter" in solved.values && s.tool === "room") {
    if (solved.outlineProblem) {
      out.problem = `No measurement. ${solved.outlineProblem}`;
      return out;
    }
    const row = (name: string, key: string, m: Measured | null): Row => {
      if (m) warn(key);
      return { name, measured: m, text: m ? formatMeasured(m) : refusal(reasonOf(key)) };
    };
    const n = s.points.room.length;
    for (let i = 0; i < n; i++)
      out.rows.push(row(`Wall ${i + 1} (corner ${i + 1} to ${((i + 1) % n) + 1})`, `wall${i}`, lengthOf(bars[`wall${i}`], set.unit, OUTLINE_BASIS)));
    out.rows.push(row("Perimeter", "perimeter", lengthOf(bars.perimeter, set.unit, OUTLINE_BASIS)));
    out.rows.push(row("Floor area", "area", areaOf(bars.area, set.unit, OUTLINE_BASIS)));
    out.basis = OUTLINE_BASIS;
    return out;
  }

  if (s.tool === "fit") {
    const [width, depth] = [toMm(set.thingWidth, set.unit), toMm(set.thingDepth, set.unit)];
    if (bars.gap) {
      out.verdicts.push(`Width first. ${fitVerdict(bars.gap, width, set.unit).sentence}`);
      if (depth !== width) out.verdicts.push(`Turned a quarter turn. ${fitVerdict(bars.gap, depth, set.unit).sentence}`);
      warn("gap");
    }
    const { room, foot } = solved.floor;
    if (!s.closed) out.verdicts.push("To try the thing inside a room, close an outline on the Room tab, then come back here.");
    else if (solved.outlineProblem) out.verdicts.push(`Inside the outline: cannot say. ${solved.outlineProblem}`);
    else if (!room || !foot) out.verdicts.push("Inside the outline: cannot say. Type a width and a depth above zero.");
    else {
      const spare = bars.spare;
      out.verdicts.push(
        !spare || spare.value === null
          ? `Inside the outline: cannot say. ${spare ? spare.reason : "The room around the thing could not be worked out."}`
          : `Inside the outline. ${insideOutline(foot, room, spare.error, 0, set.unit).sentence}`,
      );
      warn("spare");
    }
    out.basis = FIT_BASIS;
  }
  return out;
}
