import { describe, expect, it } from "vitest";
import {
  CLOSE_SNAP_M,
  distXZ,
  isNearFirst,
  polygonAreaXZ,
  scanMeasures,
  scanProblem,
  selfCrossesXZ,
  wallLengthsM,
  type Pt3,
} from "../src/scan/geometry";
import { SAMPLE_SCAN_ROOM } from "../src/scan/sample";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Turn (x, z) shorthand into a Pt3 on the floor (Y = 0). */
const pt = (x: number, z: number): Pt3 => ({ x, y: 0, z });

/** A 4 m × 3 m rectangle, corners going clockwise. */
const RECT: Pt3[] = [pt(0, 0), pt(4, 0), pt(4, 3), pt(0, 3)];

// ─── distXZ ─────────────────────────────────────────────────────────────────

describe("distXZ", () => {
  it("measures the XZ distance, ignoring Y", () => {
    // 3-4-5 triangle in XZ, large Y offset that should be ignored.
    expect(distXZ({ x: 0, y: 0, z: 0 }, { x: 3, y: 10, z: 4 })).toBeCloseTo(5);
    expect(distXZ(pt(0, 0), pt(4, 0))).toBeCloseTo(4);
    expect(distXZ(pt(0, 0), pt(0, 3))).toBeCloseTo(3);
  });
});

// ─── wallLengthsM ───────────────────────────────────────────────────────────

describe("wallLengthsM", () => {
  it("gives the four wall lengths of the rectangle including the closing wall", () => {
    const walls = wallLengthsM(RECT);
    [4, 3, 4, 3].forEach((expected, i) => expect(walls[i]).toBeCloseTo(expected));
  });

  it("gives three walls of a 3-4-5 right triangle", () => {
    const tri = [pt(0, 0), pt(3, 0), pt(0, 4)];
    const walls = wallLengthsM(tri);
    [3, 5, 4].forEach((expected, i) => expect(walls[i]).toBeCloseTo(expected));
  });
});

// ─── polygonAreaXZ ──────────────────────────────────────────────────────────

describe("polygonAreaXZ", () => {
  it("gives 12 m² for the 4×3 rectangle regardless of winding", () => {
    expect(polygonAreaXZ(RECT)).toBeCloseTo(12);
    expect(polygonAreaXZ([...RECT].reverse())).toBeCloseTo(12);
  });

  it("gives 6 m² for the 3-4-5 right triangle", () => {
    expect(polygonAreaXZ([pt(0, 0), pt(3, 0), pt(0, 4)])).toBeCloseTo(6);
  });

  it("ignores the Y coordinate", () => {
    const lifted: Pt3[] = [
      { x: 0, y: 1.5, z: 0 },
      { x: 4, y: 1.2, z: 0 },
      { x: 4, y: 0.8, z: 3 },
      { x: 0, y: 1.1, z: 3 },
    ];
    expect(polygonAreaXZ(lifted)).toBeCloseTo(12);
  });
});

// ─── selfCrossesXZ ──────────────────────────────────────────────────────────

describe("selfCrossesXZ", () => {
  it("is false for a convex rectangle", () => {
    expect(selfCrossesXZ(RECT)).toBe(false);
  });

  it("is true for a bow-tie (corners 3 and 4 swapped)", () => {
    const bowTie: Pt3[] = [pt(0, 0), pt(4, 0), pt(0, 3), pt(4, 3)];
    expect(selfCrossesXZ(bowTie)).toBe(true);
  });

  it("is false for an L-shape", () => {
    const lShape: Pt3[] = [
      pt(0, 0), pt(2, 0), pt(2, 1), pt(3, 1), pt(3, 3), pt(0, 3),
    ];
    expect(selfCrossesXZ(lShape)).toBe(false);
  });
});

// ─── isNearFirst ────────────────────────────────────────────────────────────

describe("isNearFirst", () => {
  const three: Pt3[] = [pt(0, 0), pt(4, 0), pt(4, 3)];

  it("is true when the candidate is within CLOSE_SNAP_M of the first corner", () => {
    expect(isNearFirst(three, pt(CLOSE_SNAP_M - 0.01, 0))).toBe(true);
  });

  it("is true at exactly CLOSE_SNAP_M", () => {
    expect(isNearFirst(three, pt(CLOSE_SNAP_M, 0))).toBe(true);
  });

  it("is false when the candidate is beyond CLOSE_SNAP_M", () => {
    expect(isNearFirst(three, pt(CLOSE_SNAP_M + 0.01, 0))).toBe(false);
  });

  it("is false when fewer than three corners have been placed", () => {
    const two: Pt3[] = [pt(0, 0), pt(4, 0)];
    expect(isNearFirst(two, pt(0.1, 0))).toBe(false);
  });

  it("is false for an empty array", () => {
    expect(isNearFirst([], pt(0, 0))).toBe(false);
  });
});

// ─── scanProblem ────────────────────────────────────────────────────────────

describe("scanProblem", () => {
  it("is null for a valid rectangle", () => {
    expect(scanProblem(RECT)).toBeNull();
  });

  it("explains when there are fewer than three corners", () => {
    expect(scanProblem([pt(0, 0), pt(4, 0)])).toMatch(/at least three corners/);
    expect(scanProblem([])).toMatch(/at least three corners/);
  });

  it("explains a self-crossing outline", () => {
    const bowTie: Pt3[] = [pt(0, 0), pt(4, 0), pt(0, 3), pt(4, 3)];
    expect(scanProblem(bowTie)).toMatch(/crosses itself/);
  });

  it("explains collinear corners", () => {
    expect(scanProblem([pt(0, 0), pt(1, 0), pt(2, 0)])).toMatch(/one line/);
  });
});

// ─── scanMeasures ───────────────────────────────────────────────────────────

describe("scanMeasures", () => {
  it("gives the correct walls, perimeter and area for the rectangle", () => {
    const m = scanMeasures(RECT);
    expect(m.ok).toBe(true);
    if (!m.ok) throw new Error("expected ok");
    [4, 3, 4, 3].forEach((expected, i) => expect(m.walls[i]).toBeCloseTo(expected));
    expect(m.perimeter).toBeCloseTo(14);
    expect(m.area).toBeCloseTo(12);
  });

  it("fails for a self-crossing outline", () => {
    expect(scanMeasures([pt(0, 0), pt(4, 0), pt(0, 3), pt(4, 3)]).ok).toBe(false);
  });

  it("fails for fewer than three corners", () => {
    expect(scanMeasures([pt(0, 0), pt(4, 0)]).ok).toBe(false);
  });

  it("works for an L-shaped room", () => {
    // Outer 4×3 minus a 2×1 notch cut from NE corner.
    // SW(0,0)→SE(4,0)→(4,2)→(2,2)→(2,3)→NW(0,3)  area = 12 - 2 = 10 m²
    const lRoom: Pt3[] = [
      pt(0, 0), pt(4, 0), pt(4, 2), pt(2, 2), pt(2, 3), pt(0, 3),
    ];
    const m = scanMeasures(lRoom);
    expect(m.ok).toBe(true);
    if (!m.ok) throw new Error("expected ok");
    expect(m.area).toBeCloseTo(10);
    expect(m.perimeter).toBeCloseTo(4 + 2 + 2 + 1 + 2 + 3);
  });
});

// ─── SAMPLE_SCAN_ROOM ────────────────────────────────────────────────────────

describe("SAMPLE_SCAN_ROOM", () => {
  it("has the expected geometry (4 × 3 m, 2.4 m tall)", () => {
    const m = scanMeasures(SAMPLE_SCAN_ROOM.corners);
    expect(m.ok).toBe(true);
    if (!m.ok) throw new Error("expected ok");
    [4, 3, 4, 3].forEach((expected, i) => expect(m.walls[i]).toBeCloseTo(expected));
    expect(m.perimeter).toBeCloseTo(14);
    expect(m.area).toBeCloseTo(12);
    expect(SAMPLE_SCAN_ROOM.height).toBe(2.4);
    expect(SAMPLE_SCAN_ROOM.heightSource).toBe("measured");
  });
});
