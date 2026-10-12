// Browser pointer events on the photo, handed to the pointer rules as plain
// numbers, and the loupe that shows the spot under the finger.
import type { createPointer, Tap } from "../app/pointer";
import { drawLoupe, type Photo } from "./draw";
import type { Fit } from "./view";

type Pointer = ReturnType<typeof createPointer>;
export type PointerHost = { photo: () => Photo | null; view: () => Fit; render: () => void };

export function wirePointer(canvas: HTMLCanvasElement, loupe: HTMLCanvasElement, pointer: Pointer, host: PointerHost): void {
  /** A pointer event as the pointer rules want it: canvas pixels, no browser types. */
  const tap = (e: PointerEvent): Tap => {
    const r = canvas.getBoundingClientRect();
    return { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top, type: e.pointerType };
  };
  const showLoupe = (at: Tap): void => {
    const held = pointer.held();
    const photo = host.photo();
    loupe.hidden = !held;
    if (!held || !photo) return;
    // Keep the loupe out from under the finger.
    loupe.classList.toggle("right", at.x < 170 && at.y < 170);
    const ctx = loupe.getContext("2d");
    if (ctx) drawLoupe(ctx, photo.source, held, host.view(), loupe.width);
  };
  const after = (e: PointerEvent): void => {
    showLoupe(tap(e));
    host.render();
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (pointer.down(tap(e)) === "none") return;
    try {
      // Keep receiving moves if the finger slides off the photo.
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture for some pointers. Placing still works.
    }
    after(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (pointer.move(tap(e)) !== "none") after(e);
  });
  for (const [name, end] of [["pointerup", pointer.up], ["pointercancel", pointer.cancel]] as const)
    canvas.addEventListener(name, (e) => {
      end(tap(e));
      after(e); // the finger is up: this redraw also books the error bars
    });
}
