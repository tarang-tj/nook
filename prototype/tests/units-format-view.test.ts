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
  it("rounds the error to one figure and the value to match", () => {
    expect(formatMeasured(measured(123.44, 0.62, "cm", "x"))).toBe("123.4 ± 0.6 cm");
    expect(formatMeasured(measured(123.44, 3.4, "cm", "x"))).toBe("123 ± 3 cm");
    expect(formatMeasured(measured(48.26, 0.96, "in", "x"))).toBe("48 ± 1 in");
    expect(formatMeasured(measured(1234, 42, "cm", "x"))).toBe("1230 ± 40 cm");
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
