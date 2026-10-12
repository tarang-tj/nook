// The room as two pieces of text a person can keep: a top-down plan (SVG)
// and a table of the walls (CSV). Both are built in the browser from what is
// on screen. Nothing is uploaded. Pure.
import { planCsv, planSvg, type Plan } from "../measure/plan";
import type { Settings, Solved } from "./numbers";
import type { Row } from "./report";
import { UNCHECKED } from "./report";

/** The plan as drawn on the page and saved. `rows` are the room tool's rows
 * (walls first), or empty while the bars are being worked out.
 *
 * A plan is a drawing to scale, with a scale bar: a length can be read off
 * any wall in it. So there is none unless every wall has an honest number.
 * An outline that crosses itself, a wall the maths refused, or bars still
 * being worked out all mean no plan, the same as they mean no number. */
export function planOf(solved: Solved | null, rows: Row[], set: Settings, sample: boolean): Plan {
  if (!solved || !solved.ok || !solved.floor.room) return { ok: false, reason: "There is no closed outline to draw yet." };
  if (solved.outlineProblem) return { ok: false, reason: solved.outlineProblem };
  const walls = rows.slice(0, solved.floor.room.length);
  if (walls.length < solved.floor.room.length) return { ok: false, reason: "The wall lengths are still being worked out." };
  if (!walls.every((row) => row.measured))
    return { ok: false, reason: "A wall of this outline has no honest number, so no plan is drawn to scale." };
  return planSvg(
    solved.floor.room,
    walls.map((row) => row.text),
    {
      sheet: solved.floor.sheet ?? undefined,
      sheetLabel: "sheet",
      footprint: solved.floor.foot ?? undefined,
      unit: set.unit,
      title: sample ? "Nook draft plan of a made-up floor" : "Nook draft plan",
      note: `Draft from a prototype. ${UNCHECKED}`,
    },
  );
}

/** The walls, the perimeter and the floor area as CSV. A row with no honest
 * number is written with empty cells. */
export const csvOf = (rows: Row[]): string => planCsv(rows.map((row) => ({ wall: row.name, measured: row.measured })));
