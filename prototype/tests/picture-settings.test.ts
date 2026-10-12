// The settings that describe one picture (which paper, which way round, how
// long the known length is) must not carry over to the next picture, and the
// made-up floor sets its own.
import { describe, expect, it } from "vitest";
import { forNewPicture, withoutExtra } from "../src/app/picture-settings";
import { placeSampleTaps } from "../src/app/sample-taps";
import { newState, type State, type Tool } from "../src/app/state";
import { SAMPLE_TRUTH } from "../src/sample/floor";
import { SETTINGS, tell } from "./page";

/** Left behind by the last picture: a swapped A4 sheet, a swapped second
 * sheet and a typed length. */
const LEFT = { ...SETTINGS, paper: "a4", swap: true, paper2: "a4", swap2: true, spanMm: 1000, unit: "in" as const, thingWidthMm: 500 };

function sampleState(tool: Tool, extra: State["adding"] = null): State {
  const s = newState(tool);
  s.adding = extra;
  placeSampleTaps(s);
  return s;
}

describe("settings for a new picture", () => {
  it("a new photo starts with no swap, no typed length and the default second paper", () => {
    const set = forNewPicture(LEFT, false);
    expect(set).toMatchObject({ swap: false, swap2: false, paper2: "letter" });
    expect(set.spanMm).toBeNaN();
  });

  it("keeps what is not about the picture: the first paper, the units, the thing's size", () => {
    expect(forNewPicture(LEFT, false)).toMatchObject({ paper: "a4", unit: "in", thingWidthMm: 500, thingDepthMm: 600 });
  });

  it("the made-up floor sets the papers it was painted with", () => {
    expect(forNewPicture(LEFT, true)).toMatchObject({ paper: "letter", swap: false, paper2: "a4", swap2: false });
    expect(SAMPLE_TRUTH).toMatchObject({ paper: "letter", secondPaper: "a4" });
  });

  it("removing an extra reference clears what was set for it", () => {
    expect(withoutExtra(LEFT, "second")).toMatchObject({ paper2: "letter", swap2: false, spanMm: 1000, swap: true });
    const noSpan = withoutExtra(LEFT, "span");
    expect(noSpan.spanMm).toBeNaN();
    expect(noSpan).toMatchObject({ paper2: "a4", swap2: true });
  });
});

describe("the made-up floor after something else was on screen", () => {
  const truth = [...SAMPLE_TRUTH.walls, SAMPLE_TRUTH.perimeter, SAMPLE_TRUTH.area];
  const misses = (s: State, set: typeof SETTINGS): number => {
    const { bars } = tell(s, {}, set);
    return ["wall0", "wall1", "wall2", "wall3", "wall4", "wall5", "perimeter", "area"].filter((key, i) => {
      const bar = bars?.[key];
      return !bar || bar.value === null || Math.abs(bar.value - truth[i]) >= bar.error;
    }).length;
  };

  it("with the swap box left ticked the numbers are wrong and nothing refuses", () => {
    const s = sampleState("room");
    expect(tell(s, {}, { ...SETTINGS, swap: true }).words.problem).toBe("");
    expect(misses(s, { ...SETTINGS, swap: true })).toBeGreaterThan(3);
  });

  it("with the settings for a new picture every bar holds the truth again", () => {
    expect(misses(sampleState("room"), forNewPicture(LEFT, true))).toBe(0);
  });

  it("its far sheet is A4, so a second sheet tapped on it is solved as A4 without anyone choosing", () => {
    const s = sampleState("room", "second");
    expect(misses(s, { ...forNewPicture(SETTINGS, true), paper2: "letter" })).toBeGreaterThan(3); // the wrong-paper case
    expect(misses(s, forNewPicture({ ...SETTINGS, paper2: "letter" }, true))).toBe(0);
  });
});
