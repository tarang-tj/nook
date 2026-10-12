import { describe, expect, it } from "vitest";
import { clampView, isFitted, MAX_SCALE, panBy, pinchView, scaleLimits, zoomAt, zoomWords } from "../src/app/zoom";
import { dist } from "../src/measure/homography";
import { fitContain, toImage } from "../src/ui/view";
import { fakePage, PHONE_BOX, PHOTO } from "./page";
import { letterInPhoto, project } from "./scene";

const FIT = fitContain(PHOTO.w, PHOTO.h, PHONE_BOX.w, PHONE_BOX.h);

describe("zoom and pan limits", () => {
  it("goes from the whole photo in view to 4 screen pixels per photo pixel", () => {
    const { min, max } = scaleLimits(PHOTO, PHONE_BOX);
    expect(min).toBeCloseTo(511 / 4000, 12);
    expect(max).toBe(MAX_SCALE);
    expect(zoomAt(FIT, 0.5, { x: 100, y: 100 }, PHOTO, PHONE_BOX)).toEqual(FIT);
    expect(zoomAt(FIT, 1e6, { x: 100, y: 100 }, PHOTO, PHONE_BOX).scale).toBe(MAX_SCALE);
    expect(isFitted(FIT, PHOTO, PHONE_BOX)).toBe(true);
    expect(isFitted(zoomAt(FIT, 1.6, { x: 100, y: 100 }, PHOTO, PHONE_BOX), PHOTO, PHONE_BOX)).toBe(false);
  });

  it("keeps the photo pixel under the finger where it is while zooming", () => {
    const at = { x: 180, y: 300 };
    const before = toImage(FIT, at.x, at.y);
    const zoomed = zoomAt(FIT, 3, at, PHOTO, PHONE_BOX);
    expect(zoomed.scale).toBeCloseTo(FIT.scale * 3, 12);
    expect(dist(toImage(zoomed, at.x, at.y), before)).toBeLessThan(1e-9);
  });

  it("never slides the photo off to leave an empty strip, and centres a side that is smaller than the box", () => {
    const zoomed = zoomAt(FIT, 4, { x: 195, y: 255 }, PHOTO, PHONE_BOX);
    const far = panBy(zoomed, 1e6, 1e6, PHOTO, PHONE_BOX);
    expect(far.dx).toBeCloseTo(0, 12);
    expect(far.dy).toBeCloseTo(0, 12);
    const other = panBy(zoomed, -1e6, -1e6, PHOTO, PHONE_BOX);
    expect(other.dx).toBeCloseTo(PHONE_BOX.w - PHOTO.w * zoomed.scale, 9);
    expect(other.dy).toBeCloseTo(PHONE_BOX.h - PHOTO.h * zoomed.scale, 9);
    // At the widest zoom the tall photo is narrower than the box: centred, and a slide does nothing.
    expect(panBy(FIT, 50, 50, PHOTO, PHONE_BOX)).toEqual(FIT);
    expect(clampView({ scale: 0.001, dx: 9, dy: 9 }, PHOTO, PHONE_BOX)).toEqual(FIT);
  });

  it("pinch: fingers twice as far apart doubles the zoom about the point between them", () => {
    const start = zoomAt(FIT, 2, { x: 195, y: 255 }, PHOTO, PHONE_BOX);
    const a0 = { x: 150, y: 250 }, b0 = { x: 250, y: 250 };
    const under = toImage(start, 200, 250);
    const after = pinchView(start, a0, b0, { x: 110, y: 270 }, { x: 310, y: 270 }, PHOTO, PHONE_BOX);
    expect(after.scale).toBeCloseTo(start.scale * 2, 12);
    expect(dist(toImage(after, 210, 270), under)).toBeLessThan(1e-9);
  });

  it("says the zoom, and what a tap is worth at it, in words", () => {
    expect(zoomWords(FIT, 1.5)).toBe("Zoom: 1 screen pixel is 7.8 photo pixels. A tap here counts as about 12 photo pixels off.");
    expect(zoomWords({ scale: 2, dx: 0, dy: 0 }, 1.5)).toBe("Zoom: 1 photo pixel is 2 screen pixels. A tap here counts as about 0.75 photo pixels off.");
  });
});

describe("zoom with fingers on the photo", () => {
  it("a second finger turns a tap into a pinch: no point is left behind and the photo zooms", () => {
    const page = fakePage();
    for (const corner of letterInPhoto()) page.tapPhoto(corner);
    page.pointer.down({ id: 91, x: 150, y: 300, type: "touch" });
    expect(page.state.points.ends).toHaveLength(1); // the first finger looked like a tap
    page.pointer.down({ id: 92, x: 250, y: 300, type: "touch" });
    expect(page.state.points.ends).toHaveLength(0);
    page.pointer.move({ id: 91, x: 50, y: 300, type: "touch" });
    page.pointer.move({ id: 92, x: 350, y: 300, type: "touch" });
    expect(page.view().scale).toBeCloseTo(FIT.scale * 3, 9);
    page.pointer.up({ id: 91, x: 50, y: 300, type: "touch" });
    page.pointer.move({ id: 92, x: 300, y: 200, type: "touch" });
    page.pointer.up({ id: 92, x: 300, y: 200, type: "touch" });
    expect(page.state.points.ends).toHaveLength(0);
    expect(page.state.points.sheet).toHaveLength(4);
    expect(page.pointer.busy()).toBe(false);
  });

  it("a second finger puts a picked-up point back where it was", () => {
    const page = fakePage();
    const a = project({ x: -300, y: 400 });
    for (const p of [...letterInPhoto(), a]) page.tapPhoto(p);
    const at = page.screen(a);
    page.pointer.down({ id: 1, x: at.x, y: at.y, type: "touch" });
    page.pointer.move({ id: 1, x: at.x + 30, y: at.y, type: "touch" });
    expect(dist(page.state.points.ends[0], a)).toBeGreaterThan(100);
    page.pointer.down({ id: 2, x: at.x + 90, y: at.y, type: "touch" });
    expect(dist(page.state.points.ends[0], a)).toBeLessThan(1e-9);
  });

  it("a tap keeps the uncertainty of the zoom it was placed at, and zoomed right in it lands within a photo pixel", () => {
    const page = fakePage();
    const corners = letterInPhoto();
    for (const corner of corners) page.tapPhoto(corner);
    const a = project({ x: -300, y: 400 });
    page.tapPhoto(a);
    expect(page.state.points.ends[0].s).toBeCloseTo(1.5 / FIT.scale, 9); // about 12 photo pixels
    page.setView(zoomAt(page.view(), 1e6, page.screen(a), PHOTO, PHONE_BOX));
    const b = project({ x: -250, y: 420 });
    const whole = { x: Math.round(page.screen(b).x), y: Math.round(page.screen(b).y) }; // a finger lands on whole screen pixels
    page.tap(whole);
    expect(page.state.points.ends[1].s).toBeCloseTo(1.5 / MAX_SCALE, 9);
    expect(dist(page.state.points.ends[1], b)).toBeLessThan(1);
    // The first point keeps what it was placed with until it is moved at the new zoom.
    expect(page.state.points.ends[0].s).toBeCloseTo(1.5 / FIT.scale, 9);
    const at = page.screen(a);
    page.drag(at, { x: at.x + 10, y: at.y });
    expect(page.state.points.ends[0].s).toBeCloseTo(1.5 / MAX_SCALE, 9);
  });

  it("with Move photo on, one finger slides the photo and places nothing", () => {
    const page = fakePage();
    for (const corner of letterInPhoto()) page.tapPhoto(corner);
    page.setView(zoomAt(page.view(), 4, { x: 195, y: 255 }, PHOTO, PHONE_BOX));
    const before = page.view();
    page.setPanning(true);
    page.drag({ x: 200, y: 300 }, { x: 160, y: 250 });
    expect(page.view().dx).toBeCloseTo(before.dx - 40, 9);
    expect(page.view().dy).toBeCloseTo(before.dy - 50, 9);
    expect(page.state.points.ends).toHaveLength(0);
  });
});
