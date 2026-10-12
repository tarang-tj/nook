// A stand-in for the page, for the tests: the made-up photo from scene.ts
// shown in a box, with taps replayed through the same pointer rules the
// real page uses. No browser.
import { createPointer, type Host } from "../src/app/pointer";
import { newState, type State, type Tool } from "../src/app/state";
import type { Pt } from "../src/measure/homography";
import { fitContain, toScreen, type Fit } from "../src/ui/view";

export const PHOTO = { w: 3000, h: 4000 };
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
