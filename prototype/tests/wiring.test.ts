// The page itself, src/main.ts, started on a stand-in browser and worked by
// its own controls. The rules these checks rest on are tested one by one in
// other files; what is checked here is that the page is wired to them. Each
// check was seen to fail with its wire cut.
import { afterEach, describe, expect, it, vi } from "vitest";
import { CSV_HEADER } from "../src/measure/plan";
import { startPage, stopPage } from "./fake-dom";

afterEach(stopPage);

const papers = (page: Awaited<ReturnType<typeof startPage>>) => ({
  paper: page.el("paper").value,
  swap: page.el("swap").checked,
  paper2: page.el("paper2").value,
  swap2: page.el("swap2").checked,
  span: page.el("span-length").value,
});

describe("the page, wired", () => {
  it("starts as index.html has it", async () => {
    const page = await startPage();
    expect(papers(page)).toEqual({ paper: "letter", swap: false, paper2: "letter", swap2: false, span: "" });
    expect(page.el("unit").value).toBe("cm");
    expect(page.el("thing-width").value).toBe("80");
    expect(page.el("step").textContent).toMatch(/photo/i);
  });

  it("changing Units rewrites a typed length in the new unit and keeps its size", async () => {
    const page = await startPage();
    page.set("thing-width", "80");
    page.set("unit", "in");
    expect(page.el("thing-width").value).toBe("31.5");
    expect(page.el("thing-depth").value).toBe("23.62");
    page.set("thing-depth", "30"); // typed while inches are showing
    page.set("unit", "cm");
    expect(page.el("thing-width").value).toBe("80");
    expect(page.el("thing-depth").value).toBe("76.2");
  });

  it("a new picture starts with its own swap boxes, second paper and known length", async () => {
    const page = await startPage();
    page.loadPhoto();
    page.tick("swap", true);
    page.set("paper2", "a4");
    page.tick("swap2", true);
    page.set("span-length", "100");
    page.loadPhoto();
    expect(papers(page)).toEqual({ paper: "letter", swap: false, paper2: "letter", swap2: false, span: "" });
    page.tick("swap", true);
    page.press("sample");
    expect(papers(page)).toEqual({ paper: "letter", swap: false, paper2: "a4", swap2: false, span: "" });
    page.tick("swap", true);
    page.set("paper2", "letter");
    page.press("reset"); // Start over is a fresh start for the same picture
    expect(papers(page)).toEqual({ paper: "letter", swap: false, paper2: "a4", swap2: false, span: "" });
  });

  it("the made-up floor's paper does not stay for the next photo", async () => {
    const page = await startPage();
    page.set("paper", "a4");
    page.loadPhoto();
    expect(page.el("paper").value).toBe("a4");
    page.press("sample");
    expect(page.el("paper").value).toBe("letter"); // the paper the floor was painted with
    page.press("tab-room");
    page.press("sample-taps");
    page.press("reset"); // Start over, still on the made-up floor
    expect(page.el("paper").value).toBe("letter");
    page.loadPhoto();
    expect(page.el("paper").value).toBe("a4"); // the person's own choice is back
    page.loadPhoto();
    expect(page.el("paper").value).toBe("a4");
  });

  it("a paper picked while the made-up floor is up is kept for the next photo", async () => {
    const page = await startPage();
    page.press("sample");
    page.set("paper", "a4"); // picked by hand, with the made-up floor showing
    page.loadPhoto();
    expect(page.el("paper").value).toBe("a4");
    page.press("sample");
    page.press("tab-room");
    page.press("sample-taps"); // the page sets the floor's own paper: not a pick
    page.loadPhoto();
    expect(page.el("paper").value).toBe("a4");
  });

  it("any number on the page comes with the not-checked sentence", async () => {
    const page = await startPage();
    page.press("sample");
    page.press("tab-room");
    page.press("sample-taps");
    vi.runAllTimers();
    expect(page.el("unchecked").hidden).toBe(false);
    expect(page.el("unchecked").textContent).toMatch(/Not checked against a tape measure/);
  });

  it("the saved CSV of the made-up floor says so on every row, with the figures on the page", async () => {
    const page = await startPage();
    page.press("sample");
    page.press("tab-room");
    page.press("sample-taps");
    vi.runAllTimers(); // the error bars
    expect(page.el("working").hidden).toBe(true);
    expect(page.el("save-csv").disabled).toBe(false);
    page.press("save-csv");
    const [csv] = await page.saved();
    const [header, ...rows] = csv.trim().split("\n");
    expect(header).toBe(`${CSV_HEADER},status`);
    expect(rows).toHaveLength(8); // six walls, the perimeter, the area
    for (const row of rows) expect(row).toMatch(/Draft from a prototype, of a made-up floor, not a real room\. Not checked/);
    const shown = (page.el("rows").children as { children: unknown[] }[]).map((li) => String(li.children[1]));
    expect(shown).toHaveLength(8);
    rows.forEach((row, i) => {
      const [, length, error] = row.split(",");
      expect(shown[i].startsWith(`${length} ± ${error} `), `${shown[i]} against ${row}`).toBe(true);
    });
  });
});
