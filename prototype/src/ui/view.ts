// Drawing the photo, the points and the zoomed loupe. Also the conversion
// between screen positions and photo pixels, which the taps depend on.
import type { Pt } from "../measure/homography";

/** How the photo sits in its box: photo pixel * scale + offset = screen px. */
export type Fit = { scale: number; dx: number; dy: number };

/** Fit the whole photo inside the box, centred, without cropping. */
export function fitContain(imgW: number, imgH: number, boxW: number, boxH: number): Fit {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  return { scale, dx: (boxW - imgW * scale) / 2, dy: (boxH - imgH * scale) / 2 };
}

export const toImage = (fit: Fit, x: number, y: number): Pt => ({
  x: (x - fit.dx) / fit.scale,
  y: (y - fit.dy) / fit.scale,
});

export const toScreen = (fit: Fit, p: Pt): Pt => ({
  x: p.x * fit.scale + fit.dx,
  y: p.y * fit.scale + fit.dy,
});

/** Index of the point within `radius` photo pixels of `p`, or -1. */
export function nearest(points: Pt[], p: Pt, radius: number): number {
  let best = -1;
  let bestD = radius;
  points.forEach((q, i) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

const SHEET = "#ffb000"; // corners 1 to 4
const FLOOR = "#35d0ff"; // points A and B
export const labelFor = (i: number): string => (i < 4 ? String(i + 1) : i === 4 ? "A" : "B");

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

/** Draw everything. `ordered` is the sheet outline once four corners exist. */
export function draw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fit: Fit,
  points: Pt[],
  ordered: Pt[] | null,
  box: { w: number; h: number; dpr: number },
): void {
  ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  ctx.clearRect(0, 0, box.w, box.h);
  const corner = toScreen(fit, { x: 0, y: 0 });
  ctx.drawImage(img, corner.x, corner.y, img.naturalWidth * fit.scale, img.naturalHeight * fit.scale);

  if (ordered) path(ctx, ordered.map((p) => toScreen(fit, p)), true, SHEET);
  if (points.length === 6) path(ctx, [points[4], points[5]].map((p) => toScreen(fit, p)), false, FLOOR);

  ctx.font = "600 13px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  points.forEach((p, i) => {
    const s = toScreen(fit, p);
    const colour = i < 4 ? SHEET : FLOOR;
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
    ctx.fillText(labelFor(i), s.x + 17, s.y - 12);
  });
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
