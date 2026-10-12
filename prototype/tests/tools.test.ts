// The Room and Fit tools, from taps to the words on screen, without a browser.
import { describe, expect, it } from "vitest";
import { csvOf, planOf } from "../src/app/exports";
import { barsOf, sceneOf, solve } from "../src/app/numbers";
import { report } from "../src/app/report";
import { placeSampleTaps } from "../src/app/sample-taps";
import { canUndo, closeRoom, newState, undo } from "../src/app/state";
import { jitterFused, solveFused } from "../src/measure/fused";
import { dist, type Pt } from "../src/measure/homography";
import { floorPoints, outlineMeasures } from "../src/measure/outline";
import { jitterPoint, spreadOf, withBar } from "../src/measure/spread";
import { SAMPLE_TRUTH, sampleTaps } from "../src/sample/floor";
import { fakePage, SETTINGS, tell } from "./page";
import { L_ROOM_ON_FLOOR, letterInPhoto, project } from "./scene";

const BIG = { w: 3000, h: 4000 }; // one screen pixel per photo pixel
const ROOM_TAPS = L_ROOM_ON_FLOOR.map(project);

function roomPage() {
  const page = fakePage(BIG, "room");
  for (const p of [...letterInPhoto(), ...ROOM_TAPS]) page.tapPhoto(p, "mouse");
  return page;
}

describe("Room: tap the corners in order and close the outline", () => {
  it("a tap on corner 1 closes it, and every wall, the perimeter and the area come with a bar that holds the truth", () => {
    const page = roomPage();
    expect(page.state.closed).toBe(false);
    // An open outline is not measured: no walls, no area, nothing worked out.
    expect(tell(page.state).solved).toMatchObject({ ok: true, values: {} });
    expect(tell(page.state).words).toMatchObject({ rows: [], working: false });
    expect(tell(page.state).words.step).toMatch(/6 so far.*tap corner 1 again or press Close outline/);
    page.tapPhoto(ROOM_TAPS[0], "mouse");
    expect(page.state.closed).toBe(true);
    expect(page.state.points.room).toHaveLength(6);

    const { words, bars } = tell(page.state, { sample: true });
    expect(words.rows.map((r) => r.name)).toEqual([
      "Wall 1 (corner 1 to 2)", "Wall 2 (corner 2 to 3)", "Wall 3 (corner 3 to 4)",
      "Wall 4 (corner 4 to 5)", "Wall 5 (corner 5 to 6)", "Wall 6 (corner 6 to 1)", "Perimeter", "Floor area",
    ]);
    const truth = [...SAMPLE_TRUTH.walls, SAMPLE_TRUTH.perimeter, SAMPLE_TRUTH.area];
    ["wall0", "wall1", "wall2", "wall3", "wall4", "wall5", "perimeter", "area"].forEach((key, i) => {
      const bar = bars![key] as { value: number; error: number };
      expect(bar.value).not.toBeNull();
      expect(Math.abs(bar.value - truth[i])).toBeLessThan(bar.error);
    });
    expect(words.rows[0].text).toMatch(/^150(\.\d)? ± \d(\.\d)? cm$/);
    expect(words.rows[7].text).toMatch(/^3\.\d+ ± 0\.\d+ m²$/);
    expect(words.basis).toMatch(/A wall here is the line where the wall meets the floor/);
    expect(words.basis).toMatch(/not yet been checked against a tape measure/);
    expect(words.truth[0]).toBe(
      "True values on this made-up floor: walls 150, 150, 60, 100, 90, 250 cm, perimeter 800 cm, floor area 3.15 m².",
    );
    expect(tell(page.state, {}, { unit: "in" }).words.rows[7].text).toMatch(/ft²$/);
  });

  it("Undo opens the outline again, and Close outline needs three corners", () => {
    const page = roomPage();
    closeRoom(page.state);
    undo(page.state);
    expect(page.state.closed).toBe(false);
    expect(page.state.points.room).toHaveLength(6);
    const s = newState("room");
    for (const p of [...letterInPhoto(), ROOM_TAPS[0], ROOM_TAPS[1]]) s.points[s.points.sheet.length < 4 ? "sheet" : "room"].push(p);
    expect(closeRoom(s)).toBe(false);
  });

  it("Undo only takes back what the chosen tool shows", () => {
    const s = newState("room");
    placeSampleTaps(s);
    s.tool = "fit";
    placeSampleTaps(s); // the gap's two taps are now the newest steps
    s.tool = "room";
    expect(canUndo(s)).toBe(true);
    undo(s); // not a gap tap, which the Room tab does not show: the closing
    expect(s.points.gap).toHaveLength(2);
    expect(s.closed).toBe(false);
    undo(s);
    expect(s.points.room).toHaveLength(5);
    s.tool = "distance";
    for (let i = 0; i < 4; i++) undo(s); // only the sheet shows here
    expect(s.points.sheet).toHaveLength(0);
    expect(canUndo(s)).toBe(false);
    expect(s.points.room).toHaveLength(5);
  });

  it("an outline that crosses itself gets its reason in words and no numbers", () => {
    const page = fakePage(BIG, "room");
    const bow = [0, 1, 3, 2].map((i) => [{ x: -700, y: -300 }, { x: 800, y: -300 }, { x: 800, y: 2200 }, { x: -700, y: 2200 }][i]);
    for (const p of [...letterInPhoto(), ...bow.map(project)]) page.tapPhoto(p, "mouse");
    closeRoom(page.state);
    const { words } = tell(page.state);
    expect(words.problem).toMatch(/^No measurement\. The outline crosses itself/);
    expect(words.rows).toEqual([]);
    expect(words.headline).toBe("");
  });

  it("taps made zoomed out are refused in words, wall by wall, with the reason said once", () => {
    const page = fakePage(undefined, "room"); // the phone box: 7.8 photo pixels per screen pixel
    for (const p of [...letterInPhoto(), ...ROOM_TAPS]) page.tapPhoto(p);
    closeRoom(page.state);
    const { words } = tell(page.state);
    const refused = words.rows.filter((r) => r.measured === null);
    expect(refused.length).toBeGreaterThan(3);
    expect(refused[0].text).toMatch(/^no number\. Too uncertain to call a measurement/);
    expect(words.notes.filter((n) => n.includes("Too uncertain"))).toHaveLength(1);
    expect(words.notes.join(" ")).toMatch(/zoom in and drag each point onto its spot/);
    for (const r of words.rows) expect(r.text).not.toMatch(/NaN|undefined|null/);
  });
});

describe("the error bars", () => {
  it("are the same whether the simulated taps are shared between the numbers or worked out for each", () => {
    const s = newState("room");
    placeSampleTaps(s);
    const scene = sceneOf(s, SETTINGS)!;
    const bars = barsOf(scene, solve(scene));
    const alone = (pick: (floor: Pt[]) => number) =>
      withBar(spreadOf((draw) => {
        const fused = solveFused(draw ? jitterFused(scene.input, draw) : scene.input);
        const floor = fused.ok ? floorPoints(fused.h, scene.room.map((p) => (draw ? jitterPoint(p, draw) : p))) : null;
        return floor ? pick(floor) : null;
      }));
    const area = (floor: Pt[]) => (outlineMeasures(floor) as { area: number }).area;
    expect(bars.area).toEqual(alone(area));
    expect(bars.wall3).toEqual(alone((floor) => dist(floor[3], floor[4])));
  });

  it("while they are being worked out the page says so and shows no number", () => {
    const s = newState("room");
    placeSampleTaps(s);
    const scene = sceneOf(s, SETTINGS)!;
    const words = report(s, { hasPhoto: true, notice: "" }, SETTINGS, solve(scene), null);
    expect(words.working).toBe(true);
    expect(words.rows).toEqual([]);
    expect(words.headline).toBe("");
    const s2 = newState();
    placeSampleTaps(s2);
    const scene2 = sceneOf(s2, SETTINGS)!;
    expect(report(s2, { hasPhoto: true, notice: "" }, SETTINGS, solve(scene2), null)).toMatchObject({ working: true, headline: "" });
  });
});

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
