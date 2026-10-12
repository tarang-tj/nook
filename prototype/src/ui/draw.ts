// Drawing the photo, the points and the zoomed loupe on the canvas.
import type { EdgeLabel } from "../app/sheet-edges";
import { shown, thingAt, type Group, type State } from "../app/state";
import type { Pt } from "../measure/homography";
import { orderCorners } from "../measure/sheet";
import { toScreen, type Fit } from "./view";

/** The picture being measured: a loaded photo or the made-up sample floor. */
export type Photo = { source: CanvasImageSource; w: number; h: number };
export type Box = { w: number; h: number; dpr: number };
type Ctx = CanvasRenderingContext2D;

/** One colour and one label prefix per group. The label carries the meaning,
 * not the colour alone. */
const STYLE: Record<Group, { colour: string; label: (i: number) => string }> = {
  sheet: { colour: "#ffb000", label: (i) => String(i + 1) },
  second: { colour: "#ff7ad9", label: (i) => `S${i + 1}` },
  span: { colour: "#ff7ad9", label: (i) => `K${i + 1}` },
  ends: { colour: "#35d0ff", label: (i) => "AB"[i] },
  room: { colour: "#7dff8a", label: (i) => String(i + 1) },
  gap: { colour: "#35d0ff", label: (i) => `G${i + 1}` },
};
const THING = "#ffffff";

function path(ctx: Ctx, pts: Pt[], close: boolean, colour: string, dash: number[] = []) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();
  ctx.setLineDash(dash);
  ctx.lineWidth = 2;
  ctx.strokeStyle = colour;
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A ring with a clear centre, so the exact spot stays visible. `room` is the
 * distance to the nearest other point: crowded rings are drawn smaller and
 * without a label box, so they do not hide a small sheet. */
function ring(ctx: Ctx, s: Pt, colour: string, label: string, room: number) {
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
  const width = Math.max(18, ctx.measureText(label).width + 8);
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(s.x + 12, s.y - 22, width, 18);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, s.x + 12 + width / 2, s.y - 12);
}

/** Write each edge's assumed length beside it, outside the sheet. */
function edgeLabels(ctx: Ctx, view: Fit, edges: EdgeLabel[], colour: string) {
  if (edges.length < 4) return;
  const on = edges.map((e) => ({ a: toScreen(view, e.a), b: toScreen(view, e.b), text: e.text }));
  const cx = on.reduce((t, e) => t + e.a.x + e.b.x, 0) / 8;
  const cy = on.reduce((t, e) => t + e.a.y + e.b.y, 0) / 8;
  // One of each pair is enough: the edge nearest the bottom and the one nearest the right.
  for (const e of [on[2], on[1]]) {
    const m = { x: (e.a.x + e.b.x) / 2, y: (e.a.y + e.b.y) / 2 };
    const away = Math.hypot(m.x - cx, m.y - cy) || 1;
    const width = ctx.measureText(e.text).width + 8;
    const x = m.x + ((m.x - cx) / away) * (width / 2 + 8);
    const y = m.y + ((m.y - cy) / away) * 18;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(x - width / 2, y - 9, width, 18);
    ctx.fillStyle = colour;
    ctx.fillText(e.text, x, y);
  }
}

export type Picture = {
  photo: Photo;
  view: Fit;
  box: Box;
  state: State;
  /** The assumed length of each edge of the first and the second sheet. */
  edges: EdgeLabel[];
  edges2: EdgeLabel[];
  /** The thing's footprint in photo pixels, when there is one to draw. */
  foot: Pt[] | null;
};

/** Draw the photo and everything tapped on it for the chosen tool. */
export function draw(ctx: Ctx, pic: Picture): void {
  const { photo, view, box, state } = pic;
  const on = (p: Pt): Pt => toScreen(view, p);
  ctx.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
  ctx.clearRect(0, 0, box.w, box.h);
  const corner = on({ x: 0, y: 0 });
  ctx.drawImage(photo.source, corner.x, corner.y, photo.w * view.scale, photo.h * view.scale);

  const groups = shown(state);
  const pts = state.points;
  for (const g of ["sheet", "second"] as const)
    if (pts[g].length === 4) path(ctx, orderCorners(pts[g]).map(on), true, STYLE[g].colour);
  if (pts.span.length === 2) path(ctx, pts.span.map(on), false, STYLE.span.colour, [2, 4]);
  if (groups.includes("ends") && pts.ends.length === 2) path(ctx, pts.ends.map(on), false, STYLE.ends.colour);
  if (groups.includes("room")) path(ctx, pts.room.map(on), state.closed, STYLE.room.colour);
  if (groups.includes("gap") && pts.gap.length === 2) path(ctx, pts.gap.map(on), false, STYLE.gap.colour, [6, 4]);
  if (pic.foot) path(ctx, pic.foot.map(on), true, THING, [8, 5]);

  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const handles = groups.flatMap((g) => pts[g].map((p, i) => ({ at: on(p), colour: STYLE[g].colour, label: STYLE[g].label(i) })));
  const thing = thingAt(state);
  if (thing) handles.push({ at: on(thing), colour: THING, label: "move" });
  handles.forEach((h, i) => {
    let room = Infinity;
    handles.forEach((o, j) => {
      if (j !== i) room = Math.min(room, Math.hypot(o.at.x - h.at.x, o.at.y - h.at.y));
    });
    ring(ctx, h.at, h.colour, h.label, room);
  });
  edgeLabels(ctx, view, pic.edges, STYLE.sheet.colour);
  edgeLabels(ctx, view, pic.edges2, STYLE.second.colour);
  ctx.textAlign = "start";
}

/** A cross in the middle of the photo box: where Enter places a point when
 * the photo is being driven from the keyboard. */
export function drawCross(ctx: Ctx, box: Box): void {
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
export function drawLoupe(ctx: Ctx, img: CanvasImageSource, p: Pt, fit: Fit, sizePx: number, zoom = 3): void {
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
