import { describe, expect, it } from "vitest";
import { dist, type Pt } from "../src/measure/homography";
import { distanceSpread, gaussian, MIN_SAMPLES, seededRandom } from "../src/measure/monte-carlo";
import { solveSheet, orderCorners } from "../src/measure/sheet";
import { solveHomography } from "../src/measure/homography";
import { floorPoints } from "../src/measure/outline";
import { jitterPoint, spreadOf, withBar, type Draw } from "../src/measure/spread";
import { fromTaps, letterInPhoto, project, retake } from "./scene";

/** A draw that hands out 1, 2, 3 and so on, to see exactly where each goes. */
const counting = (): Draw => {
  let n = 0;
  return () => ++n;
};

describe("jitterPoint", () => {
  it("moves a point by its own s, x first and then y", () => {
    expect(jitterPoint({ x: 10, y: 20, s: 4 }, counting())).toEqual({ x: 14, y: 28 });
    expect(jitterPoint({ x: 10, y: 20, s: 0 }, counting())).toEqual({ x: 10, y: 20 });
  });

  it("uses the page's default of 1.5 for a point that carries no s", () => {
    expect(jitterPoint({ x: 0, y: 0 }, counting())).toEqual({ x: 1.5, y: 3 });
  });
});

describe("spreadOf", () => {
  // A value that is 10 as placed and moves by 3 per unit of noise: sd is 3.
  const linear = (draw: Draw | null) => 10 + (draw ? 3 * draw() : 0);

  it("returns the value as placed and the spread of the simulated ones", () => {
    const got = spreadOf(linear, { samples: 4000 });
    if (got.value === null) throw new Error(got.reason);
    expect(got.value).toBe(10);
    expect(got.spread.sd).toBeGreaterThan(2.85);
    expect(got.spread.sd).toBeLessThan(3.15);
    expect(got.spread.kept).toBe(1);
  });

  it("gives the same spread for the same seed and a different one for another", () => {
    const sd = (seed?: number) => {
      const got = spreadOf(linear, { seed });
      if (got.value === null) throw new Error(got.reason);
      return got.spread.sd;
    };
    expect(sd()).toBe(sd());
    expect(sd(1)).not.toBe(sd(2));
  });

  it("never runs fewer trials than the sample floor", () => {
    let calls = 0;
    spreadOf((draw) => (calls++, linear(draw)), { samples: 10 });
    expect(calls).toBe(1 + MIN_SAMPLES); // once as placed, then the floor
  });

  it("matches distanceSpread exactly when the closure does the same solve", () => {
    const sheet = solveSheet(orderCorners(letterInPhoto().map((p) => ({ ...p, s: 2 }))), 279.4, 215.9, false)!;
    const a = { ...project({ x: -250, y: 1000 }), s: 2 };
    const b = { ...project({ x: 250, y: 1000 }), s: 2 };
    const old = distanceSpread(sheet, a, b, 2)!;
    const got = spreadOf((draw) => {
      const move = (p: Pt) => (draw ? jitterPoint(p, draw) : p);
      const h = solveHomography(sheet.ordered.map(move), sheet.plane);
      const floor = h ? floorPoints(h, [a, b].map(move)) : null;
      return floor ? dist(floor[0], floor[1]) : null;
    });
    if (got.value === null) throw new Error(got.reason);
    expect(got.value).toBeCloseTo(500, 6);
    expect(got.spread.sd).toBeCloseTo(old.sd, 9);
    expect(got.spread.kept).toBe(old.kept);
  });

  it("says why instead of giving a spread when it cannot", () => {
    expect(spreadOf(() => null)).toEqual({ value: null, reason: expect.stringContaining("as placed") });
    expect(spreadOf((draw) => (draw ? NaN : NaN))).toMatchObject({ value: null });
    // 30% of the simulated taps give nothing: too many to trust the rest.
    const flaky = (share: number) => (draw: Draw | null) => (draw && Math.abs(draw()) > share ? null : linear(draw));
    expect(spreadOf(flaky(1.04))).toEqual({ value: null, reason: expect.stringMatching(/No trustworthy error bar.*only \d+%/) });
    // 5% dropped: a spread, with the share that survived.
    const some = spreadOf(flaky(1.96));
    if (some.value === null) throw new Error(some.reason);
    expect(some.spread.kept).toBeGreaterThan(0.9);
    expect(some.spread.kept).toBeLessThan(1);
    expect(withBar(some)).toMatchObject({ warning: expect.stringContaining("lower bound") });
    // A trial that gives NaN is dropped too, and does not poison the rest.
    const nan = spreadOf((draw) => (draw && Math.abs(draw()) > 1.96 ? NaN : linear(draw)));
    if (nan.value === null) throw new Error(nan.reason);
    expect(nan.spread.sd).toBeGreaterThan(1);
    expect(nan.spread.kept).toBeLessThan(1);
  });
});

describe("withBar", () => {
  const spread = (sd: number) => ({ value: 100, spread: { sd, kept: 1 } });

  it("shows 2 standard deviations as the bar", () => {
    expect(withBar(spread(4))).toEqual({ value: 100, error: 8, warning: null });
  });

  it("refuses a size whose bar is as large as itself, but not room to spare", () => {
    expect(withBar(spread(50))).toEqual({ value: null, reason: expect.stringContaining("Too uncertain") });
    expect(withBar({ value: 3, spread: { sd: 20, kept: 1 } }, "signed")).toMatchObject({ value: 3, error: 40 });
    expect(withBar({ value: -30, spread: { sd: 20, kept: 1 } }, "signed")).toMatchObject({ value: -30, error: 40 });
    expect(withBar({ value: -30, spread: { sd: 2, kept: 1 } })).toMatchObject({ value: null });
  });

  it("refuses a bar of zero and passes a reason through", () => {
    expect(withBar(spread(0))).toEqual({ value: null, reason: expect.stringContaining("did not move") });
    expect(withBar({ value: null, reason: "because" })).toEqual({ value: null, reason: "because" });
  });
});

describe("calibration of a floor distance through spreadOf", () => {
  // An 80 cm gap about a metre past the sheet. Each retake taps the sheet and
  // both ends again, off by the stated noise, and gets its own bar.
  const ends = [{ x: -300, y: 900 }, { x: 500, y: 900 }].map(project);
  const run = (sigma: number) => {
    const normal = gaussian(seededRandom(9100 + sigma));
    let shown = 0;
    let held = 0;
    for (let r = 0; r < 300; r++) {
      const sheet = retake(letterInPhoto(), sigma, normal);
      const bar = withBar(spreadOf(fromTaps(sheet, retake(ends, sigma, normal), (f) => dist(f[0], f[1])), { samples: 300 }));
      if (bar.value === null) continue;
      shown++;
      if (Math.abs(bar.value - 800) <= bar.error) held++;
    }
    return { shown, held };
  };

  it("holds the truth in 280 of 300 retakes with taps 1.5 photo pixels off", () => {
    // 2 standard deviations should hold it about 95 times in 100. 280 of 300 is 93.
    const { shown, held } = run(1.5);
    expect(shown).toBe(300);
    expect(held).toBeGreaterThanOrEqual(276); // 92%
    expect(held).toBeLessThan(300); // a bar that always holds is too wide to be 2 sd
  }, 30000);

  it("holds the truth in 297 of 300 retakes with taps 6 photo pixels off", () => {
    const { shown, held } = run(6);
    expect(shown).toBe(300);
    expect(held).toBeGreaterThanOrEqual(276);
  }, 30000);
});
