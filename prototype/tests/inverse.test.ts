import { describe, expect, it } from "vitest";
import { applyHomography, dist, mul, solveHomography, type Mat3 } from "../src/measure/homography";
import { floorToPhoto, invert3 } from "../src/measure/inverse";
import { LETTER_ON_FLOOR, letterInPhoto, project, ROOM_ON_FLOOR } from "./scene";

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe("the plane map backwards", () => {
  it("inverts a matrix: m times its inverse is the identity, both ways round", () => {
    const m: Mat3 = [2, -1, 30, 0.5, 3, -20, 0.001, -0.002, 1];
    const inverse = invert3(m)!;
    mul(m, inverse).forEach((v, k) => expect(v).toBeCloseTo(IDENTITY[k], 12));
    mul(inverse, m).forEach((v, k) => expect(v).toBeCloseTo(IDENTITY[k], 12));
    expect(invert3([1, 2, 3, 0, 1, 4, 5, 6, 0])!.map((v) => Math.round(v))).toEqual([-24, 18, 5, 20, -15, -4, -5, 4, 1]);
  });

  it("refuses a matrix that has no inverse", () => {
    expect(invert3([1, 2, 3, 2, 4, 6, 0, 1, 1])).toBeNull();
    expect(invert3([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(invert3([1, 0, 0, 0, NaN, 0, 0, 0, 1])).toBeNull();
  });

  it("takes floor millimetres back to the photo pixel they came from", () => {
    const h = solveHomography(letterInPhoto(), LETTER_ON_FLOOR)!;
    const back = floorToPhoto(h, ROOM_ON_FLOOR)!;
    ROOM_ON_FLOOR.forEach((floor, i) => {
      expect(dist(back[i], project(floor))).toBeLessThan(1e-6);
      expect(dist(applyHomography(h, back[i])!, floor)).toBeLessThan(1e-6);
    });
  });

  it("gives nothing for a floor point behind the camera, or a map with no inverse", () => {
    const h = solveHomography(letterInPhoto(), LETTER_ON_FLOOR)!;
    expect(floorToPhoto(h, [{ x: 0, y: -4000 }])).toBeNull(); // the camera stands at y = -1500
    expect(floorToPhoto([1, 2, 3, 2, 4, 6, 0, 1, 1], [{ x: 0, y: 0 }])).toBeNull();
  });
});
