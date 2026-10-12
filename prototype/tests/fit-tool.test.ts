// The Fit tool and the saved plan and table, from taps to words, without a browser.
import { describe, expect, it } from "vitest";
import { csvOf, planOf } from "../src/app/exports";
import { placeSampleTaps } from "../src/app/sample-taps";
import { newState } from "../src/app/state";
import { dist } from "../src/measure/homography";
import { sampleTaps } from "../src/sample/floor";
import { fakePage, SETTINGS, tell } from "./page";
import { project } from "./scene";

const BIG = { w: 3000, h: 4000 }; // one screen pixel per photo pixel

describe("Fit: one example of what a measured outline allows", () => {
  const fitState = () => {
    const s = newState("fit");
    placeSampleTaps(s);
    return s;
  };

  it("calls a gap fits, does not fit or too close to call, for the width and for a quarter turn", () => {
    const s = fitState();
    expect(s.points.gap).toHaveLength(2);
    expect(s.closed).toBe(true);
    // The true gap is 90 cm. Near the bar's edge the honest answer is "too close to call".
    const say = (w: number, d: number) => tell(s, {}, { thingWidth: w, thingDepth: d }).words.verdicts;
    expect(say(60, 40)[0]).toMatch(/^Width first\. The gap is 9\d ± \d+ cm and the thing needs 60 cm: fits, with at least/);
    expect(say(60, 40)[1]).toMatch(/^Turned a quarter turn\..*needs 40 cm: fits/);
    expect(say(140, 60)[0]).toMatch(/needs 140 cm: does not fit, short by at least/);
    expect(say(90, 60)[0]).toMatch(/needs 90 cm: too close to call/);
    expect(say(60, 60)).toHaveLength(2); // one gap sentence (square), one inside sentence
    expect(say(0, 60)[0]).toMatch(/Cannot say: The size of the thing is missing or is not above zero/);
    expect(tell(s).words.basis).toMatch(/Floor only/);
    expect(tell(s, { sample: true }).words.truth[0]).toBe("True value on this made-up floor: the gap between the two red crosses is 90 cm.");
  });

  it("says whether the thing's footprint is inside the outline, and follows it when it is dragged", () => {
    const page = fakePage(BIG, "fit");
    placeSampleTaps(page.state);
    const inside = tell(page.state).words.verdicts.at(-1)!;
    expect(inside).toMatch(/^Inside the outline\. The thing has .* cm of room inside the outline: (inside|too close to call)/);
    // Drag the footprint by its middle to a spot well outside the outline.
    const middle = page.screen({
      x: sampleTaps("room").reduce((t, p) => t + p.x, 0) / 6,
      y: sampleTaps("room").reduce((t, p) => t + p.y, 0) / 6,
    });
    const outside = page.screen(project({ x: -200, y: 3000 })); // past the far wall, still in the photo
    page.drag(middle, outside, "mouse");
    expect(dist(page.screen(page.state.thing!), outside)).toBeLessThan(1e-6);
    expect(page.state.points.room).toHaveLength(6);
    expect(tell(page.state).words.verdicts.at(-1)).toMatch(/: outside, short by at least/);
    // A small thing in the middle of the wide part has room to spare.
    page.state.thing = project({ x: 300, y: 700 });
    expect(tell(page.state, {}, { thingWidth: 30, thingDepth: 30 }).words.verdicts.at(-1)).toMatch(/: inside, with at least \d+(\.\d)? cm to spare\.$/);
    // Turning it changes the footprint the verdict is about.
    const corner = () => {
      const solved = tell(page.state).solved;
      if (!solved?.ok || !solved.floor.foot) throw new Error("no footprint");
      return solved.floor.foot[0];
    };
    const before = corner();
    page.state.turn = 45;
    expect(dist(before, corner())).toBeGreaterThan(50);
  });

  it("asks for an outline before it will try the thing inside a room", () => {
    const s = newState("fit");
    for (const g of ["sheet", "gap"] as const) for (const tap of sampleTaps(g)) s.points[g].push(tap);
    expect(tell(s).words.verdicts.at(-1)).toBe("To try the thing inside a room, close an outline on the Room tab, then come back here.");
  });
});

describe("saving the plan and the walls", () => {
  const room = () => {
    const s = newState("room");
    placeSampleTaps(s);
    return s;
  };

  it("draws the outline with each wall's length, and without any length while the bars are being worked out", () => {
    const s = room();
    const { solved, words } = tell(s, { sample: true });
    const plan = planOf(solved, words.rows, SETTINGS, true);
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.svg).toContain("Nook draft plan of a made-up floor");
    expect(plan.svg).toContain("Not checked against a tape measure or a real photo");
    expect(plan.svg.match(/class="wall"/g)).toHaveLength(6);
    expect(plan.svg).toContain(words.rows[0].text);
    expect(plan.svg).toContain('class="sheet"');
    // A wall with no honest number gets no label, not its refusal.
    const refused = planOf(solved, [{ name: "Wall 1", measured: null, text: "no number. Too uncertain." }, ...words.rows.slice(1)], SETTINGS, false);
    expect(refused.ok && refused.svg.match(/class="wall"/g)).toHaveLength(5);
    expect(refused.ok && refused.svg).not.toContain("Too uncertain.");
    const waiting = planOf(solved, [], SETTINGS, false);
    expect(waiting.ok && waiting.svg.includes('class="outline"') && !waiting.svg.includes('class="wall"')).toBe(true);
    expect(planOf(null, [], SETTINGS, false).ok).toBe(false);
  });

  it("writes one CSV row per wall, then the perimeter and the area, and empty cells for a refused number", () => {
    const { words } = tell(room());
    const lines = csvOf(words.rows).trim().split("\n");
    expect(lines[0]).toBe("wall,length,error,unit");
    expect(lines).toHaveLength(9);
    expect(lines[1]).toMatch(/^Wall 1 \(corner 1 to 2\),1\d\d(\.\d+)?,\d+(\.\d+)?,cm$/);
    expect(lines[8]).toMatch(/^Floor area,3\.\d+,0\.\d+,m²$/);
    expect(csvOf([{ name: "Wall 1", measured: null, text: "no number." }])).toBe("wall,length,error,unit\nWall 1,,,\n");
  });
});
