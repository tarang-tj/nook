// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// One plane map from more than one known size. A single sheet of paper pins
// the floor down well near the sheet and poorly far from it. A second sheet,
// or a length someone measured with a tape, lying out where the measuring
// happens, pins down the far end too. This file takes every known size in the
// photo and finds the one map that misses all of them by the least.
//
// The first sheet still fixes where the floor's zero is and which way its
// axes point, exactly as solveSheet does. A second sheet may lie anywhere and
// at any turn: where it lies is solved, only its size is taken as known.
import { dist, planeDistance, type Mat3, type Pt } from "./homography";
import { CONFLICT_SDS, fit, sigmaOf, type Extra } from "./fused-fit";
import type { Reference } from "./references";
import { degenerateReason, orderCorners, solveSheet, type Sheet } from "./sheet";

export type FusedInput = {
  /** The first sheet: four corner taps in any order. It fixes the floor's frame. */
  sheet: { corners: Pt[]; reference: Reference; swapSides: boolean };
  /** Another sheet of known size anywhere on the same floor. */
  secondSheet?: { corners: Pt[]; reference: Reference; swapSides?: boolean };
  /** Lengths measured on the floor between two tapped points. */
  spans?: { a: Pt; b: Pt; lengthMm: number }[];
};

export type Fused =
  | { ok: true; h: Mat3; used: string[] }
  | { ok: false; reason: string };

const fail = (reason: string): Fused => ({ ok: false, reason });

const percent = (got: number, want: number): string => {
  const off = Math.round((100 * (got - want)) / want);
  return `${Math.abs(off)}% ${off < 0 ? "smaller" : "larger"}`;
};

/** Which extra reference is the odd one out, in words. The culprit is the one
 * whose removal leaves the rest agreeing best; its size is then read through
 * the map the others give, which is "by how much" it disagrees. */
function conflict(sheet: Sheet, extras: Extra[], chi: number): string {
  let found: { extra: Extra; h: Mat3; chi: number } | null = null;
  for (const [i, extra] of extras.entries()) {
    const rest = fit(sheet, extras.filter((_, k) => k !== i));
    if (typeof rest !== "string" && (!found || rest.chi < found.chi)) found = { extra, h: rest.h, chi: rest.chi };
  }
  const times = `The taps disagree about ${chi.toFixed(0)} times more than tap error explains.`;
  if (!found) return `The known sizes in this photo contradict each other. ${times}`;
  const others = extras.length > 1 ? "the other known sizes" : "the first sheet";
  const e = found.extra;
  if (e.kind === "span") {
    const got = planeDistance(found.h, e.a, e.b);
    const by = got === null ? "" : ` Going by ${others}, it is ${percent(got, e.mm)} than the length typed.`;
    return `${e.name} contradicts ${others}.${by} ${times} Check the typed length and that both ends are on the floor.`;
  }
  const side = (i: number, j: number) => planeDistance(found.h, e.taps[i], e.taps[j]);
  const across = [side(0, 1), side(3, 2)];
  const deep = [side(1, 2), side(0, 3)];
  let by = "";
  if ([...across, ...deep].every((v) => v !== null)) {
    const w = ((across[0] as number) + (across[1] as number)) / 2;
    const d = ((deep[0] as number) + (deep[1] as number)) / 2;
    by = ` Going by ${others}, one pair of its sides is ${percent(w, e.plane[1].x)} than the paper chosen and the other pair is ${percent(d, e.plane[2].y)}.`;
  }
  return `The ${e.name} contradicts ${others}.${by} ${times} Check its paper size, its corners, and which of its sides is the long one.`;
}

/** Solve the floor's plane map from the first sheet and whatever else is
 * known. With the first sheet alone this is exactly solveSheet's map. Pure:
 * the same taps always give the same map. */
export function solveFused(input: FusedInput): Fused {
  const ordered = orderCorners(input.sheet.corners);
  const why = degenerateReason(ordered);
  if (why) return fail(`The four corners cannot be used: ${why}.`);
  const { long, short } = input.sheet.reference;
  const sheet = solveSheet(ordered, long, short, input.sheet.swapSides);
  if (!sheet) return fail("The four corners do not describe a flat sheet seen by a camera.");

  const extras: Extra[] = [];
  if (input.secondSheet) {
    const second = orderCorners(input.secondSheet.corners);
    const whySecond = degenerateReason(second);
    if (whySecond) return fail(`The second sheet cannot be used: ${whySecond}.`);
    // Its long side is guessed the way the first sheet's is: by which pair of
    // sides looks longer in the photo, unless the switch says otherwise.
    const ref = input.secondSheet.reference;
    const own = solveSheet(second, ref.long, ref.short, input.secondSheet.swapSides ?? false);
    if (!own) return fail("The second sheet's corners do not describe a flat sheet seen by a camera.");
    extras.push({ name: "second sheet", kind: "sheet", taps: second, plane: own.plane });
  }
  for (const [i, span] of (input.spans ?? []).entries()) {
    const name = `Known length ${i + 1}`;
    if (!Number.isFinite(span.lengthMm) || !(span.lengthMm > 0))
      return fail(`${name} cannot be used: its length is zero or missing.`);
    if (dist(span.a, span.b) < 2) return fail(`${name} cannot be used: its two ends are on the same spot.`);
    extras.push({ name, kind: "span", a: span.a, b: span.b, mm: span.lengthMm });
  }
  if (extras.length === 0) return { ok: true, h: sheet.h, used: ["first sheet"] };

  const best = fit(sheet, extras);
  if (typeof best === "string") return fail(best);
  if (best.chi > CONFLICT_SDS) return fail(conflict(sheet, extras, best.chi));
  return { ok: true, h: best.h, used: ["first sheet", ...extras.map((e) => e.name.toLowerCase())] };
}

/** The same input with every tap moved by its own uncertainty, for a Monte
 * Carlo error bar: call this, solve again, repeat. `draw` must return
 * bell-curve numbers with mean 0 and sd 1 (see gaussian in monte-carlo.ts);
 * each tap takes two draws, in a fixed order, so a seeded `draw` repeats. */
export function jitterFused(input: FusedInput, draw: () => number): FusedInput {
  const move = (p: Pt): Pt => {
    const s = sigmaOf(p);
    return { ...p, x: p.x + s * draw(), y: p.y + s * draw() };
  };
  return {
    sheet: { ...input.sheet, corners: input.sheet.corners.map(move) },
    ...(input.secondSheet && {
      secondSheet: { ...input.secondSheet, corners: input.secondSheet.corners.map(move) },
    }),
    ...(input.spans && {
      spans: input.spans.map((s) => ({ a: move(s.a), b: move(s.b), lengthMm: s.lengthMm })),
    }),
  };
}
