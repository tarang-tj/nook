// The page: load a photo, pass taps to the pointer rules, show the words.
// The maths lives in ./measure, the rules in ./app, the screen in ./ui.
import { csvOf, planOf } from "./app/exports";
import { createLater } from "./app/later";
import { barsOf, sceneOf, solve, type Bars } from "./app/numbers";
import { forNewPicture, paperPicked, startPicture, withoutExtra, type Aside } from "./app/picture-settings";
import { createPointer } from "./app/pointer";
import { report, type Report } from "./app/report";
import { placeSampleTaps, SAMPLE_EXTRAS } from "./app/sample-taps";
import { sheetEdges } from "./app/sheet-edges";
import { canUndo, closeRoom, hasTaps, newState, removeExtra, reset, undo, type Tool } from "./app/state";
import { clampView, isFitted, zoomWords } from "./app/zoom";
import { floorToPhoto } from "./measure/inverse";
import { TAP_SIGMA_SCREEN_PX } from "./measure/monte-carlo";
import type { Plan } from "./measure/plan";
import { referenceById } from "./measure/references";
import { isMoving, wireTabs, wireView } from "./ui/controls";
import { download, el } from "./ui/dom";
import { draw, drawCross, type Box, type Photo } from "./ui/draw";
import { showPanel } from "./ui/panel";
import { wirePhotoInputs } from "./ui/photo-input";
import { wirePointer } from "./ui/pointer-events";
import { readSettings, SETTING_IDS, writePictureSettings } from "./ui/settings";
import { fitContain, type Fit } from "./ui/view";

const stage = el("stage");
const canvas = el<HTMLCanvasElement>("photo");
const loupe = el<HTMLCanvasElement>("loupe");

const state = newState();
let photo: Photo | null = null;
/** The made-up sample floor is showing, not a photo. */
let sample = false;
/** A message that stays up until a photo loads: a file that would not open. */
let notice = "";
let view: Fit = { scale: 1, dx: 0, dy: 0 };
let box: Box = { w: 1, h: 1, dpr: 1 };
/** What is on screen now, for the save buttons. */
let shown: { words: Report; plan: Plan | null } | null = null;

const later = createLater<Bars>(() => render());
const pointer = createPointer({
  state,
  photo: () => photo,
  box: () => box,
  view: () => view,
  setView: (next) => { view = next; },
  panning: isMoving,
});

function layout(): void {
  const r = stage.getBoundingClientRect();
  // Keep a zoom the person chose; refit only when the whole photo was in view.
  const fitted = !photo || isFitted(view, photo, box);
  box = { w: Math.max(1, r.width), h: Math.max(1, r.height), dpr: window.devicePixelRatio || 1 };
  canvas.width = Math.round(box.w * box.dpr);
  canvas.height = Math.round(box.h * box.dpr);
  if (photo) view = fitted ? fitContain(photo.w, photo.h, box.w, box.h) : clampView(view, photo, box);
  render();
}

function render(): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const set = readSettings();
  const scene = photo ? sceneOf(state, set) : null;
  const solved = scene ? solve(scene) : null;
  // The bars are slow, so they come later: null here means "working".
  let bars: Bars | null = null;
  if (scene && solved?.ok && Object.keys(solved.values).length > 0) {
    bars = later.want(JSON.stringify(scene), () => barsOf(scene, solved));
    if (!pointer.busy()) later.hurry(); // no finger down: no need to wait for a pause
  } else later.drop();
  const words = report(state, { hasPhoto: !!photo, notice, sample }, set, solved, bars);

  if (!photo) ctx.clearRect(0, 0, canvas.width, canvas.height);
  else {
    const { sheet, second } = state.points;
    draw(ctx, {
      photo, view, box, state,
      edges: sheetEdges(sheet, referenceById(set.paper), set.swap, set.unit) ?? [],
      edges2: sheetEdges(second, referenceById(set.paper2), set.swap2, set.unit) ?? [],
      foot: solved?.ok && solved.floor.foot ? floorToPhoto(solved.h, solved.floor.foot) : null,
    });
    if (canvas.matches(":focus-visible")) drawCross(ctx, box);
  }
  // The view as numbers, for anyone driving the page from a script.
  canvas.dataset.view = [view.scale, view.dx, view.dy].join(",");

  const plan = state.tool === "room" && state.closed ? planOf(solved, words.rows, set, sample) : null;
  shown = { words, plan };
  el<HTMLButtonElement>("undo").disabled = !canUndo(state);
  el<HTMLButtonElement>("reset").disabled = !hasTaps(state);
  el<HTMLButtonElement>("save-csv").disabled = words.rows.length === 0;
  showPanel(words, {
    state, hasPhoto: !!photo, sample, plan, unit: set.unit,
    zoom: photo ? zoomWords(view, TAP_SIGMA_SCREEN_PX) : "",
  });
}

wirePointer(canvas, loupe, pointer, { photo: () => photo, view: () => view, render });
for (const name of ["focus", "blur"]) canvas.addEventListener(name, render);

wireView({
  canvas,
  photo: () => photo,
  box: () => box,
  view: () => view,
  look: (next) => { view = next; render(); },
  tapAt: (at) => {
    const press = { id: -1, x: at.x, y: at.y, type: "mouse" };
    pointer.down(press);
    pointer.up(press);
    render();
  },
});
wireTabs((tool) => {
  state.tool = tool as Tool;
  render();
});

/** Run a change to the taps, then redraw. */
const act = (id: string, change: () => void) =>
  el(id).addEventListener("click", () => {
    change();
    render();
  });
act("undo", () => undo(state));
/** The person's own first paper while the made-up floor shows its own. */
let aside: Aside = null;
/** The papers, swap boxes and known length belong to one picture: start each one clean. */
const freshSettings = () => {
  const next = startPicture(readSettings(), sample, aside);
  aside = next.aside;
  writePictureSettings(next.set);
  paperNote(next.back);
};
/** The line under Paper, shown only while it has something to say. */
const paperNote = (words: string) => {
  el("paper-note").textContent = words;
  el("paper-note").hidden = !words;
};
const paperBox = el<HTMLSelectElement>("paper");
paperBox.addEventListener("change", () => {
  aside = paperPicked(aside, paperBox.value);
  paperNote("");
});
act("reset", () => {
  reset(state);
  freshSettings();
});
act("close", () => closeRoom(state));
act("turn-left", () => { state.turn = (state.turn + 165) % 180; });
act("turn-right", () => { state.turn = (state.turn + 15) % 180; });
act("sample-taps", () => {
  const before = { sheet: state.points.sheet.length, second: state.points.second.length, span: state.points.span.length };
  placeSampleTaps(state);
  // Taps placed for the person sit on the made-up floor's own sheets and
  // stick, so those get the floor's own paper sizes and length with them.
  const now = readSettings();
  const own = forNewPicture(now, true);
  if (state.points.sheet.length === 4 && before.sheet < 4) Object.assign(now, { paper: own.paper, swap: own.swap });
  if (state.points.second.length === 4 && before.second < 4) Object.assign(now, { paper2: own.paper2, swap2: own.swap2 });
  if (state.points.span.length === 2 && before.span < 2) now.spanMm = SAMPLE_EXTRAS.spanMm;
  writePictureSettings(now);
});
act("add-second", () => { state.adding = "second"; });
act("add-span", () => { state.adding = "span"; });
for (const extra of ["second", "span"] as const)
  act(`remove-${extra}`, () => {
    removeExtra(state, extra);
    writePictureSettings(withoutExtra(readSettings(), extra, sample));
  });
for (const id of SETTING_IDS)
  for (const name of ["change", "input"]) el(id).addEventListener(name, render);

el("save-svg").addEventListener("click", () => {
  if (shown?.plan?.ok) download("nook-draft-plan.svg", shown.plan.svg, "image/svg+xml");
});
el("save-csv").addEventListener("click", () => {
  if (shown?.words.rows.length) download("nook-draft-walls.csv", csvOf(shown.words.rows, sample), "text/csv");
});

/** Show a new picture, whole, with no taps on it. */
function usePhoto(next: Photo, madeUp: boolean): void {
  photo = next;
  sample = madeUp;
  notice = "";
  reset(state);
  freshSettings();
  el("empty").hidden = true;
  view = fitContain(next.w, next.h, box.w, box.h);
  layout();
}

wirePhotoInputs(usePhoto, (why) => {
  notice = why;
  render();
});

new ResizeObserver(layout).observe(stage);
layout();
