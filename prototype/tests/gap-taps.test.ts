// The Fit tab's gap on a phone. The two sides of a gap are walls, so a gap
// tap often lands close to a corner of the outline. On the made-up floor at
// the fitted zoom the first red cross is about 20 screen pixels from outline
// corner 6, inside a finger's reach of 24: the tap used to pick up the corner
// and the gap could not be placed.
import { describe, expect, it } from "vitest";
import { pressOn, REACH } from "../src/app/press";
import { placeSampleTaps } from "../src/app/sample-taps";
import { dist } from "../src/measure/homography";
import { sampleTaps } from "../src/sample/floor";
import { fakePage, PHONE_BOX } from "./page";

/** The made-up floor on a phone with its outline closed on the Room tab,
 * then the Fit tab chosen: the gap is waiting for its two taps. */
function fitPageWithOutline() {
  const page = fakePage(PHONE_BOX, "room");
  placeSampleTaps(page.state);
  page.state.tool = "fit";
  return page;
}
const [left, right] = sampleTaps("gap");
const corner6 = sampleTaps("room")[5];

describe("the gap's two taps with an outline already closed", () => {
  it("the made-up floor's first gap cross is inside a finger's reach of outline corner 6", () => {
    const page = fitPageWithOutline();
    expect(page.state.closed).toBe(true);
    const apart = dist(page.screen(left), page.screen(corner6));
    expect(apart).toBeGreaterThan(18);
    expect(apart).toBeLessThan(REACH.touch);
  });

  it("plain taps on both crosses place the gap and leave the outline alone", () => {
    const page = fitPageWithOutline();
    const outline = JSON.stringify(page.state.points.room);
    page.tapPhoto(left);
    expect(page.state.points.gap).toHaveLength(1);
    page.tapPhoto(right);
    expect(page.state.points.gap).toHaveLength(2);
    expect(dist(page.state.points.gap[0], left)).toBeLessThan(1e-6);
    expect(JSON.stringify(page.state.points.room)).toBe(outline);
  });

  it("a finger that slides on the first cross drags the new gap point, not the corner", () => {
    const page = fitPageWithOutline();
    const outline = JSON.stringify(page.state.points.room);
    const from = page.screen(left);
    page.drag(from, { x: from.x + 6, y: from.y + 3 });
    expect(page.state.points.gap).toHaveLength(1);
    expect(JSON.stringify(page.state.points.room)).toBe(outline);
  });

  it("the sheet and the dashed box can still be picked up while the gap is waiting", () => {
    const page = fitPageWithOutline();
    const scale = page.view().scale;
    expect(pressOn(page.state, sampleTaps("sheet")[0], scale, "touch")).toEqual({ kind: "grab", handle: { group: "sheet", index: 0 } });
    const box = page.state.points.room.reduce((t, p) => ({ x: t.x + p.x / 6, y: t.y + p.y / 6 }), { x: 0, y: 0 });
    expect(pressOn(page.state, box, scale, "touch")).toEqual({ kind: "grab", handle: { group: "thing", index: 0 } });
  });

  it("once both sides are placed, a press on an outline corner picks it up again", () => {
    const page = fitPageWithOutline();
    page.tapPhoto(left);
    page.tapPhoto(right);
    const far = sampleTaps("room")[1];
    expect(pressOn(page.state, far, page.view().scale, "touch")).toEqual({ kind: "grab", handle: { group: "room", index: 1 } });
  });
});
