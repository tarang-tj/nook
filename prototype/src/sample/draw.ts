// Draws the made-up floor into a canvas the page then treats as a photo.
// No image file: every line is worked out from floor positions through
// projectFloor, so the picture and the true values cannot drift apart.
import type { Pt } from "../measure/homography";
import { projectFloor, SAMPLE_FLOOR, SAMPLE_SIZE } from "./floor";

type Ctx = CanvasRenderingContext2D;

const PLANK = 120; // plank width, mm
const NEAR = -1000; // the floor is drawn from here (behind the bottom of the photo)
const FAR = 26000; // to here, mm

function poly(ctx: Ctx, floor: Pt[]): void {
  ctx.beginPath();
  floor.map(projectFloor).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function line(ctx: Ctx, a: Pt, b: Pt, colour: string, width: number): void {
  const p = projectFloor(a);
  const q = projectFloor(b);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(q.x, q.y);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** A cross painted on the floor at `at`, with arms `arm` mm long. */
function cross(ctx: Ctx, at: Pt, colour: string, arm = 45): void {
  line(ctx, { x: at.x - arm, y: at.y }, { x: at.x + arm, y: at.y }, colour, 7);
  line(ctx, { x: at.x, y: at.y - arm }, { x: at.x, y: at.y + arm }, colour, 7);
}

function label(ctx: Ctx, at: Pt, text: string, dx = 30, dy = -30): void {
  const p = projectFloor(at);
  ctx.font = "600 44px system-ui, sans-serif";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.strokeText(text, p.x + dx, p.y + dy);
  ctx.fillStyle = "#14161a";
  ctx.fillText(text, p.x + dx, p.y + dy);
}

function planks(ctx: Ctx): void {
  ctx.fillStyle = "#a47a55";
  ctx.fillRect(0, 0, SAMPLE_SIZE.w, SAMPLE_SIZE.h);
  for (let k = -90; k < 90; k++) {
    const x = k * PLANK;
    // A slightly different brown per plank, from a fixed pattern.
    const shade = ((k * 37) % 23 + 23) % 23;
    ctx.fillStyle = `rgb(${150 + shade}, ${110 + shade * 0.8}, ${76 + shade * 0.5})`;
    poly(ctx, [{ x, y: NEAR }, { x: x + PLANK, y: NEAR }, { x: x + PLANK, y: FAR }, { x, y: FAR }]);
    ctx.fill();
    line(ctx, { x, y: NEAR }, { x, y: FAR }, "rgba(60,40,25,0.55)", 3);
    // End joints, staggered from plank to plank, only where they can be seen.
    if (Math.abs(x) > 4000) continue;
    for (let y = NEAR + (k & 1) * 450; y < 7000; y += 900)
      line(ctx, { x, y }, { x: x + PLANK, y }, "rgba(60,40,25,0.55)", 3);
  }
  // The far floor fades, as it does in a real photo.
  const fade = ctx.createLinearGradient(0, 0, 0, SAMPLE_SIZE.h * 0.45);
  fade.addColorStop(0, "rgba(200,205,210,0.75)");
  fade.addColorStop(1, "rgba(200,205,210,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, SAMPLE_SIZE.w, SAMPLE_SIZE.h);
}

/** The made-up floor as a picture, the size of a phone photo. */
export function drawSampleFloor(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE.w;
  canvas.height = SAMPLE_SIZE.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  planks(ctx);
  const f = SAMPLE_FLOOR;

  // Darken the floor outside the painted outline, then paint the outline.
  ctx.beginPath();
  ctx.rect(0, 0, SAMPLE_SIZE.w, SAMPLE_SIZE.h);
  f.room.map(projectFloor).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill("evenodd");
  poly(ctx, f.room);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#f4f1e8";
  ctx.lineWidth = 9;
  ctx.stroke();

  for (const sheet of [f.sheet, f.second]) {
    poly(ctx, sheet);
    ctx.fillStyle = "#f7f7f2";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  line(ctx, f.span[0], f.span[1], "#5a1f1f", 16);
  line(ctx, f.span[0], f.span[1], "#d8c36a", 6);
  f.ends.forEach((p) => cross(ctx, p, "#143cdc"));
  f.gap.forEach((p) => cross(ctx, p, "#c81e1e", 35));

  label(ctx, f.sheet[3], "Letter sheet", 0, -24);
  label(ctx, f.second[3], "A4 sheet", -40, -30);
  label(ctx, f.ends[0], "A");
  label(ctx, f.ends[1], "B");
  label(ctx, f.span[1], "1 m stick", 24, 10);
  label(ctx, f.gap[1], "gap", 30, 14);

  ctx.font = "700 110px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeText("MADE-UP FLOOR, NOT A REAL PHOTO", SAMPLE_SIZE.w / 2, 260);
  ctx.fillStyle = "#14161a";
  ctx.fillText("MADE-UP FLOOR, NOT A REAL PHOTO", SAMPLE_SIZE.w / 2, 260);
  ctx.textAlign = "start";
  return canvas;
}
