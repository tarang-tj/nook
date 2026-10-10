import { describe, expect, it } from "vitest";
import { measureFloorDistance, type Outcome } from "../src/measure/floor-distance";
import { referenceById } from "../src/measure/references";
import type { Pt } from "../src/measure/homography";
import { letterInPhoto, project } from "./scene";

const letter = referenceById("letter");

/** Measure between two floor points (mm) in the made-up scene. */
function measure(a: Pt, b: Pt, extra: { corners?: Pt[]; swapSides?: boolean } = {}): Outcome {
  return measureFloorDistance({
    corners: extra.corners ?? letterInPhoto(),
    a: project(a),
    b: project(b),
    reference: letter,
    unit: "cm",
    swapSides: extra.swapSides,
    sigmaPx: 1.5,
  });
}
const ok = (o: Outcome) => {
  if (!o.ok) throw new Error(`expected a measurement, got: ${o.reason}`);
  return o;
};

describe("measureFloorDistance", () => {
  it("equals the truth when the taps are exact", () => {
    // 1 m straight across, and a diagonal of 3-4-5 proportions (1.5 m).
    const across = ok(measure({ x: -300, y: 400 }, { x: 700, y: 400 }));
    expect(across.measured.value).toBeCloseTo(100, 6);
    const diagonal = ok(measure({ x: -400, y: 300 }, { x: 500, y: 1500 }));
    expect(diagonal.measured.value).toBeCloseTo(150, 6);
  });

  it("does not care what order the corners were tapped in", () => {
    const c = letterInPhoto();
    const shuffled = ok(measure({ x: -300, y: 400 }, { x: 700, y: 400 }, { corners: [c[2], c[0], c[3], c[1]] }));
    expect(shuffled.measured.value).toBeCloseTo(100, 6);
  });

  it("gives a wrong length if the long side is assigned the wrong way round", () => {
    // This is why the page has the 'long side looks shorter' switch.
    const swapped = ok(measure({ x: -300, y: 400 }, { x: 700, y: 400 }, { swapSides: true }));
    expect(Math.abs(swapped.measured.value - 100)).toBeGreaterThan(5);
  });

  it("has an error bar that grows with distance from the sheet", () => {
    // The same 50 cm span, moved further and further away from the sheet.
    const bars = [300, 1000, 2000, 3000].map(
      (y) => ok(measure({ x: -250, y }, { x: 250, y })).measured.error,
    );
    for (const bar of bars) expect(bar).toBeGreaterThan(0);
    for (let i = 1; i < bars.length; i++) expect(bars[i]).toBeGreaterThan(bars[i - 1]);
  });

  it("gives the same bar every time for the same taps", () => {
    const one = ok(measure({ x: 0, y: 500 }, { x: 800, y: 900 }));
    const two = ok(measure({ x: 0, y: 500 }, { x: 800, y: 900 }));
    expect(two.measured.error).toBe(one.measured.error);
    expect(one.text).toMatch(/^\d+(\.\d+)? ± \d+(\.\d+)? cm$/);
    expect(one.measured.basis).toMatch(/leaves out/);
  });

  it("says why instead of showing a number when it cannot measure", () => {
    const c = letterInPhoto();
    const inLine = measure({ x: 0, y: 500 }, { x: 800, y: 900 }, {
      corners: [c[0], c[1], { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 }, c[3]],
    });
    expect(inLine).toEqual({ ok: false, reason: expect.stringContaining("four corners cannot be used") });

    const sameSpot = measure({ x: 100, y: 500 }, { x: 100, y: 500 });
    expect(sameSpot).toEqual({ ok: false, reason: expect.stringContaining("same spot") });

    // Far from the sheet with sloppy taps, the bar swallows the distance.
    const far = measureFloorDistance({
      corners: c, a: project({ x: -250, y: 6000 }), b: project({ x: 250, y: 6000 }),
      reference: letter, unit: "cm", sigmaPx: 12,
    });
    expect(far.ok).toBe(false);
    if (!far.ok) expect(far.reason).toMatch(/Too uncertain|error bar/);

    // A tap above the horizon (the top of the photo) is not on the floor.
    const sky = measureFloorDistance({
      corners: c, a: project({ x: 0, y: 500 }), b: { x: 1500, y: 5 }, reference: letter, unit: "cm",
    });
    expect(sky.ok).toBe(false);
    if (!sky.ok) expect(sky.reason).toMatch(/horizon|error bar/);
  });
});
