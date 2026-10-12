// Which length the page has given to each edge of a sheet. The page cannot
// see which side of the paper is the long one, so it guesses, and a wrong
// guess gives a wrong measurement with no warning. Writing the assumed
// length on each edge lets a person see a wrong guess at a glance.
import type { Pt } from "../measure/homography";
import type { Reference } from "../measure/references";
import { orderCorners, solveSheet } from "../measure/sheet";
import { fromMm, type Unit } from "../measure/units";

export type EdgeLabel = { a: Pt; b: Pt; text: string };

/** A paper side as text: "27.9 cm", "11 in". */
export const sideText = (mm: number, unit: Unit): string => `${Number(fromMm(mm, unit).toFixed(1))} ${unit}`;

/** One label for each of the four edges, in the order solveSheet uses, or
 * null when the corners do not make a sheet. */
export function sheetEdges(corners: Pt[], reference: Reference, swap: boolean, unit: Unit): EdgeLabel[] | null {
  if (corners.length !== 4) return null;
  const sheet = solveSheet(orderCorners(corners), reference.long, reference.short, swap);
  if (!sheet) return null;
  const [c0, c1, c2, c3] = sheet.ordered;
  const across = sideText(sheet.plane[1].x, unit); // edges 0-1 and 3-2
  const deep = sideText(sheet.plane[2].y, unit); // edges 1-2 and 0-3
  return [
    { a: c0, b: c1, text: across },
    { a: c1, b: c2, text: deep },
    { a: c3, b: c2, text: across },
    { a: c0, b: c3, text: deep },
  ];
}

/** The assumption in words, for the panel. */
export const sheetWords = (name: string, reference: Reference, swap: boolean, unit: Unit): string =>
  `${name} taken as ${reference.label}, ${sideText(reference.long, unit)} by ${sideText(reference.short, unit)}. ` +
  `The ${sideText(reference.long, unit)} length is given to the pair of sides that looks ${swap ? "shorter" : "longer"} in the photo. ` +
  "Each edge is labelled with the length it was given.";
