// The room as two pieces of text a person can keep: a top-down plan (SVG)
// and a table of the walls (CSV). Both are built in the browser from what is
// on screen. Nothing is uploaded. Pure.
import { planCsv, planSvg, type Plan } from "../measure/plan";
import type { Settings, Solved } from "./numbers";
import type { Row } from "./report";
import { UNCHECKED } from "./report";

/** The plan as drawn on the page and saved. `rows` are the room tool's rows
 * (walls first), or empty while the bars are being worked out: the outline
 * is then drawn without wall lengths, never with old ones. */
export function planOf(solved: Solved | null, rows: Row[], set: Settings, sample: boolean): Plan {
  if (!solved || !solved.ok || !solved.floor.room) return { ok: false, reason: "There is no closed outline to draw yet." };
  return planSvg(
    solved.floor.room,
    // Rows past the last wall (the perimeter and the area) are not wall labels; planSvg ignores them.
    rows.map((row) => (row.measured ? row.text : "")),
    {
      sheet: solved.floor.sheet ?? undefined,
      sheetLabel: "sheet",
      footprint: solved.floor.foot ?? undefined,
      unit: set.unit,
      title: sample ? "Nook draft plan of a made-up floor" : "Nook draft plan",
      note: `Draft from a prototype. ${UNCHECKED} A wall with no length had no honest number.`,
    },
  );
}

/** The walls, the perimeter and the floor area as CSV. A row with no honest
 * number is written with empty cells. */
export const csvOf = (rows: Row[]): string => planCsv(rows.map((row) => ({ wall: row.name, measured: row.measured })));
