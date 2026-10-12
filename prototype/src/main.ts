// The page: load a photo, pass taps to the pointer rules, show the words.
// The maths lives in ./measure, the rules in ./app, drawing in ./ui.
import { createPointer, type Tap } from "./app/pointer";
import { report } from "./app/report";
import { hasTaps, newState, reset, undo } from "./app/state";
import { orderCorners } from "./measure/sheet";
import { isUnit } from "./measure/units";
import { draw, drawLoupe, type Box, type Photo } from "./ui/draw";
import { fitContain, type Fit } from "./ui/view";

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
const undoButton = el<HTMLButtonElement>("undo");
const resetButton = el<HTMLButtonElement>("reset");
const swap = el<HTMLInputElement>("swap");
const paper = el<HTMLSelectElement>("paper");
const unitSelect = el<HTMLSelectElement>("unit");

const state = newState();
let photo: Photo | null = null;
let fit: Fit = { scale: 1, dx: 0, dy: 0 };
let box: Box = { w: 1, h: 1, dpr: 1 };
const pointer = createPointer({ state, photo: () => photo, view: () => fit });

function layout(): void {
  const r = stage.getBoundingClientRect();
  box = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr: window.devicePixelRatio || 1 };
  canvas.width = Math.round(box.w * box.dpr);
  canvas.height = Math.round(box.h * box.dpr);
  if (photo) fit = fitContain(photo.w, photo.h, box.w, box.h);
  render();
}

function render(): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { sheet, ends } = state.points;
  if (!photo) ctx.clearRect(0, 0, canvas.width, canvas.height);
  else draw(ctx, photo, fit, sheet, ends, sheet.length === 4 ? orderCorners(sheet) : null, box);

  undoButton.disabled = resetButton.disabled = !hasTaps(state);
  const words = report(state, !!photo, {
    paper: paper.value,
    swap: swap.checked,
    unit: isUnit(unitSelect.value) ? unitSelect.value : "cm",
  });
  step.textContent = words.step;
  result.className = words.problem ? "problem" : "";
  result.textContent = words.result;
  basis.textContent = words.basis;
}

/** A pointer event as the pointer rules want it: canvas pixels, no browser types. */
function tap(e: PointerEvent): Tap {
  const r = canvas.getBoundingClientRect();
  return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, type: e.pointerType };
}

function showLoupe(at: Tap): void {
  const held = pointer.held();
  loupe.hidden = !held;
  if (!held || !photo) return;
  // Keep the loupe out from under the finger.
  loupe.classList.toggle("right", at.x < 170 && at.y < 170);
  const ctx = loupe.getContext("2d");
  if (ctx) drawLoupe(ctx, photo.source, held, fit, loupe.width);
}

canvas.addEventListener("pointerdown", (e) => {
  if (pointer.down(tap(e)) === "none") return;
  try {
    // Keep receiving moves if the finger slides off the photo.
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Some browsers refuse capture for some pointers. Placing still works.
  }
  showLoupe(tap(e));
  render();
});
canvas.addEventListener("pointermove", (e) => {
  if (pointer.move(tap(e)) === "none") return;
  showLoupe(tap(e));
  render();
});
for (const [name, end] of [["pointerup", pointer.up], ["pointercancel", pointer.cancel]] as const)
  canvas.addEventListener(name, (e) => {
    if (end(tap(e)) === "none") return;
    showLoupe(tap(e));
    render();
  });

undoButton.addEventListener("click", () => {
  undo(state);
  render();
});
resetButton.addEventListener("click", () => {
  reset(state);
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
    photo = { source: next, w: next.naturalWidth, h: next.naturalHeight };
    reset(state);
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
