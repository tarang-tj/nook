import { describe, expect, it } from "vitest";
import { jitterFused, solveFused, type Fused, type FusedInput } from "../src/measure/fused";
import { planeDistance, type Pt } from "../src/measure/homography";
import { gaussian, seededRandom } from "../src/measure/monte-carlo";
import { referenceById } from "../src/measure/references";
import { orderCorners, solveSheet } from "../src/measure/sheet";
import {
  A4_FAR_ON_FLOOR, FAR_SPAN, KNOWN_SPAN, LETTER_ON_FLOOR, letterInPhoto, median, project,
  retake, sheetOnFloor, tapped, type Case,
} from "./scene";

const letter = referenceById("letter");
const a4 = referenceById("a4");
/** Exact taps, each carrying the default 1.5 pixel uncertainty. */
const exact = (floor: Pt[]): Pt[] => floor.map((f) => ({ ...project(f), s: 1.5 }));
const first = () => ({ corners: exact(LETTER_ON_FLOOR), reference: letter, swapSides: false });
const known = (mm = KNOWN_SPAN.mm) => {
  const [a, b] = exact([KNOWN_SPAN.a, KNOWN_SPAN.b]);
  return { a, b, lengthMm: mm };
};
const ok = (f: Fused) => {
  if (!f.ok) throw new Error(`expected a map, got: ${f.reason}`);
  return f;
};
const reason = (f: Fused): string => {
  if (f.ok) throw new Error("expected a refusal, got a map");
  return f.reason;
};
/** What a map makes of the one-metre test span, in mm. */
const farSpan = (f: Fused): number => planeDistance(ok(f).h, project(FAR_SPAN.a), project(FAR_SPAN.b))!;

describe("solveFused", () => {
  it("with only the first sheet, returns exactly what solveSheet gives", () => {
    const corners = letterInPhoto();
    for (const swapSides of [false, true]) {
      const alone = ok(solveFused({ sheet: { corners: [corners[2], corners[0], corners[3], corners[1]], reference: letter, swapSides } }));
      expect(alone.h).toEqual(solveSheet(orderCorners(corners), letter.long, letter.short, swapSides)!.h);
      expect(alone.used).toEqual(["first sheet"]);
    }
    expect(ok(solveFused({ sheet: first(), spans: [] })).h).toEqual(ok(solveFused({ sheet: first() })).h);
  });

  it("equals the truth when every tap is exact, whatever is added", () => {
    const both = solveFused({ sheet: first(), secondSheet: { corners: exact(A4_FAR_ON_FLOOR), reference: a4 }, spans: [known()] });
    expect(ok(both).used).toEqual(["first sheet", "second sheet", "known length 1"]);
    expect(farSpan(both)).toBeCloseTo(1000, 5);
    const twoLengths = solveFused({ sheet: first(), spans: [known(), { a: exact([FAR_SPAN.a])[0], b: exact([FAR_SPAN.b])[0], lengthMm: 1000 }] });
    expect(farSpan(twoLengths)).toBeCloseTo(1000, 5);
  });

  it("solves where the second sheet lies: any place, any turn, corners tapped in any order", () => {
    for (const [x, y, turn] of [[550, 3500, 20], [-800, 2500, -65], [200, 1200, 170]]) {
      const c = exact(sheetOnFloor(297, 210, { x, y }, turn));
      // Turned far enough, the long side points away and looks the shorter one.
      const swapSides = Math.abs(turn) === 65;
      const fused = solveFused({ sheet: first(), secondSheet: { corners: [c[3], c[1], c[0], c[2]], reference: a4, swapSides } });
      expect(farSpan(fused)).toBeCloseTo(1000, 5);
    }
  });

  it("is pulled toward the truth by a second sheet and by a known length", () => {
    // The first sheet's corners are tapped 3 pixels out; the far references are tapped exactly.
    const off = [[3, -3], [-3, 3], [3, 3], [-3, -3]];
    const sheet = { ...first(), corners: first().corners.map((p, i) => ({ ...p, x: p.x + off[i][0], y: p.y + off[i][1] })) };
    const alone = Math.abs(farSpan(solveFused({ sheet })) - 1000);
    const withSheet = Math.abs(farSpan(solveFused({ sheet, secondSheet: { corners: exact(A4_FAR_ON_FLOOR), reference: a4 } })) - 1000);
    const withLength = Math.abs(farSpan(solveFused({ sheet, spans: [known()] })) - 1000);
    expect(alone).toBeGreaterThan(100);
    expect(withSheet).toBeLessThan(alone / 5);
    expect(withLength).toBeLessThan(alone / 2);
  });

  it("refuses in words when an extra reference cannot be used", () => {
    const c = exact(A4_FAR_ON_FLOOR);
    const inLine = [c[0], c[1], { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 + 0.2 }, c[3]];
    expect(reason(solveFused({ sheet: first(), secondSheet: { corners: inLine, reference: a4 } })))
      .toMatch(/^The second sheet cannot be used: corners/);
    expect(reason(solveFused({ sheet: first(), spans: [known(), known(0)] })))
      .toBe("Known length 2 cannot be used: its length is zero or missing.");
    expect(reason(solveFused({ sheet: first(), spans: [known(NaN)] }))).toMatch(/Known length 1 cannot be used/);
    expect(reason(solveFused({ sheet: first(), spans: [{ ...known(), b: known().a }] })))
      .toBe("Known length 1 cannot be used: its two ends are on the same spot.");
    expect(reason(solveFused({ sheet: { ...first(), corners: first().corners.slice(0, 3) } })))
      .toBe("The four corners cannot be used: needs four corners.");
  });

  it("refuses when the known sizes contradict each other, naming the odd one out and by how much", () => {
    // A true metre near the first sheet, typed in as two.
    const [a, b] = exact([{ x: -300, y: 600 }, { x: 500, y: 1200 }]);
    const typo = reason(solveFused({ sheet: first(), spans: [{ a, b, lengthMm: 2000 }] }));
    expect(typo).toMatch(/^Known length 1 contradicts the first sheet\. Going by the first sheet, it is 50% smaller than the length typed\./);
    expect(typo).toMatch(/The taps disagree about 11 times more than tap error explains/);
    // With a good second sheet also in the photo, the blame still lands on the typed length.
    const second = { corners: exact(A4_FAR_ON_FLOOR), reference: a4 };
    expect(reason(solveFused({ sheet: first(), secondSheet: second, spans: [known(), { a, b, lengthMm: 2000 }] })))
      .toMatch(/^Known length 2 contradicts the other known sizes\. Going by the other known sizes, it is 50% smaller/);
    // An A4 sheet beside the first one, declared twice its size, or with its long side the wrong way.
    const beside = exact(sheetOnFloor(297, 210, { x: 600, y: 500 }, 20));
    const big = { id: "big", label: "Twice A4", long: 594, short: 420 };
    expect(reason(solveFused({ sheet: first(), secondSheet: { corners: beside, reference: big } })))
      .toMatch(/^The second sheet contradicts the first sheet\. Going by the first sheet, one pair of its sides is 50% smaller than the paper chosen and the other pair is 50% smaller\./);
    expect(reason(solveFused({ sheet: first(), secondSheet: { corners: beside, reference: a4, swapSides: true } })))
      .toMatch(/one pair of its sides is 41% larger than the paper chosen and the other pair is 29% smaller/);
    // A believable disagreement (a tap a few pixels out) is not a contradiction.
    expect(solveFused({ sheet: first(), spans: [{ a, b, lengthMm: 1005 }] }).ok).toBe(true);
  });

  it("cannot notice a wrong size on a reference far from the first sheet (a known limit)", () => {
    // Four metres out, the first sheet knows the floor too poorly to argue: a
    // metre typed as two, or an A4 sheet declared A3, is believed, and the far
    // end of the map is then wrong by that factor. The page must not present
    // the refusal above as a check that the far reference is right.
    expect(farSpan(solveFused({ sheet: first(), spans: [known(2000)] }))).toBeGreaterThan(1500);
    const a3 = { id: "a3", label: "A3", long: 420, short: 297 };
    expect(farSpan(solveFused({ sheet: first(), secondSheet: { corners: exact(A4_FAR_ON_FLOOR), reference: a3 } }))).toBeGreaterThan(1300);
  });

  it("is a pure function: same taps, same map, and the input is left alone", () => {
    const { input } = retake("two sheets", 5, gaussian(seededRandom(3)));
    const before = JSON.stringify(input);
    expect(solveFused(input)).toEqual(solveFused(input));
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("jitterFused", () => {
  const input: FusedInput = {
    sheet: { corners: tapped(LETTER_ON_FLOOR, 2, () => 0), reference: letter, swapSides: true },
    secondSheet: { corners: tapped(A4_FAR_ON_FLOOR, 7, () => 0), reference: a4 },
    spans: [{ a: { x: 10, y: 20, s: 4 }, b: { x: 30, y: 40 }, lengthMm: 500 }],
  };

  it("moves every tap by its own s and changes nothing else", () => {
    const before = JSON.stringify(input);
    const moved = jitterFused(input, () => 1); // every draw is one standard deviation
    expect(JSON.stringify(input)).toBe(before);
    moved.sheet.corners.forEach((p, i) =>
      expect(p).toEqual({ x: input.sheet.corners[i].x + 2, y: input.sheet.corners[i].y + 2, s: 2 }));
    moved.secondSheet!.corners.forEach((p, i) =>
      expect(p).toEqual({ x: input.secondSheet!.corners[i].x + 7, y: input.secondSheet!.corners[i].y + 7, s: 7 }));
    // A tap that carries no s moves by the same 1.5 pixel fallback the one-sheet measure uses.
    expect(moved.spans).toEqual([{ a: { x: 14, y: 24, s: 4 }, b: { x: 31.5, y: 41.5 }, lengthMm: 500 }]);
    expect(moved.sheet.swapSides).toBe(true);
    expect(moved.secondSheet!.reference).toBe(a4);
    expect(jitterFused({ sheet: input.sheet }, () => 1)).not.toHaveProperty("secondSheet");
  });

  it("repeats exactly for the same seed and differs for another", () => {
    const run = (seed: number) => jitterFused(input, gaussian(seededRandom(seed)));
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });
});

// The gain, in numbers. 400 simulated retakes of the same photo per case, every
// tap landing `sigma` photo pixels off, measuring a true 1000 mm span about
// four metres past the Letter sheet. The medians are pinned to the millimetre
// so the figures quoted to the team can be reproduced by running this file.
describe("accuracy of a one-metre span about four metres past the first sheet", () => {
  const RETAKES = 400;
  function medianError(which: Case, sigma: number): { mm: number; noNumber: number } {
    const normal = gaussian(seededRandom(20261011));
    const errors: number[] = [];
    for (let i = 0; i < RETAKES; i++) {
      const { input, a, b } = retake(which, sigma, normal);
      const fused = solveFused(input);
      const d = fused.ok ? planeDistance(fused.h, a, b) : null;
      if (d !== null) errors.push(Math.abs(d - FAR_SPAN.mm));
    }
    return { mm: median(errors), noNumber: RETAKES - errors.length };
  }
  // sigma, then [median absolute error in mm, retakes with no number] per case.
  const MEASURED: [number, Record<Case, [number, number]>][] = [
    [1.5, { "one sheet": [139.3, 0], "two sheets": [10.6, 0], "one sheet and one known length": [29.9, 0] }],
    [5, { "one sheet": [394.0, 7], "two sheets": [35.5, 0], "one sheet and one known length": [78.4, 0] }],
  ];
  for (const [sigma, want] of MEASURED)
    it(`taps ${sigma} px off: two sheets and a known length each beat one sheet by a clear margin`, () => {
      const got = Object.fromEntries((Object.keys(want) as Case[]).map((k) => [k, medianError(k, sigma)])) as Record<Case, { mm: number; noNumber: number }>;
      console.log(`fused accuracy, sigma ${sigma} px, ${RETAKES} retakes:`, JSON.stringify(got));
      expect(got["two sheets"].mm).toBeLessThan(got["one sheet"].mm / 4);
      expect(got["one sheet and one known length"].mm).toBeLessThan(got["one sheet"].mm / 2);
      for (const k of Object.keys(want) as Case[]) {
        expect(Math.abs(got[k].mm - want[k][0])).toBeLessThan(0.5);
        expect(got[k].noNumber).toBe(want[k][1]);
      }
    });

  it("solves in well under 2 ms (measured: see the report)", () => {
    const normal = gaussian(seededRandom(1));
    const inputs = Array.from({ length: 300 }, () => retake("two sheets", 5, normal).input);
    for (const input of inputs.slice(0, 50)) solveFused(input); // warm up
    const t0 = performance.now();
    for (const input of inputs) solveFused(input);
    const each = (performance.now() - t0) / inputs.length;
    console.log(`fused solve time, two sheets: ${each.toFixed(3)} ms per solve`);
    expect(each).toBeLessThan(2);
  });
});
