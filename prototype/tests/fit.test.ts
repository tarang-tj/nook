import { describe, expect, it } from "vitest";
import { dist, type Pt } from "../src/measure/homography";
import { clearance, fitVerdict, footprint, insideOutline } from "../src/measure/fit";
import { gaussian, seededRandom } from "../src/measure/monte-carlo";
import { polygonArea } from "../src/measure/outline";
import { spreadOf, withBar } from "../src/measure/spread";
import { fromTaps, L_ROOM_ON_FLOOR, letterInPhoto, project, retake, ROOM_ON_FLOOR } from "./scene";

describe("fitVerdict", () => {
  const gap = { value: 800, error: 20 }; // 80 ± 2 cm

  it("says fits only when the whole bar clears the thing", () => {
    const v = fitVerdict(gap, 760);
    expect(v).toMatchObject({ verdict: "fits", spareMm: 20 });
    expect(v.sentence).toBe("The gap is 80 ± 2 cm and the thing needs 76 cm: fits, with at least 2 cm to spare.");
    expect(fitVerdict(gap, 780)).toMatchObject({ verdict: "fits", spareMm: 0 });
  });

  it("says does not fit only when the whole bar is short", () => {
    const v = fitVerdict(gap, 835);
    expect(v).toMatchObject({ verdict: "does not fit", spareMm: -15 });
    expect(v.sentence).toBe("The gap is 80 ± 2 cm and the thing needs 83.5 cm: does not fit, short by at least 1.5 cm.");
  });

  it("says too close to call when the thing's size is inside the bar", () => {
    for (const size of [781, 800, 810, 820]) expect(fitVerdict(gap, size).verdict).toBe("too close to call");
    expect(fitVerdict(gap, 810).sentence).toBe(
      "The gap is 80 ± 2 cm and the thing needs 81 cm: too close to call. The difference (1 cm) is inside the error bar.",
    );
  });

  it("states the numbers in inches when asked", () => {
    expect(fitVerdict({ value: 25.4 * 32, error: 25.4 * 0.5 }, 25.4 * 30, "in").sentence).toBe(
      "The gap is 32.0 ± 0.5 in and the thing needs 30 in: fits, with at least 1.5 in to spare.",
    );
  });

  it("cannot say, with the reason, when the gap has no honest number", () => {
    expect(fitVerdict({ value: null, reason: "A floor point is above the horizon." }, 760)).toEqual({
      verdict: "cannot say",
      reason: "A floor point is above the horizon.",
      sentence: "Cannot say: A floor point is above the horizon.",
    });
    expect(fitVerdict({ value: 800, error: NaN }, 760).verdict).toBe("cannot say");
    expect(fitVerdict({ value: NaN, error: 5 }, 760).verdict).toBe("cannot say");
    expect(fitVerdict({ value: 800, error: -1 }, 760).verdict).toBe("cannot say");
    expect(fitVerdict(gap, 0)).toMatchObject({ verdict: "cannot say", reason: expect.stringContaining("size of the thing") });
    expect(fitVerdict(gap, NaN).verdict).toBe("cannot say");
  });
});

describe("footprint", () => {
  it("puts the four corners round the centre", () => {
    expect(footprint({ x: 100, y: 500 }, 600, 400, 0)).toEqual([
      { x: -200, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 700 }, { x: -200, y: 700 },
    ]);
  });

  it("keeps its size and centre at any angle, and a quarter turn swaps the sides", () => {
    const f = footprint({ x: 100, y: 500 }, 600, 400, 0.7);
    expect(dist(f[0], f[1])).toBeCloseTo(600, 9);
    expect(dist(f[1], f[2])).toBeCloseTo(400, 9);
    expect(polygonArea(f)).toBeCloseTo(240000, 6);
    expect((f[0].x + f[2].x) / 2).toBeCloseTo(100, 9);
    expect((f[0].y + f[2].y) / 2).toBeCloseTo(500, 9);
    const turned = footprint({ x: 0, y: 0 }, 600, 400, Math.PI / 2);
    expect(Math.max(...turned.map((p) => p.x))).toBeCloseTo(200, 9);
    expect(Math.max(...turned.map((p) => p.y))).toBeCloseTo(300, 9);
  });
});

describe("clearance", () => {
  // The room runs from x -700 to 800 and y -300 to 2200.
  it("is the distance to the nearest wall when the thing is inside", () => {
    expect(clearance(footprint({ x: 0, y: 500 }, 600, 400, 0), ROOM_ON_FLOOR)).toBeCloseTo(400, 9);
    // A 400 mm square turned 45 degrees reaches 282.8 mm left of its centre.
    expect(clearance(footprint({ x: 0, y: 1000 }, 400, 400, Math.PI / 4), ROOM_ON_FLOOR)).toBeCloseTo(700 - 200 * Math.SQRT2, 6);
  });

  it("is zero when touching and negative by how far it sticks out", () => {
    expect(clearance(footprint({ x: 500, y: 500 }, 600, 400, 0), ROOM_ON_FLOOR)).toBeCloseTo(0, 9);
    expect(clearance(footprint({ x: 700, y: 500 }, 600, 400, 0), ROOM_ON_FLOOR)).toBeCloseTo(-200, 9);
    expect(clearance(footprint({ x: 5000, y: 500 }, 600, 400, 0), ROOM_ON_FLOOR)).toBeLessThan(-3900);
  });

  it("sees the inner corner of an L-shaped room", () => {
    // Inside the rectangle's bounds but over the bite taken out of the L.
    expect(clearance(footprint({ x: 200, y: 1200 }, 400, 400, 0), L_ROOM_ON_FLOOR)).toBeCloseTo(-200, 9);
    // A big thing that swallows the inner corner without a corner of its own outside.
    expect(clearance(footprint({ x: 0, y: 950 }, 1000, 700, 0), L_ROOM_ON_FLOOR)).toBeLessThan(0);
    expect(clearance(footprint({ x: -250, y: 1700 }, 500, 500, 0), L_ROOM_ON_FLOOR)).toBeCloseTo(200, 9);
  });

  it("sees a thin wall stub that pokes into the thing or runs right through it", () => {
    // The room with a stub of wall coming down from the far wall to y = `tip`.
    const stub = (x1: number, x2: number, tip: number): Pt[] => [
      ROOM_ON_FLOOR[0], ROOM_ON_FLOOR[1], ROOM_ON_FLOOR[2],
      { x: x2, y: 2200 }, { x: x2, y: tip }, { x: x1, y: tip }, { x: x1, y: 2200 }, ROOM_ON_FLOOR[3],
    ];
    const thing = footprint({ x: 110, y: 1100 }, 400, 400, 0); // y from 900 to 1300
    // A 20 mm stub ending 100 mm inside the thing: out by those 100 mm, not
    // by the 10 mm that the thing's own edge is from the stub's sides.
    expect(clearance(thing, stub(100, 120, 1000))).toBeCloseTo(-100, 9);
    // An 8 mm stub that runs right through, between the points checked along
    // the thing's edge: still not inside.
    expect(clearance(thing, stub(101, 109, 500))).toBeLessThan(0);
    expect(insideOutline(thing, stub(101, 109, 500), 0).verdict).toBe("outside");
    expect(insideOutline(thing, stub(101, 109, 500), 30).verdict).toBe("too close to call");
  });
});

describe("insideOutline", () => {
  const thing = footprint({ x: 0, y: 500 }, 600, 400, 0); // 400 mm from the nearest wall

  it("calls inside, outside or too close from the room and the outline's bar", () => {
    const inside = insideOutline(thing, ROOM_ON_FLOOR, 50);
    expect(inside).toMatchObject({ verdict: "inside", spareMm: 350 });
    expect(inside.sentence).toBe("The thing has 40 ± 5 cm of room inside the outline: inside, with at least 35 cm to spare.");
    expect(insideOutline(thing, ROOM_ON_FLOOR, 50, 300)).toMatchObject({ verdict: "inside", spareMm: 50 });
    expect(insideOutline(thing, ROOM_ON_FLOOR, 50, 380).verdict).toBe("too close to call");
    const out = insideOutline(thing, ROOM_ON_FLOOR, 50, 500);
    expect(out.verdict).toBe("outside");
    expect(out.sentence).toContain("needs 50 cm: outside, short by at least 5 cm.");
    // Sticking 200 mm through a wall whose position is good to 50 mm.
    expect(insideOutline(footprint({ x: 700, y: 500 }, 600, 400, 0), ROOM_ON_FLOOR, 50).verdict).toBe("outside");
    // Touching the wall: nobody can call that with a real bar.
    expect(insideOutline(footprint({ x: 500, y: 500 }, 600, 400, 0), ROOM_ON_FLOOR, 50).verdict).toBe("too close to call");
  });

  it("cannot say when the outline, the thing or the bar is not usable", () => {
    const bowTie = [ROOM_ON_FLOOR[0], ROOM_ON_FLOOR[1], ROOM_ON_FLOOR[3], ROOM_ON_FLOOR[2]];
    expect(insideOutline(thing, bowTie, 50)).toMatchObject({ verdict: "cannot say", reason: expect.stringContaining("crosses itself") });
    expect(insideOutline(thing.slice(0, 2), ROOM_ON_FLOOR, 50).verdict).toBe("cannot say");
    expect(insideOutline(thing, ROOM_ON_FLOOR, NaN).verdict).toBe("cannot say");
    expect(insideOutline(thing, ROOM_ON_FLOOR, 50, -1).verdict).toBe("cannot say");
  });
});

describe("calibration: how often is the verdict wrong?", () => {
  const tally = (words: string[]) => words.reduce<Record<string, number>>((t, w) => ({ ...t, [w]: (t[w] ?? 0) + 1 }), {});

  /** An 80 cm gap about a metre past the sheet, retaken 300 times. */
  const gaps = (sigma: number, sizes: number[]) => {
    const ends = [{ x: -300, y: 900 }, { x: 500, y: 900 }].map(project);
    const normal = gaussian(seededRandom(7300 + sigma));
    const said: string[][] = sizes.map(() => []);
    for (let r = 0; r < 300; r++) {
      const sheet = retake(letterInPhoto(), sigma, normal);
      const bar = withBar(spreadOf(fromTaps(sheet, retake(ends, sigma, normal), (f) => dist(f[0], f[1])), { samples: 300 }));
      sizes.forEach((size, i) => said[i].push(fitVerdict(bar, size).verdict));
    }
    return said.map(tally);
  };

  it("gap, taps 1.5 photo pixels off: 1 wrong call in 300 retakes for a thing 2 cm too big, 0 for one 2 cm smaller", () => {
    const [easy, justFits, justTooBig, hopeless] = gaps(1.5, [700, 780, 820, 900]);
    expect(easy).toEqual({ fits: 300 });
    // 2 cm smaller than the gap: fits 44, too close 256, never "does not fit".
    expect(justFits["does not fit"] ?? 0).toBe(0);
    expect(justFits.fits).toBeGreaterThan(20);
    // 2 cm bigger: does not fit 38, too close 261, and "fits" once.
    expect(justTooBig.fits ?? 0).toBeLessThanOrEqual(7); // 2.5% of 300, one side of a 2 sd bar
    expect(justTooBig["does not fit"]).toBeGreaterThan(20);
    // 10 cm bigger: does not fit 296, too close 4.
    expect(hopeless["does not fit"]).toBeGreaterThan(285);
    expect(hopeless.fits ?? 0).toBe(0);
  }, 60000);

  it("gap, taps 6 photo pixels off: 6 wrong calls in 300 retakes for a thing 2 cm smaller, and it mostly declines to call", () => {
    const [easy, justFits, justTooBig, hopeless] = gaps(6, [500, 780, 820, 1100]);
    // 30 cm smaller: fits 290, too close 10.
    expect(easy.fits).toBeGreaterThan(280);
    expect(easy["does not fit"] ?? 0).toBe(0);
    // 2 cm smaller: too close 294, and "does not fit" 6 times (2 in 100).
    expect(justFits["does not fit"] ?? 0).toBeLessThanOrEqual(7);
    expect(justFits["too close to call"]).toBeGreaterThan(285);
    // 2 cm bigger: too close 286, does not fit 14, never "fits".
    expect(justTooBig.fits ?? 0).toBe(0);
    // 30 cm bigger: does not fit 188, too close 112, never "fits".
    expect(hopeless.fits ?? 0).toBe(0);
    expect(hopeless["does not fit"]).toBeGreaterThan(150);
  }, 60000);

  it("thing inside the room, taps 1.5 photo pixels off: the bar holds the true room in 188 of 200 retakes, 1 wrong call in 200 each way", () => {
    // 900 by 600 mm, turned, with 181.4 mm to the nearest wall in truth.
    const thing = footprint({ x: 100, y: 1000 }, 900, 600, 0.3);
    const truth = clearance(thing, ROOM_ON_FLOOR);
    expect(truth).toBeCloseTo(181.4, 1);
    const normal = gaussian(seededRandom(7400));
    let held = 0;
    let shown = 0;
    const said: string[][] = [[], [], [], []];
    for (let r = 0; r < 200; r++) {
      const sheet = retake(letterInPhoto(), 1.5, normal);
      const corners = retake(ROOM_ON_FLOOR.map(project), 1.5, normal);
      const evaluate = fromTaps(sheet, corners, (floor: Pt[]) => clearance(thing, floor));
      const bar = withBar(spreadOf(evaluate, { samples: 300 }), "signed");
      if (bar.value === null) continue;
      shown++;
      if (Math.abs(bar.value - truth) <= bar.error) held++;
      // The page's call: the outline as this retake tapped it, and its bar.
      const outline = fromTapsFloor(sheet, corners);
      [0, 160, 200, 260].forEach((need, i) => said[i].push(insideOutline(thing, outline, bar.error, need).verdict));
    }
    expect(shown).toBe(200);
    expect(held).toBeGreaterThanOrEqual(184); // 92%; it was 188, which is 94
    expect(held).toBeLessThan(200);
    const [anywhere, needs160, needs200, needs260] = said.map(tally);
    expect(anywhere).toEqual({ inside: 200 });
    // 2 cm less than there is: inside 27, too close 172, "outside" once.
    expect(needs160.outside ?? 0).toBeLessThanOrEqual(5); // 2.5% of 200
    expect(needs160.inside).toBeGreaterThan(10);
    // 2 cm more than there is: outside 21, too close 178, "inside" once.
    expect(needs200.inside ?? 0).toBeLessThanOrEqual(5);
    expect(needs200.outside).toBeGreaterThan(10);
    // 8 cm more: outside 162, too close 38, never "inside".
    expect(needs260.inside ?? 0).toBe(0);
    expect(needs260.outside).toBeGreaterThan(150);
  }, 60000);
});

/** The outline's floor corners for one retake, through the same closure. */
function fromTapsFloor(sheet: Pt[], corners: Pt[]): Pt[] {
  let floor: Pt[] = [];
  fromTaps(sheet, corners, (f) => ((floor = f), 0))(null);
  return floor;
}
