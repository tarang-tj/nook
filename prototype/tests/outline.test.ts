import { describe, expect, it } from "vitest";
import { solveHomography, type Pt } from "../src/measure/homography";
import { gaussian, seededRandom } from "../src/measure/monte-carlo";
import {
  areaFromMm2, areaUnit, floorPoints, OUTLINE_BASIS, outlineMeasures, outlineProblem, polygonArea, selfCrosses, wallLengths,
} from "../src/measure/outline";
import { spreadOf, withBar } from "../src/measure/spread";
import {
  fromTaps, L_ROOM_ON_FLOOR, L_ROOM_TRUTH, LETTER_ON_FLOOR, letterInPhoto, project, retake, ROOM_ON_FLOOR, ROOM_TRUTH,
} from "./scene";

const ok = (corners: Pt[]) => {
  const m = outlineMeasures(corners);
  if (!m.ok) throw new Error(`expected measures, got: ${m.reason}`);
  return m;
};
/** One number of the outline: wall 0.., then the perimeter, then the area. */
const pick = (q: number, walls: number) => (floor: Pt[]) => {
  const m = outlineMeasures(floor);
  return !m.ok ? null : q < walls ? m.walls[q] : q === walls ? m.perimeter : m.area;
};

describe("outlineMeasures", () => {
  it("gives every wall, the perimeter and the area of a rectangle and an L", () => {
    expect(ok(ROOM_ON_FLOOR)).toEqual({ ok: true, ...ROOM_TRUTH });
    expect(ok(L_ROOM_ON_FLOOR)).toEqual({ ok: true, ...L_ROOM_TRUTH });
  });

  it("gives the same area whichever way round the corners were tapped", () => {
    const back = [...L_ROOM_ON_FLOOR].reverse();
    expect(ok(back).area).toBe(L_ROOM_TRUTH.area);
    expect(ok(back).perimeter).toBe(L_ROOM_TRUTH.perimeter);
    // A 3-4-5 triangle: the smallest outline there is.
    expect(ok([{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 0, y: 4000 }])).toEqual({
      ok: true, walls: [3000, 5000, 4000], perimeter: 12000, area: 6_000_000,
    });
  });

  it("recovers the room from exact taps in the photo", () => {
    const h = solveHomography(letterInPhoto(), LETTER_ON_FLOOR)!;
    const m = ok(floorPoints(h, L_ROOM_ON_FLOOR.map(project))!);
    m.walls.forEach((wall, i) => expect(wall).toBeCloseTo(L_ROOM_TRUTH.walls[i], 5));
    expect(m.perimeter).toBeCloseTo(8000, 5);
    expect(m.area / 1e6).toBeCloseTo(3.15, 8);
  });

  it("says why when the corners are not an outline", () => {
    const two = ROOM_ON_FLOOR.slice(0, 2);
    expect(outlineMeasures(two)).toEqual({ ok: false, reason: expect.stringContaining("at least three corners") });
    expect(outlineMeasures([])).toMatchObject({ ok: false });
    const twice = [ROOM_ON_FLOOR[0], ROOM_ON_FLOOR[1], { x: 800.2, y: -300.3 }, ROOM_ON_FLOOR[3]];
    expect(outlineMeasures(twice)).toEqual({ ok: false, reason: "Corners 2 and 3 are on the same spot." });
    // Corners 3 and 4 tapped in the wrong order: a bow-tie.
    const bowTie = [ROOM_ON_FLOOR[0], ROOM_ON_FLOOR[1], ROOM_ON_FLOOR[3], ROOM_ON_FLOOR[2]];
    expect(selfCrosses(bowTie)).toBe(true);
    expect(outlineMeasures(bowTie)).toEqual({ ok: false, reason: expect.stringContaining("crosses itself") });
    const line = [{ x: 0, y: 0 }, { x: 500, y: 500 }, { x: 900, y: 900 }];
    expect(outlineMeasures(line)).toEqual({ ok: false, reason: expect.stringContaining("one line") });
    expect(outlineMeasures([...two, { x: NaN, y: 0 }])).toEqual({ ok: false, reason: expect.stringContaining("no position") });
    expect(outlineProblem(ROOM_ON_FLOOR)).toBeNull();
    expect(selfCrosses(L_ROOM_ON_FLOOR)).toBe(false);
  });

  it("has helpers that agree with it", () => {
    expect(wallLengths(ROOM_ON_FLOOR)).toEqual(ROOM_TRUTH.walls);
    expect(polygonArea(ROOM_ON_FLOOR)).toBe(ROOM_TRUTH.area);
    expect(areaFromMm2(3_750_000, "cm")).toBeCloseTo(37500, 9);
    expect(areaFromMm2(645.16, "in")).toBeCloseTo(1, 9);
    expect(areaUnit("cm")).toBe("cm²");
  });
});

describe("floorPoints", () => {
  it("refuses a tap at or above the floor's horizon", () => {
    // This camera's horizon is 240 pixels above the top edge of the photo.
    const h = solveHomography(letterInPhoto(), LETTER_ON_FLOOR)!;
    expect(floorPoints(h, [project({ x: 0, y: 500 }), { x: 1500, y: -400 }])).toBeNull();
    expect(floorPoints(h, [project({ x: 120, y: 500 })])![0].x).toBeCloseTo(120, 6);
  });
});

describe("error bars on an outline", () => {
  const taps = (sigma: number) => ROOM_ON_FLOOR.map(project).map((p) => ({ ...p, s: sigma }));
  const sheet = (sigma: number) => letterInPhoto().map((p) => ({ ...p, s: sigma }));
  const barOf = (q: number, sigma: number) => withBar(spreadOf(fromTaps(sheet(sigma), taps(sigma), pick(q, 4))));

  it("are wider for the far wall than the near one, and grow with tap noise", () => {
    const near = barOf(0, 1.5);
    const far = barOf(2, 1.5);
    const sloppy = barOf(0, 3);
    if (near.value === null || far.value === null || sloppy.value === null) throw new Error("expected bars");
    expect(near.value).toBeCloseTo(1500, 5);
    expect(far.error).toBeGreaterThan(2 * near.error);
    expect(sloppy.error).toBeGreaterThan(1.5 * near.error);
  });

  it("refuse the area in words when the taps are too sloppy for this room", () => {
    expect(barOf(5, 11)).toEqual({ value: null, reason: expect.stringMatching(/Too uncertain|No trustworthy/) });
  });
});

describe("calibration: does the bar hold the true room?", () => {
  /** Retake the photo's taps `retakes` times; for each number of the outline
   * count how often a bar was shown and how often it held the truth. */
  const run = (room: Pt[], truth: typeof ROOM_TRUTH, sigma: number, retakes: number) => {
    const n = truth.walls.length;
    const want = [...truth.walls, truth.perimeter, truth.area];
    const shown = want.map(() => 0);
    const held = want.map(() => 0);
    const normal = gaussian(seededRandom(4200 + sigma * 10 + n));
    for (let r = 0; r < retakes; r++) {
      const sheet = retake(letterInPhoto(), sigma, normal);
      const corners = retake(room.map(project), sigma, normal);
      want.forEach((truthValue, q) => {
        const bar = withBar(spreadOf(fromTaps(sheet, corners, pick(q, n)), { samples: 300 }));
        if (bar.value === null) return;
        shown[q]++;
        if (Math.abs(bar.value - truthValue) <= bar.error) held[q]++;
      });
    }
    return { shown, held };
  };

  it("rectangle, taps 1.5 photo pixels off: every number holds in 238 to 242 of 250 retakes", () => {
    // Walls 238, 241, 242, 242; perimeter 242; area 241. All between 95 and 97 in 100.
    const { shown, held } = run(ROOM_ON_FLOOR, ROOM_TRUTH, 1.5, 250);
    expect(shown).toEqual([250, 250, 250, 250, 250, 250]);
    for (const count of held) expect(count).toBeGreaterThanOrEqual(230); // 92%
    expect(Math.min(...held)).toBeLessThan(250);
  }, 60000);

  it("L-shaped room, taps 1.5 photo pixels off: every number holds in 140 to 146 of 150 retakes", () => {
    // Walls 143, 140, 140, 146, 145, 144; perimeter 146; area 144. Between 93 and 97 in 100.
    const { shown, held } = run(L_ROOM_ON_FLOOR, L_ROOM_TRUTH, 1.5, 150);
    expect(shown).toEqual([150, 150, 150, 150, 150, 150, 150, 150]);
    for (const count of held) expect(count).toBeGreaterThanOrEqual(138); // 92%
  }, 60000);

  it("rectangle, taps 6 photo pixels off: mostly refused, and the bars still shown are optimistic (area 41 of 52)", () => {
    // Shown out of 250: walls 240, 104, 43, 120; perimeter 94; area 52.
    // Held:             walls 238,  93, 41, 101; perimeter 88; area 41.
    // The near wall is fine. Far from the sheet most retakes are refused, and
    // the ones that slip through are the ones whose bar came out small, so
    // they hold the truth only 79 to 95 times in 100. OUTLINE_BASIS says so.
    const { shown, held } = run(ROOM_ON_FLOOR, ROOM_TRUTH, 6, 250);
    expect(held[0] / shown[0]).toBeGreaterThan(0.95);
    for (const q of [1, 2, 3, 4, 5]) {
      expect(shown[q]).toBeLessThan(125); // refused more often than shown
      expect(held[q] / shown[q]).toBeGreaterThan(0.75);
    }
    expect(OUTLINE_BASIS).toMatch(/sloppy.*8 in 10/);
  }, 60000);
});
