// The "true value" line of the made-up floor: it is the truth for the spots
// that were tapped, not a fixed number for wherever the taps went.
import { describe, expect, it } from "vitest";
import { closeRoom, newState, type State, type Tool } from "../src/app/state";
import { truthText } from "../src/app/words";
import { floorOfPhoto, projectFloor, SAMPLE_FLOOR, sampleTaps } from "../src/sample/floor";
import { tell } from "./page";

const LEAD = "True value on this made-up floor, for the spots as tapped:";

function tapped(tool: Tool, taps: Partial<State["points"]>): State {
  const s = newState(tool);
  s.points.sheet = sampleTaps("sheet");
  Object.assign(s.points, taps);
  return s;
}
const photo = (floor: { x: number; y: number }[]) => floor.map(projectFloor);

describe("the made-up floor knows where a tap really is", () => {
  it("takes a photo pixel back to the floor spot it was drawn from", () => {
    for (const spot of [...SAMPLE_FLOOR.room, ...SAMPLE_FLOOR.second, { x: 123.4, y: 3210 }]) {
      const back = floorOfPhoto(projectFloor(spot))!;
      expect(back.x).toBeCloseTo(spot.x, 6);
      expect(back.y).toBeCloseTo(spot.y, 6);
    }
    expect(floorOfPhoto({ x: 1500, y: -5000 })).toBeNull(); // above the horizon: not on the floor
  });
});

describe("the true value printed beside a result", () => {
  it("is 100 cm for A and B on the two painted spots", () => {
    expect(truthText(tapped("distance", { ends: sampleTaps("ends") }), "cm")).toEqual([`${LEAD} A to B is 100 cm.`]);
  });

  it("is 90 cm, not 100, when A and B are tapped on the two red gap crosses", () => {
    const s = tapped("distance", { ends: sampleTaps("gap") });
    expect(truthText(s, "cm")).toEqual([`${LEAD} A to B is 90 cm.`]);
    const { words } = tell(s, { sample: true });
    expect(words.truth).toEqual([`${LEAD} A to B is 90 cm.`]);
    expect(words.headline).toMatch(/^A to B: 9\d(\.\d)? ± /);
    expect(truthText(s, "in")).toEqual([`${LEAD} A to B is 35.4 in.`]);
  });

  it("follows any two spots, wherever they are", () => {
    const s = tapped("distance", { ends: photo([{ x: 0, y: 0 }, { x: 300, y: 400 }]) });
    expect(truthText(s, "cm")).toEqual([`${LEAD} A to B is 50 cm.`]);
    const gap = tapped("fit", { gap: photo([{ x: 0, y: 500 }, { x: 0, y: 1250 }]) });
    expect(truthText(gap, "cm")).toEqual([`${LEAD} the gap is 75 cm.`]);
  });

  it("gives the walls of the outline that was tapped, in the order it was tapped", () => {
    const s = tapped("room", { room: photo([{ x: -700, y: -300 }, { x: 800, y: -300 }, { x: 800, y: 1200 }, { x: -700, y: 1200 }]) });
    expect(truthText(s, "cm")).toEqual([]); // not closed yet
    closeRoom(s);
    expect(truthText(s, "cm")).toEqual([`${LEAD} walls 150, 150, 150, 150 cm, perimeter 600 cm, floor area 2.25 m².`]);
    const turned = tapped("room", { room: [...sampleTaps("room").slice(2), ...sampleTaps("room").slice(0, 2)] });
    closeRoom(turned);
    expect(truthText(turned, "cm")[0]).toContain("walls 60, 100, 90, 250, 150, 150 cm, perimeter 800 cm, floor area 3.15 m².");
  });

  it("prints no true values for an outline that crosses itself", () => {
    const bow = [0, 1, 3, 2].map((i) => [{ x: -700, y: -300 }, { x: 800, y: -300 }, { x: 800, y: 2200 }, { x: -700, y: 2200 }][i]);
    const s = tapped("room", { room: photo(bow) });
    closeRoom(s);
    expect(truthText(s, "cm")).toEqual([]);
    const { words } = tell(s, { sample: true });
    expect(words.problem).toMatch(/^No measurement\. The outline crosses itself/);
    expect(words.truth).toEqual([]);
  });

  it("is not printed for a photo, only for the made-up floor", () => {
    expect(tell(tapped("distance", { ends: sampleTaps("ends") })).words.truth).toEqual([]);
  });
});
