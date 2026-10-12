import { describe, expect, it } from "vitest";
import { dist, type Pt } from "../src/measure/homography";
import { footprint } from "../src/measure/fit";
import { measured } from "../src/measure/noise";
import { CSV_HEADER, escapeXml, niceLength, planCsv, planSvg, type Plan } from "../src/measure/plan";
import { L_ROOM_ON_FLOOR, LETTER_ON_FLOOR, ROOM_ON_FLOOR, ROOM_TRUTH } from "./scene";

const svgOf = (plan: Plan): { svg: string; pxPerMm: number } => {
  if (!plan.ok) throw new Error(`expected a plan, got: ${plan.reason}`);
  return plan;
};
/** The plotted points of the one polygon with this class. */
const polygon = (svg: string, name: string): Pt[] => {
  const found = [...svg.matchAll(new RegExp(`<polygon class="${name}" points="([^"]+)"`, "g"))];
  expect(found).toHaveLength(1);
  return found[0][1].split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
};
const labels = ["150 ± 5 cm", "250 ± 30 cm", "150 ± 20 cm", "250 ± 30 cm"];

describe("planSvg", () => {
  const { svg, pxPerMm } = svgOf(
    planSvg(ROOM_ON_FLOOR, labels, { sheet: LETTER_ON_FLOOR, sheetLabel: "US Letter", title: "Bedroom", note: "The ± is 2 standard deviations." }),
  );

  it("is one standalone SVG with nothing unfinished in it", () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).not.toMatch(/NaN|undefined|Infinity|null/);
    expect(svg.match(/<text /g)!.length).toBe(svg.match(/<\/text>/g)!.length);
    expect(svg).toContain(">Bedroom</text>");
    expect(svg).toContain("Floor only, seen from above.");
    expect(svg).toContain("The ± is 2 standard deviations.");
  });

  it("draws every wall to one scale", () => {
    const drawn = polygon(svg, "outline");
    expect(drawn).toHaveLength(4);
    // Coordinates are written to a tenth of a pixel, so allow that much.
    drawn.forEach((p, i) => expect(Math.abs(dist(p, drawn[(i + 1) % 4]) / pxPerMm - ROOM_TRUTH.walls[i])).toBeLessThan(0.2 / pxPerMm));
    const width = Number(svg.match(/^<svg [^>]*width="(\d+)"/)![1]);
    for (const p of drawn) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(width);
    }
  });

  it("draws the reference sheet at true size on the same scale", () => {
    const sheet = polygon(svg, "sheet");
    expect(Math.abs(dist(sheet[0], sheet[1]) - 279.4 * pxPerMm)).toBeLessThan(0.2);
    expect(Math.abs(dist(sheet[1], sheet[2]) - 215.9 * pxPerMm)).toBeLessThan(0.2);
    // And in the right place: its first corner is 700 mm right of the room's first corner.
    expect(Math.abs(sheet[0].x - polygon(svg, "outline")[0].x - 700 * pxPerMm)).toBeLessThan(0.2);
    expect(svg).toContain(">US Letter</text>");
  });

  it("has a scale bar whose drawn length matches its label", () => {
    const [, x1, x2] = svg.match(/<line class="scale" x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/)!.map(Number);
    const [, amount, unit] = svg.match(/>(\d+(?:\.\d+)?) (cm|in)<\/text>/)!;
    expect(unit).toBe("cm");
    expect([1, 2, 5]).toContain(Number(amount) / 10 ** Math.floor(Math.log10(Number(amount))));
    expect(Math.abs(x2 - x1 - Number(amount) * 10 * pxPerMm)).toBeLessThan(0.2);
    // In inches the bar is a round number of inches, not of centimetres.
    const inches = svgOf(planSvg(ROOM_ON_FLOOR, labels, { unit: "in" }));
    const [, a1, a2] = inches.svg.match(/<line class="scale" x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/)!.map(Number);
    const [, inchAmount] = inches.svg.match(/>(\d+(?:\.\d+)?) in<\/text>/)!;
    expect(Math.abs(a2 - a1 - Number(inchAmount) * 25.4 * inches.pxPerMm)).toBeLessThan(0.2);
  });

  it("labels each wall once, in order, and skips a wall with no label", () => {
    const walls = [...svg.matchAll(/<text [^>]*class="wall"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    expect(walls).toEqual(labels);
    const partial = svgOf(planSvg(ROOM_ON_FLOOR, ["150 ± 5 cm", "", "150 ± 20 cm"])).svg;
    expect(partial.match(/class="wall"/g)).toHaveLength(2);
  });

  it("keeps the camera at the bottom: a larger floor y is drawn lower", () => {
    const drawn = polygon(svg, "outline");
    expect(drawn[2].y).toBeGreaterThan(drawn[1].y); // corner 3 has y 2200, corner 2 has y -300
    expect(drawn[1].x).toBeGreaterThan(drawn[0].x);
  });

  it("escapes every piece of text it is given", () => {
    const nasty = `<script>alert("x")</script> & 'q'`;
    const out = svgOf(planSvg(ROOM_ON_FLOOR, [nasty], { sheet: LETTER_ON_FLOOR, sheetLabel: nasty, title: nasty, note: nasty })).svg;
    expect(out).not.toContain("<script");
    expect(out).not.toMatch(/alert\("x"\)/);
    expect(out.match(/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;q&#39;/g)).toHaveLength(4);
    expect(escapeXml(`a<b>&"'`)).toBe("a&lt;b&gt;&amp;&quot;&#39;");
  });

  it("draws a thing being tried for fit, and an L-shaped room, to the same scale", () => {
    const thing = footprint({ x: 0, y: 500 }, 600, 400, 0.4);
    const plan = svgOf(planSvg(L_ROOM_ON_FLOOR, [], { footprint: thing }));
    expect(polygon(plan.svg, "outline")).toHaveLength(6);
    const drawn = polygon(plan.svg, "footprint");
    expect(Math.abs(dist(drawn[0], drawn[1]) - 600 * plan.pxPerMm)).toBeLessThan(0.2);
    expect(plan.svg).not.toContain('class="sheet"');
  });

  it("says why when there is no plan to draw", () => {
    expect(planSvg(ROOM_ON_FLOOR.slice(0, 2), [])).toEqual({ ok: false, reason: expect.stringContaining("at least three corners") });
    expect(planSvg([...ROOM_ON_FLOOR.slice(0, 2), { x: NaN, y: 1 }], [])).toEqual({ ok: false, reason: expect.stringContaining("no position") });
    expect(planSvg([{ x: 0, y: 5 }, { x: 10, y: 5 }, { x: 20, y: 5 }], [])).toEqual({ ok: false, reason: expect.stringContaining("one line") });
  });
});

describe("niceLength", () => {
  it("rounds down to 1, 2 or 5 times a power of ten", () => {
    expect([0.7, 1, 1.9, 2, 4.99, 5, 9.9, 37, 120, 800].map(niceLength)).toEqual([0.5, 1, 1, 2, 2, 5, 5, 20, 100, 500]);
  });
});

describe("planCsv", () => {
  it("writes wall, length, error and unit, one row each", () => {
    const csv = planCsv([
      { wall: "Wall 1", measured: measured(150.04321, 4.6, "cm", "basis") },
      { wall: "Area", measured: measured(37500, 6800, "cm²", "basis") },
    ]);
    // The same figures the page shows ("150 ± 5 cm"), not six of them, and
    // the bar rounded up as the page rounds it (6800 and the 500 the value moved: 8000).
    expect(csv).toBe(`${CSV_HEADER}\nWall 1,150,5,cm\nArea,38000,8000,cm²\n`);
    expect(CSV_HEADER).toBe("wall,length,error,unit");
    expect(planCsv([{ wall: "Wall 1", measured: measured(151.614, 7.41672, "cm", "b") }])).toBe(`${CSV_HEADER}\nWall 1,152,8,cm\n`);
    expect(planCsv([{ wall: "Area", measured: measured(3.1512, 0.0436, "m²", "b") }])).toBe(`${CSV_HEADER}\nArea,3.15,0.05,m²\n`);
  });

  it("marks every row with its status when one is given, so a pasted row keeps it", () => {
    const csv = planCsv(
      [{ wall: "Wall 1", measured: measured(150.04321, 4.6, "cm", "basis") }, { wall: "Wall 2", measured: null }],
      "Draft, not checked",
    );
    expect(csv).toBe(`${CSV_HEADER},status\nWall 1,150,5,cm,"Draft, not checked"\nWall 2,,,,"Draft, not checked"\n`);
  });

  it("leaves the number cells empty for a wall with no honest number", () => {
    expect(planCsv([{ wall: "Wall 2", measured: null }])).toBe(`${CSV_HEADER}\nWall 2,,,\n`);
    expect(planCsv([{ wall: "Wall 3", measured: measured(NaN, 1, "cm", "b") }])).toBe(`${CSV_HEADER}\nWall 3,,,cm\n`);
    expect(planCsv([])).toBe(`${CSV_HEADER}\n`);
  });

  it("quotes commas and quotes, and stops a spreadsheet running a formula", () => {
    const csv = planCsv([
      { wall: 'North wall, by the "door"', measured: measured(10, 1, "in", "b") },
      { wall: "=HYPERLINK(1)", measured: null },
    ]);
    expect(csv.split("\n")[1]).toBe('"North wall, by the ""door""",10.0,1.0,in');
    expect(csv.split("\n")[2]).toBe("'=HYPERLINK(1),,,");
  });
});
