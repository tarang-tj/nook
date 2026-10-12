// The Room and Fit tools, from taps to the words on screen, without a browser.
import { describe, expect, it } from "vitest";
import { barsOf, sceneOf, solve } from "../src/app/numbers";
import { report } from "../src/app/report";
import { placeSampleTaps } from "../src/app/sample-taps";
import { canUndo, closeRoom, newState, undo } from "../src/app/state";
import { jitterFused, solveFused } from "../src/measure/fused";
import { dist, type Pt } from "../src/measure/homography";
import { floorPoints, outlineMeasures } from "../src/measure/outline";
import { jitterPoint, spreadOf, withBar } from "../src/measure/spread";
import { SAMPLE_TRUTH } from "../src/sample/floor";
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
      "True value on this made-up floor, for the spots as tapped: walls 150, 150, 60, 100, 90, 250 cm, perimeter 800 cm, floor area 3.15 m².",
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
