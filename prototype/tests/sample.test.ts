import { describe, expect, it } from "vitest";
import { report } from "../src/app/report";
import { placeSampleTaps } from "../src/app/sample-taps";
import { newState } from "../src/app/state";
import { dist } from "../src/measure/homography";
import { projectFloor, SAMPLE_FLOOR, SAMPLE_SIZE, SAMPLE_TRUTH, sampleTaps } from "../src/sample/floor";
import { project } from "./scene";

const SETTINGS = { paper: "letter", swap: false, unit: "cm" as const };

describe("the made-up sample floor", () => {
  it("uses the same camera as the test scene, and every marked spot is inside the picture", () => {
    for (const p of [{ x: 0, y: 0 }, { x: -700, y: 2200 }, { x: 800, y: -300 }])
      expect(dist(projectFloor(p), project(p))).toBeLessThan(1e-9);
    for (const group of Object.values(SAMPLE_FLOOR))
      for (const p of group.map(projectFloor)) {
        expect(p.x).toBeGreaterThan(40);
        expect(p.x).toBeLessThan(SAMPLE_SIZE.w - 40);
        expect(p.y).toBeGreaterThan(40);
        expect(p.y).toBeLessThan(SAMPLE_SIZE.h - 40);
      }
  });

  it("knows its own true values", () => {
    expect(SAMPLE_TRUTH.distance).toBeCloseTo(1000, 9);
    expect(SAMPLE_TRUTH.walls.map((w) => Math.round(w))).toEqual([1500, 1500, 600, 1000, 900, 2500]);
    expect(SAMPLE_TRUTH.perimeter).toBeCloseTo(8000, 9);
    expect(SAMPLE_TRUTH.area).toBeCloseTo(3_150_000, 6);
    expect(SAMPLE_TRUTH.gap).toBeCloseTo(900, 9);
    expect(SAMPLE_TRUTH.span).toBeCloseTo(1000, 9);
    const second = SAMPLE_FLOOR.second;
    expect(dist(second[0], second[1])).toBeCloseTo(297, 9);
    expect(dist(second[1], second[2])).toBeCloseTo(210, 9);
  });

  it("places the taps for the distance tool and shows the true value beside the measured one", () => {
    const s = newState();
    expect(placeSampleTaps(s)).toBe(6);
    expect(s.points.sheet).toHaveLength(4);
    expect(s.points.ends.map((p) => p.s)).toEqual([1.5, 1.5]);
    const words = report(s, { hasPhoto: true, notice: "", sample: true }, SETTINGS);
    expect(words.result).toBe("A to B: 100 ± 2 cm");
    expect(words.truth).toBe("True value on this made-up floor: A to B is 100 cm.");
    expect(report(s, { hasPhoto: true, notice: "", sample: true }, { ...SETTINGS, unit: "in" }).truth).toContain("39.4 in");
    // A real photo has no known truth, and nothing is printed for one.
    expect(report(s, { hasPhoto: true, notice: "", sample: false }, SETTINGS).truth).toBe("");
    expect(placeSampleTaps(s)).toBe(0);
  });

  it("carries on from taps the person already made", () => {
    const s = newState();
    for (const tap of sampleTaps("sheet").slice(0, 2)) s.points.sheet.push(tap);
    expect(placeSampleTaps(s)).toBe(4);
    expect(s.points.ends).toHaveLength(2);
  });
});
