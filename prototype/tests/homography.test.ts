import { describe, expect, it } from "vitest";
import { applyHomography, solveHomography, type Mat3, type Pt } from "../src/measure/homography";
import { degenerateReason, orderCorners, solveSheet } from "../src/measure/sheet";

/** Apply a matrix directly, as the reference answer. */
const through = (m: Mat3, p: Pt): Pt => {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w };
};

describe("solveHomography", () => {
  it("recovers a known projective map", () => {
    // A map with real perspective in it (the bottom row is not 0 0 1).
    const known: Mat3 = [1.2, 0.1, 30, -0.2, 0.9, 12, 0.0004, 0.0007, 1];
    const src: Pt[] = [
      { x: 100, y: 120 },
      { x: 900, y: 80 },
      { x: 950, y: 700 },
      { x: 60, y: 640 },
    ];
    const h = solveHomography(src, src.map((p) => through(known, p)));
    expect(h).not.toBeNull();
    // A fifth point that was not used in the solve must land where the known map puts it.
    for (const probe of [{ x: 500, y: 400 }, { x: 1300, y: 900 }, { x: -50, y: 20 }]) {
      const got = applyHomography(h!, probe)!;
      const want = through(known, probe);
      expect(got.x).toBeCloseTo(want.x, 6);
      expect(got.y).toBeCloseTo(want.y, 6);
    }
  });

  it("returns null for four points on one line", () => {
    const line: Pt[] = [0, 1, 2, 3].map((i) => ({ x: i * 10, y: i * 10 }));
    const square: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    expect(solveHomography(line, square)).toBeNull();
  });
});

describe("corners", () => {
  const square: Pt[] = [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }, { x: 10, y: 110 }];

  it("orders taps the same way whatever order they were made in", () => {
    const shuffled = [square[2], square[0], square[3], square[1]];
    expect(orderCorners(shuffled)).toEqual(square);
  });

  it("explains corners that cannot be used", () => {
    expect(degenerateReason(square)).toBeNull();
    expect(degenerateReason(square.slice(0, 3))).toBe("needs four corners");
    const inLine = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0.5 }, { x: 50, y: 80 }];
    expect(degenerateReason(inLine)).toBe("corners overlap or are nearly in a line");
    const dented = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 100 }];
    expect(degenerateReason(dented)).toBe("corners do not form a convex four-sided shape");
    const tiny = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }];
    expect(degenerateReason(tiny)).toBe("the sheet is too small in the photo to measure from");
    expect(solveSheet(inLine, 279.4, 215.9, false)).toBeNull();
  });
});
