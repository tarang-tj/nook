import { describe, expect, it } from "vitest";
import { formatMeasured } from "../src/measure/format";
import { measured } from "../src/measure/noise";
import { REFERENCES } from "../src/measure/references";
import { fromMm, isUnit, toMm } from "../src/measure/units";
import { fitContain, toImage, toScreen } from "../src/ui/view";

describe("units", () => {
  it("converts millimetres to cm and inches and back", () => {
    expect(fromMm(254, "cm")).toBeCloseTo(25.4, 12);
    expect(fromMm(254, "in")).toBeCloseTo(10, 12);
    expect(toMm(10, "in")).toBeCloseTo(254, 12);
    expect(toMm(fromMm(1234.5, "in"), "in")).toBeCloseTo(1234.5, 9);
    expect(isUnit("cm")).toBe(true);
    expect(isUnit("furlong")).toBe(false);
  });

  it("knows the paper sizes", () => {
    const letter = REFERENCES.find((r) => r.id === "letter")!;
    expect(fromMm(letter.long, "in")).toBeCloseTo(11, 9);
    expect(fromMm(letter.short, "in")).toBeCloseTo(8.5, 9);
    expect(REFERENCES.find((r) => r.id === "a4")).toMatchObject({ long: 297, short: 210 });
  });
});

describe("formatMeasured", () => {
  it("writes the error to one figure, or two when its first figure is 1, and the value to match", () => {
    expect(formatMeasured(measured(123.4, 0.6, "cm", "x"))).toBe("123.4 ± 0.6 cm");
    expect(formatMeasured(measured(123, 3.4, "cm", "x"))).toBe("123 ± 4 cm");
    expect(formatMeasured(measured(1230, 42, "cm", "x"))).toBe("1230 ± 50 cm");
    expect(formatMeasured(measured(156, 15, "cm", "x"))).toBe("156 ± 15 cm");
    expect(formatMeasured(measured(61.4, 1.2, "in", "x"))).toBe("61.4 ± 1.2 in");
    expect(formatMeasured(measured(-0.01, 0.4, "cm", "x"))).toBe("0.0 ± 0.5 cm");
  });

  it("never writes a bar narrower than the one worked out", () => {
    // The review's cases: 14.9 used to be written 10, and 1.49 written 1.
    expect(formatMeasured(measured(156, 14.9, "cm", "x"))).toBe("156 ± 15 cm");
    expect(formatMeasured(measured(61.42, 1.49, "in", "x"))).toBe("61.4 ± 1.6 in");
    // Rounding the value moves the middle, so the written bar grows by that much.
    expect(formatMeasured(measured(123.44, 3.4, "cm", "x"))).toBe("123 ± 4 cm");
    expect(formatMeasured(measured(154, 40, "cm", "x"))).toBe("150 ± 50 cm");
    // 0.96 with the value's shift is exactly 1.0; 1.96 with it is exactly 2.
    expect(formatMeasured(measured(48.26, 0.96, "in", "x"))).toBe("48.3 ± 1.0 in");
    expect(formatMeasured(measured(10.04, 1.96, "cm", "x"))).toBe("10 ± 2 cm");
    expect(formatMeasured(measured(100.02, 2.6, "cm", "x"))).toBe("100 ± 3 cm");
  });

  it("the written range holds the whole worked-out range, for 4000 values and errors", () => {
    let seed = 7;
    const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let widest = 0;
    for (let i = 0; i < 4000; i++) {
      const error = 10 ** (next() * 6 - 3); // 0.001 to 1000
      const value = (next() - 0.2) * 3000;
      const [shown, bar] = formatMeasured(measured(value, error, "", "x")).split(" ± ").map(Number);
      const slack = 1e-6 * error;
      expect(shown - bar, `${value} ± ${error}`).toBeLessThanOrEqual(value - error + slack);
      expect(shown + bar, `${value} ± ${error}`).toBeGreaterThanOrEqual(value + error - slack);
      widest = Math.max(widest, bar / error);
    }
    // And not much wider: an error just under 2 that has to be written 3 is the worst there is.
    expect(widest).toBeLessThan(1.65);
  });

  it("never prints a number that is not a measurement", () => {
    expect(formatMeasured(measured(NaN, 1, "cm", "x"))).toBe("not measured");
    expect(formatMeasured(measured(10, NaN, "cm", "x"))).toBe("not measured");
    expect(formatMeasured(measured(10, -1, "cm", "x"))).toBe("not measured");
  });
});

describe("screen and photo coordinates", () => {
  it("fits a tall photo in a wide box and round-trips a point", () => {
    const fit = fitContain(3000, 4000, 800, 400);
    expect(fit.scale).toBeCloseTo(0.1, 12);
    expect(fit.dx).toBeCloseTo(250, 9);
    expect(fit.dy).toBeCloseTo(0, 9);
    const screen = toScreen(fit, { x: 1500, y: 2000 });
    expect(screen).toEqual({ x: 400, y: 200 });
    expect(toImage(fit, screen.x, screen.y)).toEqual({ x: 1500, y: 2000 });
  });
});
