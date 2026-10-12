// Drawing the photo, the points and the zoomed loupe on the canvas.
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

function ring(ctx: CanvasRenderingContext2D, s: Pt, colour: string, label: string) {
  // A ring with a clear centre, so the exact spot stays visible.
  ctx.beginPath();
  ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colour;
  ctx.stroke();
  ctx.fillStyle = colour;
  ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
  // The label carries the meaning, not the colour alone.
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(s.x + 12, s.y - 22, 18, 18);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, s.x + 17, s.y - 12);
}

/** Draw everything. `ordered` is the sheet outline once four corners exist. */
export function draw(
  ctx: CanvasRenderingContext2D,
  photo: Photo,
  fit: Fit,
  sheet: Pt[],
  ends: Pt[],
  ordered: Pt[] | null,
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
  sheet.forEach((p, i) => ring(ctx, toScreen(fit, p), SHEET, String(i + 1)));
  ends.forEach((p, i) => ring(ctx, toScreen(fit, p), FLOOR, "AB"[i]));
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
