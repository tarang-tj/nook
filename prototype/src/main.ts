// The page: load a photo, pass taps to the pointer rules, show the words.
// The maths lives in ./measure, the rules in ./app, drawing in ./ui.
import { createPointer, type Tap } from "./app/pointer";
import { report } from "./app/report";
import { hasTaps, newState, reset, undo } from "./app/state";
import { clampView, isFitted, panBy, zoomAt, zoomWords, ZOOM_STEP } from "./app/zoom";
import { TAP_SIGMA_SCREEN_PX } from "./measure/monte-carlo";
import { orderCorners } from "./measure/sheet";
import { isUnit } from "./measure/units";
import { draw, drawCross, drawLoupe, type Box, type Photo } from "./ui/draw";
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
const moveButton = el<HTMLButtonElement>("move");
const zoomText = el<HTMLElement>("zoom-text");

const state = newState();
let photo: Photo | null = null;
let fit: Fit = { scale: 1, dx: 0, dy: 0 };
let box: Box = { w: 1, h: 1, dpr: 1 };
const pointer = createPointer({
  state,
  photo: () => photo,
  box: () => box,
  view: () => fit,
  setView: (next) => { fit = next; },
  panning: () => moveButton.getAttribute("aria-pressed") === "true",
});

function layout(): void {
  const r = stage.getBoundingClientRect();
  // Keep a zoom the person chose; refit only when the whole photo was in view.
  const fitted = !photo || isFitted(fit, photo, box);
  box = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr: window.devicePixelRatio || 1 };
  canvas.width = Math.round(box.w * box.dpr);
  canvas.height = Math.round(box.h * box.dpr);
  if (photo) fit = fitted ? fitContain(photo.w, photo.h, box.w, box.h) : clampView(fit, photo, box);
  render();
}

function render(): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { sheet, ends } = state.points;
  if (!photo) ctx.clearRect(0, 0, canvas.width, canvas.height);
  else {
    draw(ctx, photo, fit, sheet, ends, sheet.length === 4 ? orderCorners(sheet) : null, box);
    if (canvas.matches(":focus-visible")) drawCross(ctx, box);
  }

  undoButton.disabled = resetButton.disabled = !hasTaps(state);
  zoomText.textContent = photo ? zoomWords(fit, TAP_SIGMA_SCREEN_PX) : "";
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

/** Change the zoom or slide the photo, then redraw. */
function look(change: (photo: Photo) => Fit): void {
  if (!photo) return;
  fit = change(photo);
  render();
}
const centre = () => ({ x: box.w / 2, y: box.h / 2 });
el("zoom-in").addEventListener("click", () => look((p) => zoomAt(fit, ZOOM_STEP, centre(), p, box)));
el("zoom-out").addEventListener("click", () => look((p) => zoomAt(fit, 1 / ZOOM_STEP, centre(), p, box)));
el("zoom-fit").addEventListener("click", () => look((p) => fitContain(p.w, p.h, box.w, box.h)));
moveButton.addEventListener("click", () => {
  const on = moveButton.getAttribute("aria-pressed") !== "true";
  moveButton.setAttribute("aria-pressed", String(on));
  canvas.classList.toggle("moving", on);
});
canvas.addEventListener(
  "wheel",
  (e) => {
    if (!photo) return;
    e.preventDefault(); // zoom the photo, not the page
    const r = canvas.getBoundingClientRect();
    // A trackpad pinch arrives as a wheel with ctrl held, in smaller steps.
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    look((p) => zoomAt(fit, factor, { x: e.clientX - r.left, y: e.clientY - r.top }, p, box));
  },
  { passive: false },
);
/** With the photo focused: plus and minus zoom, 0 fits, the arrows slide,
 * and Enter places a point at the cross in the middle. */
canvas.addEventListener("keydown", (e) => {
  const slide: Record<string, [number, number]> = {
    ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40],
  };
  if (e.key === "+" || e.key === "=") look((p) => zoomAt(fit, ZOOM_STEP, centre(), p, box));
  else if (e.key === "-") look((p) => zoomAt(fit, 1 / ZOOM_STEP, centre(), p, box));
  else if (e.key === "0") look((p) => fitContain(p.w, p.h, box.w, box.h));
  else if (slide[e.key]) look((p) => panBy(fit, slide[e.key][0], slide[e.key][1], p, box));
  else if (e.key === "Enter" || e.key === " ") {
    const at = { id: -1, ...centre(), type: "mouse" };
    pointer.down(at);
    pointer.up(at);
    render();
  } else return;
  e.preventDefault();
});
for (const name of ["focus", "blur"]) canvas.addEventListener(name, render);

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
