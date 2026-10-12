// A second sheet and a known length: every tool reads the fused plane map,
// the page says which references it used, and it does not pretend that a
// wrong reference would be caught.
import { describe, expect, it } from "vitest";
import { EXACT } from "../src/app/report";
import { placeSampleTaps, SAMPLE_EXTRAS } from "../src/app/sample-taps";
import { newState, removeExtra, target, undo, type State, type Tool } from "../src/app/state";
import type { Bar } from "../src/measure/spread";
import { SAMPLE_TRUTH, sampleTaps } from "../src/sample/floor";
import { fakePage, tell } from "./page";
import { letterInPhoto } from "./scene";
import page from "../index.html?raw";

const sample = (tool: Tool, extra: "second" | "span" | "both" | "none" = "none"): State => {
  const s = newState(tool);
  placeSampleTaps(s);
  for (const g of ["second", "span"] as const)
    if (extra === g || extra === "both") {
      s.adding = g;
      placeSampleTaps(s);
    }
  return s;
};
const shown = (bar: Bar) => bar as { value: number; error: number };
const STICK_CM = SAMPLE_EXTRAS.spanMm / 10;

describe("adding a second sheet or a known length", () => {
  it("sends the next four taps to the second sheet, then goes back to the tool", () => {
    const page = fakePage({ w: 3000, h: 4000 });
    for (const p of letterInPhoto()) page.tapPhoto(p, "mouse");
    page.state.adding = "second";
    expect(target(page.state)).toBe("second");
    expect(tell(page.state).words.step).toBe("Second sheet: tap its four corners (0 of 4).");
    for (const p of sampleTaps("second")) page.tapPhoto(p, "mouse");
    expect(page.state.points.second).toHaveLength(4);
    expect(page.state.adding).toBeNull();
    expect(target(page.state)).toBe("ends");
    // Undo takes back a corner of the second sheet, and the next tap finishes it again.
    undo(page.state);
    expect(target(page.state)).toBe("second");
    removeExtra(page.state, "second");
    expect(page.state.points.second).toEqual([]);
    expect(target(page.state)).toBe("ends");
    expect(page.state.history).toEqual(["sheet", "sheet", "sheet", "sheet"]);
  });

  it("zooming with two fingers straight after asking for a second sheet does not cancel the request", () => {
    const page = fakePage();
    for (const p of letterInPhoto()) page.tapPhoto(p);
    page.state.adding = "second";
    page.pointer.down({ id: 1, x: 150, y: 200, type: "touch" }); // looks like the first corner
    page.pointer.down({ id: 2, x: 250, y: 200, type: "touch" }); // no: it was a pinch
    page.pointer.up({ id: 1, x: 150, y: 200, type: "touch" });
    page.pointer.up({ id: 2, x: 250, y: 200, type: "touch" });
    expect(page.state.points.second).toHaveLength(0);
    expect(target(page.state)).toBe("second");
  });

  it("says which references the solve used", () => {
    expect(tell(sample("room")).words.used).toBe("Plane map solved from: first sheet.");
    expect(tell(sample("room", "second")).words.used).toBe("Plane map solved from: first sheet, second sheet.");
    expect(tell(sample("room", "both"), {}, { spanLength: STICK_CM }).words.used).toBe(
      "Plane map solved from: first sheet, second sheet, known length 1.",
    );
  });

  it("shows the paper size and long side assumed for the second sheet", () => {
    const { words } = tell(sample("room", "second"));
    expect(words.second).toMatch(/^Second sheet taken as A4, 29\.7 cm by 21 cm\. The 29\.7 cm length is given to the pair of sides that looks longer/);
    expect(tell(sample("room", "second"), {}, { paper2: "letter", swap2: true }).words.second).toMatch(/taken as US Letter.*looks shorter/);
    expect(tell(sample("room")).words.second).toBe("");
  });

  it("narrows the far numbers in every tool, and the bars still hold the truth", () => {
    const wall = (s: State, set = {}) => shown(tell(s, {}, set).bars!.wall5); // the 250 cm wall
    const one = wall(sample("room"));
    const two = wall(sample("room", "second"));
    const taped = wall(sample("room", "span"), { spanLength: STICK_CM });
    expect(one.error).toBeGreaterThan(250);
    expect(two.error).toBeLessThan(one.error / 4);
    expect(taped.error).toBeLessThan(one.error / 3);
    for (const bar of [one, two, taped]) expect(Math.abs(bar.value - 2500)).toBeLessThan(bar.error);

    const gap = (s: State) => shown(tell(s).bars!.gap);
    expect(gap(sample("fit", "second")).error).toBeLessThan(gap(sample("fit")).error / 4);
    // With one sheet an 80 cm thing in the 90 cm gap is too close to call. With the second sheet it fits.
    expect(tell(sample("fit")).words.verdicts[0]).toMatch(/too close to call/);
    expect(tell(sample("fit", "second")).words.verdicts[0]).toMatch(/needs 80 cm: fits/);

    const s = sample("distance", "second");
    expect(tell(s).words.headline).toMatch(/^A to B: 100(\.\d)? ± [\d.]+ cm$/);
    expect(tell(s).words.basis).toContain(EXACT);
    expect(tell(sample("distance")).words.basis).not.toContain("taken as exact");
  });

  it("the sample fills in its own paper size and stick length", () => {
    expect(SAMPLE_EXTRAS).toEqual({ paper2: "a4", spanMm: 1000 });
    expect(SAMPLE_TRUTH.span).toBe(1000);
  });
});

describe("what the page does not catch, and says so", () => {
  it("believes a wrong paper size on the second sheet: no refusal, and the truth is outside the bar", () => {
    const { solved, bars, words } = tell(sample("room", "second"), {}, { paper2: "letter" }); // it is really A4
    expect(solved?.ok).toBe(true);
    expect(words.problem).toBe("");
    const wall = shown(bars!.wall5);
    expect(Math.abs(wall.value - 2500)).toBeGreaterThan(wall.error); // reads about 245 ± 4 cm for a true 250
  });

  it("believes a length typed 10% too long: no refusal, and the truth is outside the bar", () => {
    const { solved, bars } = tell(sample("room", "span"), {}, { spanLength: STICK_CM * 1.1 });
    expect(solved?.ok).toBe(true);
    const wall = shown(bars!.wall5);
    expect(wall.value).toBeGreaterThan(2700);
    expect(Math.abs(wall.value - 2500)).toBeGreaterThan(wall.error);
  });

  it("never calls the refusal a check, and says a paper size and a typed length are taken as exact", () => {
    expect(EXACT).toMatch(/taken as exact: a wrong one is believed, not caught/);
    expect(EXACT).not.toMatch(/check|verif|confirm|validat/i);
    const words = page.replace(/\s+/g, " ");
    expect(words).toContain("A paper size and a typed length are taken as exact. Nothing on this page checks them.");
    expect(words).toContain("No refusal does not mean the references are right.");
    expect(words).toContain("This is a made-up floor drawn by the page, not a photo of a real room.");
    expect(words).toContain("One example of what a measured outline allows.");
  });

  it("refuses in words when the mismatch is gross, or a length is missing", () => {
    const doubled = tell(sample("room", "span"), {}, { spanLength: STICK_CM * 2 }).words;
    expect(doubled.problem).toMatch(/^No measurement\. Known length 1 contradicts the first sheet\..*50% smaller than the length typed/);
    expect(doubled.rows).toEqual([]);
    expect(tell(sample("room", "span")).words.problem).toBe(
      "No measurement. Known length 1 cannot be used: its length is zero or missing. Type its length under Tighter accuracy.",
    );
    expect(doubled.problem).toMatch(/both ends are on the floor\.$/);
    expect(tell(sample("room", "second"), {}, { swap2: true }).words.problem).toMatch(/The second sheet contradicts the first sheet/);
  });
});
