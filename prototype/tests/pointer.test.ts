import { describe, expect, it } from "vitest";
import { fakePage, tell } from "./page";
import { letterInPhoto, project } from "./scene";

describe("taps on the photo, replayed without a browser", () => {
  it("six taps on a big screen give a distance, and a seventh changes nothing", () => {
    const page = fakePage({ w: 3000, h: 4000 });
    expect(tell(page.state, { hasPhoto: false }).words.step).toMatch(/Step 1/);
    for (const corner of letterInPhoto()) page.tapPhoto(corner, "mouse");
    expect(tell(page.state).words.step).toMatch(/Step 3.*\(0 of 2\)/);
    page.tapPhoto(project({ x: -300, y: 400 }), "mouse");
    page.tapPhoto(project({ x: 700, y: 400 }), "mouse");
    expect(tell(page.state).words.headline).toBe("A to B: 100 ± 3 cm");
    page.tapPhoto(project({ x: 0, y: 900 }), "mouse");
    expect(page.state.points.ends).toHaveLength(2);
    expect(tell(page.state).words.headline).toBe("A to B: 100 ± 3 cm");
  });

  it("dragging a placed point moves it and keeps the uncertainty of the zoom it was moved at", () => {
    const page = fakePage({ w: 3000, h: 4000 });
    for (const corner of letterInPhoto()) page.tapPhoto(corner, "mouse");
    page.tap({ x: 500, y: 500 }, "mouse");
    page.drag({ x: 505, y: 500 }, { x: 800, y: 900 }, "mouse");
    expect(page.state.points.ends).toHaveLength(1);
    expect(page.state.points.ends[0]).toMatchObject({ x: 795, y: 900, s: 1.5 });
  });
});
