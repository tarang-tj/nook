// The verdict is decided on the bar as it is written in the sentence, so the
// words never disagree with the figures printed beside them.
import { describe, expect, it } from "vitest";
import { fitVerdict } from "../src/measure/fit";

describe("the verdict and the bar printed beside it", () => {
  it("never says does not fit when the written bar still reaches the size needed", () => {
    // Worked out as 899 mm give or take 119: written "90 ± 12 cm", which reaches 102.
    const call = fitVerdict({ value: 899, error: 119 }, 1020);
    expect(call.sentence).toMatch(/^The gap is 90 ± 12 cm and the thing needs 102 cm: too close to call/);
    expect(fitVerdict({ value: 899, error: 119 }, 1030).verdict).toBe("does not fit");
  });

  it("never says fits when the written bar dips below the size needed", () => {
    // Worked out as 1000 mm give or take 266: written "100 ± 30 cm", low end 70.
    const call = fitVerdict({ value: 1000, error: 266 }, 720);
    expect(call.sentence).toMatch(/^The gap is 100 ± 30 cm/);
    expect(call.verdict).toBe("too close to call");
    expect(fitVerdict({ value: 1000, error: 266 }, 700).verdict).toBe("fits");
  });

  it("in inches, a written bar that just reaches the size needed is too close to call", () => {
    const call = fitVerdict({ value: 2089.773, error: 72.801 }, 86 * 25.4, "in");
    expect(call.sentence).toMatch(/^The gap is 82 ± 4 in and the thing needs 86 in: too close to call/);
  });

  it("a bar of zero is compared as it is", () => {
    expect(fitVerdict({ value: 800, error: 0 }, 800).verdict).toBe("fits");
  });
});
