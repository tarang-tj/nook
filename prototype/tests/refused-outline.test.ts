// An outline the maths refused to put numbers on must not come back as a
// drawing to scale or as a verdict about what fits inside it.
import { describe, expect, it } from "vitest";
import { planOf } from "../src/app/exports";
import { closeRoom, newState, type State, type Tool } from "../src/app/state";
import type { Pt } from "../src/measure/homography";
import { sampleTaps } from "../src/sample/floor";
import { SETTINGS, tell } from "./page";
import { project } from "./scene";

/** The made-up floor's taps as a careful finger makes them at the zoom a
 * phone opens at: about 14 photo pixels of tap error each. */
const loose = (taps: Pt[]): Pt[] => taps.map((p) => ({ ...p, s: 14 }));

function outline(tool: Tool, room: Pt[], spread: (taps: Pt[]) => Pt[] = (taps) => taps): State {
  const s = newState(tool);
  s.points.sheet = spread(sampleTaps("sheet"));
  s.points.room = spread(room);
  closeRoom(s);
  return s;
}

describe("the plan from above", () => {
  it("is drawn when the walls have numbers", () => {
    const { solved, words } = tell(outline("room", sampleTaps("room")));
    expect(words.rows.slice(0, 6).every((r) => r.measured)).toBe(true);
    expect(planOf(solved, words.rows, SETTINGS, true).ok).toBe(true);
  });

  it("is not drawn when every wall was refused: no outline to scale, no scale bar", () => {
    const { solved, words } = tell(outline("room", sampleTaps("room")));
    const refused = words.rows.map((r) => ({ ...r, measured: null, text: "no number. Too uncertain." }));
    const plan = planOf(solved, refused, SETTINGS, true);
    expect(plan).toEqual({ ok: false, reason: expect.stringContaining("A wall of this outline has no honest number") });
  });

  it("is not drawn when one wall was refused: its length could be read off the drawing", () => {
    const { solved, words } = tell(outline("room", sampleTaps("room")));
    const rows = [{ name: "Wall 1", measured: null, text: "no number. Too uncertain." }, ...words.rows.slice(1)];
    expect(planOf(solved, rows, SETTINGS, true).ok).toBe(false);
  });

  it("is not drawn while the error bars are still being worked out", () => {
    const { solved } = tell(outline("room", sampleTaps("room")));
    expect(planOf(solved, [], SETTINGS, true).ok).toBe(false);
  });

  it("is not drawn for an outline that crosses itself", () => {
    const bow = [0, 1, 3, 2].map((i) => [{ x: -700, y: -300 }, { x: 800, y: -300 }, { x: 800, y: 2200 }, { x: -700, y: 2200 }][i]);
    const { solved, words } = tell(outline("room", bow.map(project)));
    expect(words.problem).toMatch(/^No measurement\. The outline crosses itself/);
    expect(planOf(solved, words.rows, SETTINGS, true)).toEqual({ ok: false, reason: expect.stringContaining("crosses itself") });
  });

  it("is not drawn from taps made zoomed out on a phone, where every wall is refused", () => {
    const { solved, words } = tell(outline("room", sampleTaps("room"), loose));
    expect(words.rows.slice(0, 6).filter((r) => r.measured)).toEqual([]);
    expect(planOf(solved, words.rows, SETTINGS, true).ok).toBe(false);
  });
});

describe("Fit: the thing inside an outline", () => {
  it("gets no verdict when a wall of the outline has no honest number", () => {
    const s = outline("fit", sampleTaps("room"), loose);
    const { words, bars } = tell(s, {}, { thingWidth: 30, thingDepth: 30 });
    expect(Object.keys(bars!).filter((k) => k.startsWith("wall") && bars![k].value === null).length).toBeGreaterThan(0);
    expect(bars!.spare).toEqual({ value: null, reason: expect.stringContaining("A wall of the outline has no honest number") });
    const inside = words.verdicts.at(-1)!;
    expect(inside).toMatch(/^Inside the outline: cannot say\. A wall of the outline has no honest number/);
    expect(inside).not.toMatch(/to spare|: inside|: outside/);
  });

  it("still gets one when every wall has a number", () => {
    const s = outline("fit", sampleTaps("room"));
    s.thing = project({ x: 300, y: 700 });
    const { words, bars } = tell(s, {}, { thingWidth: 30, thingDepth: 30 });
    expect(bars!.spare.value).not.toBeNull();
    expect(words.verdicts.at(-1)).toMatch(/: inside, with at least \d+(\.\d)? cm to spare\.$/);
  });
});
