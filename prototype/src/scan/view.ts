// A simple 3-D wireframe viewer for the scanned room, drawn with the 2-D
// canvas API. No WebGL, no runtime dependencies. Walls are rectangles
// extruded from the floor polygon up by the room height. Drag or touch to
// orbit. The viewer runs on the existing #scan-canvas element in the stage.
import type { Pt3, ScanRoom } from "./geometry";
import { wallLengthsM } from "./geometry";

// ─── Orbit state ────────────────────────────────────────────────────────────

export type OrbitState = {
  /** Rotation around Y axis, radians. */
  az: number;
  /** Tilt above the floor plane, radians. */
  el: number;
};

export const DEFAULT_ORBIT: OrbitState = {
  az: Math.PI / 6,   // 30° — a bit off-axis so depth is clear
  el: Math.PI / 5,   // 36° tilt down
};

// ─── Projection ─────────────────────────────────────────────────────────────

/** Project a 3-D point to canvas pixels using an orthographic camera that is
 * rotated by `az` around Y and then `el` above the floor plane.
 * `cx`, `cy` is the canvas centre; `scale` is pixels per metre. */
function project(
  p: Pt3,
  az: number,
  el: number,
  cx: number,
  cy: number,
  scale: number,
): { x: number; y: number } {
  // Rotate around Y (azimuth).
  const cosAz = Math.cos(az);
  const sinAz = Math.sin(az);
  const rx = p.x * cosAz - p.z * sinAz;
  const ry = p.y;
  const rz = p.x * sinAz + p.z * cosAz;

  // Rotate around X (elevation — tilt the camera up from horizontal).
  const cosEl = Math.cos(el);
  const sinEl = Math.sin(el);
  const fx = rx;
  const fy = ry * cosEl - rz * sinEl;
  // fz (depth) is not used in an orthographic projection.

  return { x: cx + fx * scale, y: cy - fy * scale };
}

// ─── Drawing ────────────────────────────────────────────────────────────────

const FLOOR_COLOUR   = "#7dff8a";
const CEILING_COLOUR = "#35d0ff";
const WALL_COLOUR    = "#b3b8c2";
const LABEL_COLOUR   = "#f2f3f5";
const DIM_COLOUR     = "#3a3f4a";

function poly(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  colour: string,
  fill?: string,
): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = colour;
  ctx.stroke();
}

function line(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  colour: string,
): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = colour;
  ctx.stroke();
}

function wallLabel(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  text: string,
): void {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  ctx.font = "bold 12px system-ui, -apple-system, sans-serif";
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = "rgba(20,22,26,0.8)";
  ctx.fillRect(mx - w / 2, my - 10, w, 18);
  ctx.fillStyle = LABEL_COLOUR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, mx, my);
}

function formatM(m: number): string {
  return `${m.toFixed(2)} m`;
}

/** Draw the reconstructed room on `canvas`. Does nothing when `room` is null. */
export function drawRoom(
  canvas: HTMLCanvasElement,
  room: ScanRoom,
  orbit: OrbitState,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const { corners, height } = room;
  const { az, el } = orbit;

  // Compute the bounding box of the room (XZ plus height) to choose scale.
  const xs = corners.map((p) => p.x);
  const zs = corners.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const cx3 = (minX + maxX) / 2;
  const cz3 = (minZ + maxZ) / 2;
  const cy3 = height / 2;

  // The diagonal of the bounding box in world space sets the scale.
  const worldDiag = Math.sqrt(
    (maxX - minX) ** 2 + height ** 2 + (maxZ - minZ) ** 2,
  );
  const scale = worldDiag > 0 ? (Math.min(w, h) * 0.55) / worldDiag : 80;

  const proj = (p: Pt3) =>
    project(
      { x: p.x - cx3, y: p.y - cy3, z: p.z - cz3 },
      az,
      el,
      w / 2,
      h / 2,
      scale,
    );

  // Build floor and ceiling corner arrays.
  const floor2 = corners.map(proj);
  const ceil2  = corners.map((p) => proj({ x: p.x, y: height, z: p.z }));

  // Draw wall quads (filled, dimmed) before the outlines so edges sit on top.
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    ctx.beginPath();
    ctx.moveTo(floor2[i].x, floor2[i].y);
    ctx.lineTo(floor2[j].x, floor2[j].y);
    ctx.lineTo(ceil2[j].x,  ceil2[j].y);
    ctx.lineTo(ceil2[i].x,  ceil2[i].y);
    ctx.closePath();
    ctx.fillStyle = WALL_COLOUR;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Vertical edges.
  for (let i = 0; i < corners.length; i++) {
    line(ctx, floor2[i], ceil2[i], DIM_COLOUR);
  }

  // Wall outlines (floor to floor-next and ceil to ceil-next).
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    line(ctx, floor2[i], floor2[j], DIM_COLOUR);
    line(ctx, ceil2[i],  ceil2[j],  DIM_COLOUR);
  }

  // Floor polygon (filled slightly).
  poly(ctx, floor2, FLOOR_COLOUR, "rgba(125,255,138,0.08)");

  // Ceiling polygon.
  poly(ctx, ceil2, CEILING_COLOUR, "rgba(53,208,255,0.06)");

  // Wall length labels on the floor edges.
  const walls = wallLengthsM(corners);
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    wallLabel(ctx, floor2[i], floor2[j], formatM(walls[i]));
  }

  // Height label on the first vertical edge.
  const hmid = {
    x: (floor2[0].x + ceil2[0].x) / 2,
    y: (floor2[0].y + ceil2[0].y) / 2,
  };
  wallLabel(ctx, floor2[0], { x: hmid.x + 1, y: hmid.y }, formatM(height));

  // "Sample room" watermark if this is the made-up room.
  ctx.restore();
}

// ─── Orbit wiring ───────────────────────────────────────────────────────────

/** Attach pointer/touch drag listeners to `canvas` that call `onChange` with
 * the updated orbit state after every drag step. Returns a cleanup function. */
export function wireOrbit(
  canvas: HTMLCanvasElement,
  initial: OrbitState,
  onChange: (o: OrbitState) => void,
): () => void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let state = { ...initial };

  const SENSITIVITY = 0.008; // radians per pixel

  const start = (x: number, y: number) => {
    dragging = true;
    lastX = x;
    lastY = y;
  };
  const move = (x: number, y: number) => {
    if (!dragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;
    state = {
      az: state.az - dx * SENSITIVITY,
      el: Math.max(0.05, Math.min(Math.PI / 2 - 0.05, state.el + dy * SENSITIVITY)),
    };
    onChange(state);
  };
  const end = () => { dragging = false; };

  // Mouse
  const onMouseDown = (e: MouseEvent) => { e.preventDefault(); start(e.clientX, e.clientY); };
  const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
  const onMouseUp   = () => end();

  // Touch
  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) start(t.clientX, t.clientY);
  };
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) move(t.clientX, t.clientY);
  };
  const onTouchEnd = () => end();

  canvas.addEventListener("mousedown",  onMouseDown);
  window.addEventListener("mousemove",  onMouseMove);
  window.addEventListener("mouseup",    onMouseUp);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove",  onTouchMove,  { passive: false });
  canvas.addEventListener("touchend",   onTouchEnd);

  return () => {
    canvas.removeEventListener("mousedown",  onMouseDown);
    window.removeEventListener("mousemove",  onMouseMove);
    window.removeEventListener("mouseup",    onMouseUp);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove",  onTouchMove);
    canvas.removeEventListener("touchend",   onTouchEnd);
  };
}
