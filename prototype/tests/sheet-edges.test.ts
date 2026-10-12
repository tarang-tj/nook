import { describe, expect, it } from "vitest";
import { UNCHECKED } from "../src/app/report";
import { sheetEdges, sheetWords, sideText } from "../src/app/sheet-edges";
import { newState } from "../src/app/state";
import { BASIS } from "../src/measure/monte-carlo";
import { referenceById } from "../src/measure/references";
import { fakePage, tell } from "./page";
import { letterInPhoto, project } from "./scene";

const LETTER = referenceById("letter");
// The same sheet turned so its long side points away from the camera.
const AWAY = [{ x: 0, y: 0 }, { x: 215.9, y: 0 }, { x: 215.9, y: 279.4 }, { x: 0, y: 279.4 }].map(project);

describe("the length assumed for each edge of the sheet", () => {
  it("labels the pair that looks longer with the long side, in the chosen unit", () => {
    const edges = sheetEdges(letterInPhoto(), LETTER, false, "cm")!;
    expect(edges.map((e) => e.text)).toEqual(["27.9 cm", "21.6 cm", "27.9 cm", "21.6 cm"]);
    expect(sheetEdges(letterInPhoto(), LETTER, false, "in")!.map((e) => e.text)).toEqual(["11 in", "8.5 in", "11 in", "8.5 in"]);
    expect(sheetEdges(letterInPhoto(), referenceById("a4"), false, "cm")![0].text).toBe("29.7 cm");
    // Each label sits on a real edge: its two ends are neighbouring corners.
    const longest = Math.hypot(edges[2].a.x - edges[2].b.x, edges[2].a.y - edges[2].b.y);
    expect(longest).toBeGreaterThan(400);
  });

  it("shows a wrong guess: a sheet with its long side pointing away gets 11 in on a short edge until the box is ticked", () => {
    // In the photo the across pair (truly 8.5 in) looks longer, so it is given 11 in. That is wrong, and now visible.
    expect(sheetEdges(AWAY, LETTER, false, "in")![0].text).toBe("11 in");
    expect(sheetEdges(AWAY, LETTER, true, "in")!.map((e) => e.text)).toEqual(["8.5 in", "11 in", "8.5 in", "11 in"]);
  });

  it("gives no labels until there are four usable corners", () => {
    expect(sheetEdges(letterInPhoto().slice(0, 3), LETTER, false, "cm")).toBeNull();
    const line = [0, 1, 2, 3].map((i) => ({ x: 100 * i, y: 50 }));
    expect(sheetEdges(line, LETTER, false, "cm")).toBeNull();
  });

  it("says the assumption in words", () => {
    expect(sideText(279.4, "in")).toBe("11 in");
    expect(sheetWords("Sheet", LETTER, false, "cm")).toBe(
      "Sheet taken as US Letter, 27.9 cm by 21.6 cm. The 27.9 cm length is given to the pair of sides that looks longer in the photo. Each edge is labelled with the length it was given.",
    );
    expect(sheetWords("Sheet", LETTER, true, "cm")).toContain("looks shorter in the photo");
  });
});

describe("words that must stay on screen", () => {
  it("a file that could not be opened stays reported until a photo loads, whatever redraws", () => {
    const s = newState();
    const notice = "That file could not be opened as a photo. Try another one.";
    for (let redraw = 0; redraw < 3; redraw++) expect(tell(s, { hasPhoto: false, notice }).words.notice).toBe(notice);
    expect(tell(s, { hasPhoto: false, notice }).words.step).toMatch(/Step 1/);
    expect(tell(s).words.notice).toBe("");
  });

  it("the tape-measure sentence is beside every result, and in the short line that never folds away", () => {
    expect(UNCHECKED).toMatch(/Not checked against a tape measure or a real photo/);
    expect(BASIS).toMatch(/has not yet been checked against a tape measure/);
    const page = fakePage({ w: 3000, h: 4000 });
    for (const p of [...letterInPhoto(), project({ x: -300, y: 400 }), project({ x: 700, y: 400 })]) page.tapPhoto(p, "mouse");
    const { words } = tell(page.state);
    expect(words.headline).toBe("A to B: 100 ± 3 cm");
    expect(words.basis).toContain("has not yet been checked against a tape measure");
    expect(words.sheet).toMatch(/^Sheet taken as US Letter/);
  });
});
