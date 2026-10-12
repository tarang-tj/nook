// The press rules, at the level of fingers on the screen. The first case is
// the audit's blocking bug: on a phone the sheet is about 56 by 28 screen
// pixels, and plain taps on corners 3 and 4 used to move corners 1 and 2.
import { describe, expect, it } from "vitest";
import { grabReach, pressOn } from "../src/app/press";
import { newState, place } from "../src/app/state";
import { dist } from "../src/measure/homography";
import { fakePage } from "./page";
import { letterInPhoto, project } from "./scene";

const A = project({ x: -300, y: 400 });
const B = project({ x: 700, y: 400 });

describe("plain taps on a phone-size screen", () => {
  it("place all four corners of a sheet 56 by 28 screen pixels, then A and B", () => {
    const page = fakePage();
    const corners = letterInPhoto();
    const onScreen = corners.map(page.screen);
    expect(dist(onScreen[0], onScreen[1])).toBeGreaterThan(50);
    expect(dist(onScreen[1], onScreen[2])).toBeLessThan(30); // inside the old 28 px grab disc
    for (const corner of corners) page.tapPhoto(corner);
    expect(page.state.points.sheet).toHaveLength(4);
    page.state.points.sheet.forEach((p, i) => expect(dist(p, corners[i])).toBeLessThan(1e-6));
    page.tapPhoto(A);
    page.tapPhoto(B);
    expect(page.state.points.ends).toHaveLength(2);
    expect(dist(page.state.points.ends[1], B)).toBeLessThan(1e-6);
  });

  it("place the four corners of a far-away sheet only 20 by 12 screen pixels", () => {
    // Without the rule "no picking up while the corners are being placed",
    // the second tap lands inside the first corner's reach and moves it.
    const page = fakePage();
    const taps = [{ x: 100, y: 100 }, { x: 120, y: 100 }, { x: 120, y: 112 }, { x: 100, y: 112 }];
    for (const t of taps) page.tap(t);
    expect(page.state.points.sheet).toHaveLength(4);
    page.state.points.sheet.forEach((p, i) => expect(dist(page.screen(p), taps[i])).toBeLessThan(1e-6));
  });

  it("a tap on a placed point moves nothing, even when it lands a little off it", () => {
    const page = fakePage();
    for (const p of [...letterInPhoto(), A, B]) page.tapPhoto(p);
    const before = JSON.stringify(page.state.points);
    const b = page.screen(B);
    page.tap({ x: b.x + 3, y: b.y - 2 });
    page.drag({ x: b.x + 3, y: b.y }, { x: b.x + 5, y: b.y + 2 }); // 2.8 px of travel: still a tap
    expect(JSON.stringify(page.state.points)).toBe(before);
  });

  it("a held point moves once the finger has travelled a few pixels, by as far as the finger went", () => {
    const page = fakePage();
    for (const p of [...letterInPhoto(), A, B]) page.tapPhoto(p);
    const b = page.screen(B);
    page.drag({ x: b.x + 3, y: b.y }, { x: b.x + 43, y: b.y + 30 });
    const moved = page.screen(page.state.points.ends[1]);
    expect(moved.x - b.x).toBeCloseTo(40, 6);
    expect(moved.y - b.y).toBeCloseTo(30, 6);
    expect(page.state.points.ends).toHaveLength(2);
  });

  it("once the four corners are down, a press on one picks it up instead of placing", () => {
    const page = fakePage();
    const corners = letterInPhoto();
    for (const corner of corners) page.tapPhoto(corner);
    const c = page.screen(corners[2]);
    page.drag(c, { x: c.x + 20, y: c.y + 20 });
    expect(page.state.points.sheet).toHaveLength(4);
    expect(page.state.points.ends).toHaveLength(0);
    expect(dist(page.screen(page.state.points.sheet[2]), { x: c.x + 20, y: c.y + 20 })).toBeLessThan(1e-6);
  });
});

describe("how far a press reaches", () => {
  it("is 24 screen pixels for a finger and 12 for a mouse when nothing else is near", () => {
    const s = newState();
    for (const p of [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }, { x: 500, y: 500 }]) place(s, p);
    const near = { x: 518, y: 500 }; // 18 px from the lone point at a scale of 1
    expect(pressOn(s, near, 1, "touch")).toEqual({ kind: "grab", handle: { group: "ends", index: 0 } });
    expect(pressOn(s, near, 1, "pen").kind).toBe("grab");
    expect(pressOn(s, near, 1, "mouse")).toEqual({ kind: "place" });
    expect(pressOn(s, { x: 510, y: 500 }, 1, "mouse").kind).toBe("grab");
    // Zoomed out to a tenth, 18 screen pixels is 180 photo pixels.
    expect(pressOn(s, { x: 680, y: 500 }, 0.1, "touch").kind).toBe("grab");
    expect(pressOn(s, { x: 760, y: 500 }, 0.1, "touch").kind).toBe("place");
  });

  it("shrinks to 0.4 of the spacing between crowded points, but never under 8 (finger) or 5 (mouse)", () => {
    expect(grabReach(24, 8, Infinity)).toBe(24);
    expect(grabReach(24, 8, 40)).toBeCloseTo(16, 12);
    expect(grabReach(24, 8, 10)).toBe(8);
    expect(grabReach(12, 5, 20)).toBeCloseTo(8, 12);
    expect(grabReach(12, 5, 4)).toBe(5);
    expect(grabReach(4, 8, 4)).toBe(4); // a floor never widens the reach
  });

  it("leaves the space between two close points free for a new tap", () => {
    const s = newState();
    for (const p of [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }, { x: 500, y: 500 }, { x: 530, y: 500 }]) place(s, p);
    // A and B are 30 px apart: each keeps 12 px of reach, so the middle is free.
    expect(pressOn(s, { x: 515, y: 500 }, 1, "touch")).toEqual({ kind: "place" });
    expect(pressOn(s, { x: 510, y: 500 }, 1, "touch")).toEqual({ kind: "grab", handle: { group: "ends", index: 0 } });
  });
});
