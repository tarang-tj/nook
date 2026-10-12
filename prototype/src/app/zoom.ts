// Zoom and pan. The view is the same three numbers the rest of the page
// already uses (photo pixel * scale + offset = screen px); zooming only
// changes them. Pure, so the limits can be tested without a browser.
//
// Why zoom matters here: a tap is taken to be about 1.5 screen pixels off.
// Fitted to a phone screen one screen pixel is about eight photo pixels, so
// that tap is 12 photo pixels off. Zoomed in until one screen pixel is one
// photo pixel, the same tap is 1.5 photo pixels off, and the error bar
// shrinks with it.
import type { Pt } from "../measure/homography";
import { fitContain, type Fit } from "../ui/view";

export type Size = { w: number; h: number };

/** The closest zoom: screen pixels per photo pixel. */
export const MAX_SCALE = 4;
/** How much one press of plus or minus zooms. */
export const ZOOM_STEP = 1.6;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The widest and closest zoom for this photo in this box. The widest shows
 * the whole photo. */
export function scaleLimits(photo: Size, box: Size): { min: number; max: number } {
  const min = fitContain(photo.w, photo.h, box.w, box.h).scale;
  return { min, max: Math.max(MAX_SCALE, min) };
}

/** Keep the zoom inside its limits and the photo over the box: centred along
 * a side where it is smaller than the box, and with no empty strip along a
 * side where it is larger. */
export function clampView(view: Fit, photo: Size, box: Size): Fit {
  const { min, max } = scaleLimits(photo, box);
  const scale = clamp(view.scale, min, max);
  const along = (photoLen: number, boxLen: number, offset: number): number => {
    const shown = photoLen * scale;
    return shown <= boxLen ? (boxLen - shown) / 2 : clamp(offset, boxLen - shown, 0);
  };
  return { scale, dx: along(photo.w, box.w, view.dx), dy: along(photo.h, box.h, view.dy) };
}

/** Zoom by `factor`, keeping the photo pixel under screen point `at` where it is. */
export function zoomAt(view: Fit, factor: number, at: Pt, photo: Size, box: Size): Fit {
  const { min, max } = scaleLimits(photo, box);
  const scale = clamp(view.scale * factor, min, max);
  const k = scale / view.scale;
  return clampView({ scale, dx: at.x - (at.x - view.dx) * k, dy: at.y - (at.y - view.dy) * k }, photo, box);
}

/** Slide the photo by a number of screen pixels. */
export const panBy = (view: Fit, dx: number, dy: number, photo: Size, box: Size): Fit =>
  clampView({ scale: view.scale, dx: view.dx + dx, dy: view.dy + dy }, photo, box);

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Two fingers went down at `a0` and `b0` with the view at `start`, and are
 * now at `a1` and `b1`: zoom by how far they spread and slide by how far
 * their middle moved. */
export function pinchView(start: Fit, a0: Pt, b0: Pt, a1: Pt, b1: Pt, photo: Size, box: Size): Fit {
  const before = Math.hypot(a0.x - b0.x, a0.y - b0.y);
  const after = Math.hypot(a1.x - b1.x, a1.y - b1.y);
  const { min, max } = scaleLimits(photo, box);
  const scale = clamp(start.scale * (before > 0 ? after / before : 1), min, max);
  const k = scale / start.scale;
  const from = mid(a0, b0);
  const to = mid(a1, b1);
  return clampView({ scale, dx: to.x - (from.x - start.dx) * k, dy: to.y - (from.y - start.dy) * k }, photo, box);
}

/** True when the whole photo is in view (no zoom to keep on a resize). */
export const isFitted = (view: Fit, photo: Size, box: Size): boolean =>
  view.scale <= scaleLimits(photo, box).min * 1.001;

const round = (v: number): string => String(Number(v.toPrecision(2)));

/** The zoom in words, with what a tap is taken to be worth at it. */
export function zoomWords(view: Fit, tapSigmaScreenPx: number): string {
  const size =
    view.scale >= 1
      ? `1 photo pixel is ${round(view.scale)} screen pixels`
      : `1 screen pixel is ${round(1 / view.scale)} photo pixels`;
  return `Zoom: ${size}. A tap here counts as about ${round(tapSigmaScreenPx / view.scale)} photo pixels off.`;
}
