// Drawing the photo, the points and the zoomed loupe on the canvas.
import type { EdgeLabel } from "../app/sheet-edges";
import type { Pt } from "../measure/homography";
import { toScreen, type Fit } from "./view";

/** The picture being measured: a loaded photo or the made-up sample floor. */
export type Photo = { source: CanvasImageSource; w: number; h: number };
export type Box = { w: number; h: number; dpr: number };

const SHEET = "#ffb000"; // corners 1 to 4
const FLOOR = "#35d0ff"; // points A and B

function path(ctx: CanvasRenderingContext2D, pts: Pt[], close: boolean, colour: string) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colour;
  ctx.stroke();
}

/** Distance from point `i` to its nearest neighbour, screen px. */
function spacing(pts: Pt[], i: number): number {
  let best = Infinity;
  pts.forEach((q, j) => {
    if (j !== i) best = Math.min(best, Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
  });
  return best;
}

/** `room` is the distance to the nearest other point: crowded rings are
 * drawn smaller and without a label box, so they do not hide a small sheet. */
function ring(ctx: CanvasRenderingContext2D, s: Pt, colour: string, label: string, room = Infinity) {
  // A ring with a clear centre, so the exact spot stays visible.
  ctx.beginPath();
  ctx.arc(s.x, s.y, Math.max(4, Math.min(9, room * 0.3)), 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colour;
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
  if (room < 40) return;
  // The label carries the meaning, not the colour alone.
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(s.x + 12, s.y - 22, 18, 18);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, s.x + 17, s.y - 12);
}

/** Write each edge's assumed length beside it, outside the sheet. */
function edgeLabels(ctx: CanvasRenderingContext2D, fit: Fit, edges: EdgeLabel[]) {
  if (edges.length < 4) return;
  const on = edges.map((e) => ({ a: toScreen(fit, e.a), b: toScreen(fit, e.b), text: e.text }));
  const cx = on.reduce((t, e) => t + e.a.x + e.b.x, 0) / 8;
  const cy = on.reduce((t, e) => t + e.a.y + e.b.y, 0) / 8;
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  // One of each pair is enough: the edge nearest the bottom and the one nearest the right.
  for (const e of [on[2], on[1]]) {
    const m = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
    const away = Math.hypot(m.x - cx, m.y - cy) || 1;
    const width = ctx.measureText(e.text).width + 8;
    const x = m.x + ((m.x - cx) / away) * (width / 2 + 8);
    const y = m.y + ((m.y - cy) / away) * 18;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(x - width / 2, y - 9, width, 18);
    ctx.fillStyle = SHEET;
    ctx.fillText(e.text, x, y);
  }
  ctx.textAlign = "start";
}

/** Draw everything. `ordered` is the sheet outline once four corners exist. */
export function draw(
  ctx: CanvasRenderingContext2D,
  photo: Photo,
  fit: Fit,
  sheet: Pt[],
  ends: Pt[],
  ordered: Pt[] | null,
  edges: EdgeLabel[],
  box: Box,
): void {
  ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  ctx.clearRect(0, 0, box.w, box.h);
  const corner = toScreen(fit, { x: 0, y: 0 });
  ctx.drawImage(photo.source, corner.x, corner.y, photo.w * fit.scale, photo.h * fit.scale);

  if (ordered) path(ctx, ordered.map((p) => toScreen(fit, p)), true, SHEET);
  if (ends.length === 2) path(ctx, ends.map((p) => toScreen(fit, p)), false, FLOOR);

  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const all = [...sheet, ...ends].map((p) => toScreen(fit, p));
  sheet.forEach((_, i) => ring(ctx, all[i], SHEET, String(i + 1), spacing(all, i)));
  ends.forEach((_, i) => ring(ctx, all[4 + i], FLOOR, "AB"[i], spacing(all, 4 + i)));
  edgeLabels(ctx, fit, edges);
}

/** A cross in the middle of the photo box: where Enter places a point when
 * the photo is being driven from the keyboard. */
export function drawCross(ctx: CanvasRenderingContext2D, box: Box): void {
  const c = { x: box.w / 2, y: box.h / 2 };
  for (const [width, colour] of [[4, "rgba(0,0,0,0.7)"], [2, "#fff"]] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(c.x - 14, c.y); ctx.lineTo(c.x - 3, c.y); ctx.moveTo(c.x + 3, c.y); ctx.lineTo(c.x + 14, c.y);
    ctx.moveTo(c.x, c.y - 14); ctx.lineTo(c.x, c.y - 3); ctx.moveTo(c.x, c.y + 3); ctx.lineTo(c.x, c.y + 14);
    ctx.stroke();
  }
}

/** The loupe: the photo around `p`, magnified, with a crosshair on the spot. */
export function drawLoupe(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  p: Pt,
  fit: Fit,
  sizePx: number,
  zoom = 3,
): void {
  const src = sizePx / zoom / fit.scale; // photo pixels shown across the loupe
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, sizePx, sizePx);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, p.x - src / 2, p.y - src / 2, src, src, 0, 0, sizePx, sizePx);
  const c = sizePx / 2;
  for (const [width, colour] of [[3, "rgba(0,0,0,0.7)"], [1, "#fff"]] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(c, 0); ctx.lineTo(c, c - 6); ctx.moveTo(c, c + 6); ctx.lineTo(c, sizePx);
    ctx.moveTo(0, c); ctx.lineTo(c - 6, c); ctx.moveTo(c + 6, c); ctx.lineTo(sizePx, c);
    ctx.stroke();
  }
}
