// A length typed into a box keeps its size when Units is changed, and an
// area is written in the right square unit.
import { describe, expect, it } from "vitest";
import { sceneOf } from "../src/app/numbers";
import { placeSampleTaps } from "../src/app/sample-taps";
import { newState } from "../src/app/state";
import { EMPTY_LENGTH, readTyped, stepTyped, typedFrom } from "../src/app/typed-length";
import { areaOf, areaText } from "../src/app/words";
import { SETTINGS, tell } from "./page";

describe("a typed length", () => {
  it("is read in the unit showing when it was typed", () => {
    expect(readTyped(EMPTY_LENGTH, "80", "cm")).toEqual({ mm: 800, text: "80" });
    expect(readTyped(EMPTY_LENGTH, "80", "in").mm).toBeCloseTo(2032, 9);
    expect(readTyped(EMPTY_LENGTH, "2.5", "cm").mm).toBeCloseTo(25, 9);
    expect(readTyped({ mm: 800, text: "80" }, "", "cm").mm).toBeNaN();
    expect(readTyped(EMPTY_LENGTH, "abc", "cm").mm).toBeNaN();
  });

  it("keeps its size when Units is changed: the box is rewritten, the length is not", () => {
    const typed = stepTyped(EMPTY_LENGTH, "80", "cm", "cm");
    const inches = stepTyped(typed, "80", "cm", "in");
    expect(inches).toEqual({ mm: 800, text: "31.5" });
    // Nothing typed since: the same 80 cm, not 31.5 in.
    expect(stepTyped(inches, "31.5", "in", "in").mm).toBe(800);
    expect(stepTyped(inches, "31.5", "in", "cm")).toEqual({ mm: 800, text: "80" });
  });

  it("is read in the new unit once the person types again", () => {
    const inches = stepTyped({ mm: 800, text: "80" }, "80", "cm", "in");
    expect(stepTyped(inches, "10", "in", "in").mm).toBeCloseTo(254, 9);
  });

  it("stays empty through a change of Units", () => {
    expect(stepTyped(EMPTY_LENGTH, "", "cm", "in")).toEqual(EMPTY_LENGTH);
  });

  it("can be filled in by the page with an exact length", () => {
    expect(typedFrom(1000, "cm")).toEqual({ mm: 1000, text: "100" });
    expect(typedFrom(1000, "in")).toEqual({ mm: 1000, text: "39.37" });
  });
});

describe("the page's numbers do not move when Units is changed", () => {
  it("a known length of 100 cm is 1000 mm in the solve whatever unit is showing", () => {
    const s = newState("room");
    s.adding = "span";
    placeSampleTaps(s);
    for (const unit of ["cm", "in"] as const) {
      const scene = sceneOf(s, { ...SETTINGS, unit, spanMm: readTyped(EMPTY_LENGTH, "100", "cm").mm })!;
      expect(scene.input.spans).toHaveLength(1);
      expect(scene.input.spans![0].lengthMm).toBe(1000);
    }
  });

  it("a thing typed as 80 by 60 cm gets the same fit verdict in cm and in inches", () => {
    const s = newState("fit");
    s.adding = "second";
    placeSampleTaps(s);
    const [w, d] = ["80", "60"].map((text) => stepTyped(readTyped(EMPTY_LENGTH, text, "cm"), text, "cm", "in").mm);
    const cm = tell(s, {}, { unit: "cm", thingWidthMm: w, thingDepthMm: d });
    const inches = tell(s, {}, { unit: "in", thingWidthMm: w, thingDepthMm: d });
    expect(cm.scene!.thing).toMatchObject({ widthMm: 800, depthMm: 600 });
    expect(inches.scene!.thing).toMatchObject({ widthMm: 800, depthMm: 600 });
    expect(cm.words.verdicts[0]).toMatch(/needs 80 cm: fits/);
    expect(inches.words.verdicts[0]).toMatch(/needs 31\.5 in: fits/);
    expect(inches.words.verdicts[1]).toMatch(/needs 23\.6 in: fits/);
  });
});

describe("a floor area", () => {
  it("is written in square metres or square feet", () => {
    expect(areaText(3_150_000, "cm")).toBe("3.15 m²");
    expect(areaText(92_903.04, "in")).toBe("1 ft²");
    expect(areaText(3_150_000, "in")).toBe("33.91 ft²");
    const feet = areaOf({ value: 3_150_000, error: 92_903.04, warning: null }, "in", "basis")!;
    expect(feet.value).toBeCloseTo(33.906, 3);
    expect(feet.error).toBeCloseTo(1, 9);
    expect(feet.unit).toBe("ft²");
    expect(areaOf({ value: 3_150_000, error: 50_000, warning: null }, "cm", "basis")).toMatchObject({ value: 3.15, error: 0.05, unit: "m²" });
  });
});
