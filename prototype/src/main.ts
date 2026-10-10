// The page: load a photo, collect six taps, show the distance.
// The maths lives in ./measure. Drawing lives in ./ui/view.
import type { Pt } from "./measure/homography";
import { measureFloorDistance } from "./measure/floor-distance";
import { TAP_SIGMA_SCREEN_PX } from "./measure/monte-carlo";
import { referenceById } from "./measure/references";
import { degenerateReason, orderCorners } from "./measure/sheet";
import { isUnit, type Unit } from "./measure/units";
import { draw, drawLoupe, fitContain, nearest, toImage, type Fit } from "./ui/view";

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id} in index.html`);
  return node as T;
};
const stage = el<HTMLElement>("stage");
const canvas = el<HTMLCanvasElement>("photo");
const loupe = el<HTMLCanvasElement>("loupe");
const empty = el<HTMLElement>("empty");
const step = el<HTMLElement>("step");
const result = el<HTMLOutputElement>("result");
const basis = el<HTMLElement>("basis");
const undo = el<HTMLButtonElement>("undo");
const reset = el<HTMLButtonElement>("reset");
const swap = el<HTMLInputElement>("swap");
const paper = el<HTMLSelectElement>("paper");
const unitSelect = el<HTMLSelectElement>("unit");

const MAX_POINTS = 6; // four sheet corners, then two floor points
const GRAB_RADIUS_PX = 28; // how close (screen px) a press must be to pick up a point

let img: HTMLImageElement | null = null;
let fit: Fit = { scale: 1, dx: 0, dy: 0 };
let box = { w: 1, h: 1, dpr: 1 };
let points: Pt[] = [];
/** The point being placed or moved, and the finger's offset from it. */
let held: { index: number; id: number; ox: number; oy: number } | null = null;

function layout(): void {
  const r = stage.getBoundingClientRect();
  box = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr: window.devicePixelRatio || 1 };
  canvas.width = Math.round(box.w * box.dpr);
  canvas.height = Math.round(box.h * box.dpr);
  if (img) fit = fitContain(img.naturalWidth, img.naturalHeight, box.w, box.h);
  render();
}

function render(): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (!img) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  } else {
    const ordered = points.length >= 4 ? orderCorners(points.slice(0, 4)) : null;
    draw(ctx, img, fit, points, ordered, box);
  }
  report();
}

/** The words under the photo: what to do next, and the result or the reason. */
function report(): void {
  const n = points.length;
  undo.disabled = n === 0;
  reset.disabled = n === 0;
  result.className = "";
  result.textContent = "";
  basis.textContent = "";
  if (!img) {
    step.textContent = "Step 1 of 3: take or choose a photo.";
    return;
  }
  if (n < 4) {
    step.textContent = `Step 2 of 3: tap the four corners of the sheet (${n} of 4). Drag a point to adjust it.`;
    return;
  }
  const why = degenerateReason(orderCorners(points.slice(0, 4)));
  if (n < 6) {
    step.textContent = `Step 3 of 3: tap the two spots on the floor to measure between (${n - 4} of 2).`;
    if (why) problem(`The four corners cannot be used: ${why}. Drag them or press Undo.`);
    return;
  }
  step.textContent = "Drag any point to adjust it. Start over clears the points.";
  const unit: Unit = isUnit(unitSelect.value) ? unitSelect.value : "cm";
  const outcome = measureFloorDistance({
    corners: points.slice(0, 4),
    a: points[4],
    b: points[5],
    reference: referenceById(paper.value),
    unit,
    swapSides: swap.checked,
  });
  if (!outcome.ok) return problem(outcome.reason);
  result.textContent = `A to B: ${outcome.text}`;
  basis.textContent = (outcome.warning ? `${outcome.warning} ` : "") + outcome.measured.basis;
}

function problem(text: string): void {
  result.className = "problem";
  result.textContent = `No measurement. ${text}`;
}

/** A pointer position as a photo pixel, kept inside the photo. */
function photoPoint(e: PointerEvent, ox = 0, oy = 0): Pt {
  const r = canvas.getBoundingClientRect();
  const p = toImage(fit, e.clientX - r.left, e.clientY - r.top);
  return {
    x: Math.min(img!.naturalWidth, Math.max(0, p.x + ox)),
    y: Math.min(img!.naturalHeight, Math.max(0, p.y + oy)),
    // Tap uncertainty in photo pixels, fixed at the zoom the point was placed at.
    s: TAP_SIGMA_SCREEN_PX / fit.scale,
  };
}

function showLoupe(e: PointerEvent, p: Pt): void {
  const r = canvas.getBoundingClientRect();
  // Keep the loupe out from under the finger.
  loupe.classList.toggle("right", e.clientX - r.left < 170 && e.clientY - r.top < 170);
  loupe.hidden = false;
  const ctx = loupe.getContext("2d");
  if (ctx && img) drawLoupe(ctx, img, p, fit, loupe.width);
}

canvas.addEventListener("pointerdown", (e) => {
  if (!img || held) return;
  const at = photoPoint(e);
  let index = nearest(points, at, GRAB_RADIUS_PX / fit.scale);
  let ox = 0;
  let oy = 0;
  if (index >= 0) {
    // Picking up an existing point: remember the offset so it does not jump.
    ox = points[index].x - at.x;
    oy = points[index].y - at.y;
  } else {
    if (points.length >= MAX_POINTS) return;
    points.push(at);
    index = points.length - 1;
  }
  held = { index, id: e.pointerId, ox, oy };
  canvas.setPointerCapture(e.pointerId);
  showLoupe(e, points[index]);
  render();
});

canvas.addEventListener("pointermove", (e) => {
  if (!held || e.pointerId !== held.id) return;
  points[held.index] = photoPoint(e, held.ox, held.oy);
  showLoupe(e, points[held.index]);
  render();
});

function release(e: PointerEvent): void {
  if (!held || e.pointerId !== held.id) return;
  held = null;
  loupe.hidden = true;
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

undo.addEventListener("click", () => {
  points.pop();
  render();
});
reset.addEventListener("click", () => {
  points = [];
  swap.checked = false;
  render();
});
for (const control of [swap, paper, unitSelect]) control.addEventListener("change", render);

/** Read the chosen file into an image. It never leaves the browser. */
function load(input: HTMLInputElement): void {
  const file = input.files?.[0];
  input.value = ""; // so choosing the same photo again still fires
  if (!file) return;
  const url = URL.createObjectURL(file);
  const next = new Image();
  next.onload = () => {
    URL.revokeObjectURL(url);
    img = next;
    points = [];
    empty.hidden = true;
    layout();
  };
  next.onerror = () => {
    URL.revokeObjectURL(url);
    step.textContent = "That file could not be opened as a photo. Try another one.";
  };
  next.src = url;
}
for (const id of ["take", "choose"]) {
  const input = el<HTMLInputElement>(id);
  input.addEventListener("change", () => load(input));
}

new ResizeObserver(layout).observe(stage);
layout();
