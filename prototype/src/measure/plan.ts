// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// The room seen from straight above, as text: an SVG drawing and a CSV table.
// Pure string building, no page and no canvas, so the page can offer both as
// local downloads and the tests can read them back.
//
// Floor positions are drawn as they are: x to the right, y down the page.
// The plane map puts y growing towards the camera, so the camera ends up at
// the bottom of the plan, the same way up as the photo.
import type { Pt } from "./homography";
import { isMeasured, type Measured } from "./noise";
import { fromMm, toMm, type Unit } from "./units";

export type PlanOptions = {
  /** The reference sheet's four floor corners, mm. Drawn at true size, so the
   * reader can see how small the known size is next to the room. */
  sheet?: Pt[];
  sheetLabel?: string;
  /** Floor corners of a thing being tried for fit, mm. */
  footprint?: Pt[];
  /** Unit of the scale bar. */
  unit?: Unit;
  /** Width of the drawing in pixels. */
  widthPx?: number;
  title?: string;
  /** Words under the drawing: what the error bars cover and leave out. */
  note?: string;
};

export type Plan =
  | { ok: true; svg: string; /** Drawing pixels per floor millimetre. */ pxPerMm: number }
  | { ok: false; reason: string };

const INK = "#1b2a2f";
const FONT = 'font-family="system-ui, sans-serif"';
const MARGIN = 64; // room round the outline for the wall labels, px

/** Make text safe to place inside SVG, as content or as an attribute. */
export const escapeXml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Break text into lines of about `max` characters, at spaces. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + word.length + 1 > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  return line ? [...lines, line] : lines;
}

/** The largest of 1, 2 or 5 times a power of ten that is no more than `limit`. */
export function niceLength(limit: number): number {
  const power = 10 ** Math.floor(Math.log10(limit));
  const lead = limit / power;
  return (lead >= 5 ? 5 : lead >= 2 ? 2 : 1) * power;
}

const finite = (pts: Pt[]): boolean => pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
const n1 = (v: number): string => v.toFixed(1);

/** A top-down plan. `corners` are the outline's floor positions in mm, in
 * order. `labels[i]` is the text for the wall from corner i to corner i + 1
 * (for example "342 ± 5 cm"); a missing or empty label draws nothing. */
export function planSvg(corners: Pt[], labels: string[], options: PlanOptions = {}): Plan {
  if (corners.length < 3) return { ok: false, reason: "A plan needs an outline of at least three corners." };
  const extras = [options.sheet ?? [], options.footprint ?? []];
  if (!finite(corners) || !extras.every(finite))
    return { ok: false, reason: "A corner has no position on the floor, so the plan cannot be drawn." };

  const all = [...corners, ...extras.flat()];
  const minX = Math.min(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const spanX = Math.max(...all.map((p) => p.x)) - minX;
  const spanY = Math.max(...all.map((p) => p.y)) - minY;
  if (!(spanX > 0) || !(spanY > 0)) return { ok: false, reason: "The corners are all in one line, so there is no plan to draw." };

  const width = Math.max(240, Math.round(options.widthPx ?? 640));
  const inner = width - 2 * MARGIN;
  // One scale for everything: fit the width, but do not let a long thin room
  // run more than one and a half widths down the page.
  const pxPerMm = Math.min(inner / spanX, (inner * 1.5) / spanY);
  const top = MARGIN + (options.title ? 24 : 0);
  const left = MARGIN + (inner - spanX * pxPerMm) / 2;
  const at = (p: Pt): Pt => ({ x: left + (p.x - minX) * pxPerMm, y: top + (p.y - minY) * pxPerMm });
  const path = (pts: Pt[]): string => pts.map(at).map((p) => `${n1(p.x)},${n1(p.y)}`).join(" ");
  const text = (x: number, y: number, size: number, words: string, more = ""): string =>
    `<text x="${n1(x)}" y="${n1(y)}" ${FONT} font-size="${size}" fill="${INK}"${more}>${escapeXml(words)}</text>`;

  const bottom = top + spanY * pxPerMm;
  const unit = options.unit ?? "cm";
  const barUnits = niceLength(fromMm(inner / 3 / pxPerMm, unit));
  const barPx = toMm(barUnits, unit) * pxPerMm;
  const barY = bottom + MARGIN - 8;
  const footer = [
    "Floor only, seen from above. Not a survey.",
    ...(options.note ? wrap(options.note, Math.max(40, Math.floor(width / 6.2))) : []),
  ];
  const height = Math.ceil(barY + 30 + footer.length * 15);

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top-down plan of the floor outline">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
  ];
  if (options.title) out.push(text(MARGIN, 34, 16, options.title, ' font-weight="600"'));
  out.push(`<polygon class="outline" points="${path(corners)}" fill="#eef4f5" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`);
  if (options.sheet?.length) {
    const mid = at(centre(options.sheet));
    out.push(`<polygon class="sheet" points="${path(options.sheet)}" fill="#ffffff" stroke="#b2572d" stroke-width="1.5"/>`);
    out.push(text(mid.x, mid.y - 10, 10, options.sheetLabel ?? "sheet", ' text-anchor="middle"'));
  }
  if (options.footprint?.length)
    out.push(`<polygon class="footprint" points="${path(options.footprint)}" fill="none" stroke="#2d6cb2" stroke-width="1.5" stroke-dasharray="6 4"/>`);

  const middle = centre(corners);
  corners.forEach((corner, i) => {
    const a = at(corner);
    const b = at(corners[(i + 1) % corners.length]);
    out.push(`<circle cx="${n1(a.x)}" cy="${n1(a.y)}" r="3" fill="${INK}"/>`);
    const label = labels[i];
    if (!label) return;
    // Push the label off the wall, away from the middle of the room.
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const c = at(middle);
    const away = Math.hypot(m.x - c.x, m.y - c.y) || 1;
    const x = m.x + ((m.x - c.x) / away) * 18;
    const y = m.y + ((m.y - c.y) / away) * 18 + 4;
    out.push(text(x, y, 12, label, ' class="wall" text-anchor="middle" font-weight="600" stroke="#ffffff" stroke-width="3" paint-order="stroke"'));
  });

  out.push(`<line class="scale" x1="${n1(MARGIN)}" y1="${n1(barY)}" x2="${n1(MARGIN + barPx)}" y2="${n1(barY)}" stroke="${INK}" stroke-width="3"/>`);
  out.push(text(MARGIN, barY - 7, 11, `${barUnits} ${unit}`));
  footer.forEach((line, i) => out.push(text(MARGIN, barY + 24 + i * 15, 11, line)));
  out.push("</svg>");
  return { ok: true, svg: out.join("\n"), pxPerMm };
}

const centre = (pts: Pt[]): Pt => ({
  x: pts.reduce((t, p) => t + p.x, 0) / pts.length,
  y: pts.reduce((t, p) => t + p.y, 0) / pts.length,
});

/** One table row. `measured` is null when there was no honest number, and
 * the row is still written, with empty cells, so a gap in the table shows. */
export type PlanRow = { wall: string; measured: Measured | null };

export const CSV_HEADER = "wall,length,error,unit";

/** One CSV cell. Quoted when it holds a comma, a quote or a line break. A
 * leading =, +, - or @ gets an apostrophe so a spreadsheet does not run it. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const csvNumber = (v: number): string => String(Number(v.toPrecision(6)));

/** The table as CSV text: wall, length, error (the half-width of the bar),
 * unit. The page adds its perimeter and area as rows of their own. */
export function planCsv(rows: PlanRow[]): string {
  const lines = rows.map(({ wall, measured: m }) =>
    m && isMeasured(m)
      ? [csvCell(wall), csvNumber(m.value), csvNumber(m.error), csvCell(m.unit)].join(",")
      : [csvCell(wall), "", "", csvCell(m?.unit ?? "")].join(","),
  );
  return [CSV_HEADER, ...lines].join("\n") + "\n";
}
