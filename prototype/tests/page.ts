// A stand-in for the page, for the tests: the made-up photo from scene.ts
// shown in a box, with taps replayed through the same pointer rules the
// real page uses. No browser.
import { createPointer, type Host } from "../src/app/pointer";
import { barsOf, sceneOf, solve, type Settings } from "../src/app/numbers";
import { report, type Page } from "../src/app/report";
import { newState, type State, type Tool } from "../src/app/state";
import type { Pt } from "../src/measure/homography";
import { fitContain, toScreen, type Fit } from "../src/ui/view";

export const PHOTO = { w: 3000, h: 4000 };

export const SETTINGS: Settings = {
  paper: "letter", swap: false, unit: "cm", paper2: "a4", swap2: false, spanMm: NaN, thingWidthMm: 800, thingDepthMm: 600,
};

/** Everything the page would say for these taps, with the error bars worked
 * out on the spot (the real page works them out a moment later). */
export function tell(state: State, page: Partial<Page> = {}, settings: Partial<Settings> = {}) {
  const set = { ...SETTINGS, ...settings };
  const at = { hasPhoto: true, notice: "", ...page };
  const scene = at.hasPhoto ? sceneOf(state, set) : null;
  const solved = scene ? solve(scene) : null;
  const bars = scene && solved?.ok ? barsOf(scene, solved) : null;
  return { scene, solved, bars, words: report(state, at, set, solved, bars) };
}
/** The audit's phone: 390 wide, about 511 px of stage for the photo. */
export const PHONE_BOX = { w: 390, h: 511 };

export function fakePage(box = PHONE_BOX, tool: Tool = "distance") {
  const state: State = newState(tool);
  let view: Fit = fitContain(PHOTO.w, PHOTO.h, box.w, box.h);
  let panning = false;
  const host: Host = {
    state, photo: () => PHOTO, box: () => box, view: () => view,
    setView: (next) => { view = next; }, panning: () => panning,
  };
  const pointer = createPointer(host);
  let id = 0;
  /** Where a photo pixel is on the canvas right now. */
  const screen = (p: Pt): Pt => toScreen(view, p);
  return {
    state, pointer, screen,
    view: () => view,
    setView: (next: Fit) => { view = next; },
    setPanning: (on: boolean) => { panning = on; },
    /** Press and lift on one spot (canvas px), as a plain tap does. */
    tap(at: Pt, type = "touch") {
      id++;
      pointer.down({ id, x: at.x, y: at.y, type });
      pointer.up({ id, x: at.x, y: at.y, type });
    },
    /** A plain tap on a photo pixel. */
    tapPhoto(p: Pt, type = "touch") { this.tap(screen(p), type); },
    /** Press, slide in steps, lift (canvas px). */
    drag(from: Pt, to: Pt, type = "touch", steps = 4) {
      id++;
      pointer.down({ id, x: from.x, y: from.y, type });
      for (let i = 1; i <= steps; i++)
        pointer.move({ id, x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, type });
      pointer.up({ id, x: to.x, y: to.y, type });
    },
  };
}
