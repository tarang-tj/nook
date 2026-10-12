// Fingers and the mouse on the photo. Each call takes a plain description of
// one pointer event in canvas pixels and changes the state, so the tests can
// replay a tap or a drag without a browser.
import type { Pt } from "../measure/homography";
import { TAP_SIGMA_SCREEN_PX } from "../measure/monte-carlo";
import { toImage, type Fit } from "../ui/view";
import { pressOn, TAP_TRAVEL } from "./press";
import { closeRoom, handles, moveHandle, place, type Handle, type State } from "./state";

/** One pointer event: which pointer, where on the canvas (CSS px), what kind. */
export type Tap = { id: number; x: number; y: number; type: string };
export type Size = { w: number; h: number };
export type Host = {
  state: State;
  /** The photo's size in its own pixels, or null before one is loaded. */
  photo: () => Size | null;
  view: () => Fit;
};
/** What a call changed, so the page knows what to redraw. */
export type Change = "none" | "points";

type Drag = {
  id: number;
  handle: Handle;
  from: Tap;
  /** The press picked up a point that was already there. */
  grabbed: boolean;
  moving: boolean;
  /** From the press to the point, photo px, so a picked-up point does not jump. */
  offset: Pt;
};

export function createPointer(host: Host) {
  let drag: Drag | null = null;

  /** A canvas position as a photo pixel, kept inside the photo. */
  const photoPoint = (e: Tap, offset: Pt = { x: 0, y: 0 }): Pt => {
    const size = host.photo() as Size;
    const view = host.view();
    const p = toImage(view, e.x, e.y);
    return {
      x: Math.min(size.w, Math.max(0, p.x + offset.x)),
      y: Math.min(size.h, Math.max(0, p.y + offset.y)),
      // Tap uncertainty in photo pixels, fixed at the zoom the point was placed at.
      s: TAP_SIGMA_SCREEN_PX / view.scale,
    };
  };
  const where = (h: Handle): Pt | null =>
    handles(host.state).find((k) => k.handle.group === h.group && k.handle.index === h.index)?.at ?? null;

  function down(e: Tap): Change {
    if (!host.photo() || drag) return "none";
    const at = photoPoint(e);
    const press = pressOn(host.state, at, host.view().scale, e.type);
    if (press.kind === "grab") {
      const before = where(press.handle) as Pt;
      drag = {
        id: e.id, handle: press.handle, from: e, grabbed: true, moving: false,
        offset: { x: before.x - at.x, y: before.y - at.y },
      };
      return "points";
    }
    const handle = place(host.state, at);
    if (!handle) return "none";
    drag = { id: e.id, handle, from: e, grabbed: false, moving: true, offset: { x: 0, y: 0 } };
    return "points";
  }

  function move(e: Tap): Change {
    if (!drag || e.id !== drag.id) return "none";
    if (!drag.moving && Math.hypot(e.x - drag.from.x, e.y - drag.from.y) < TAP_TRAVEL) return "none";
    drag.moving = true;
    moveHandle(host.state, drag.handle, photoPoint(e, drag.offset));
    return "points";
  }

  function up(e: Tap): Change {
    if (!drag || e.id !== drag.id) return "none";
    const { handle, grabbed, moving } = drag;
    drag = null;
    // A tap on the first corner of an open outline closes it.
    if (grabbed && !moving && handle.group === "room" && handle.index === 0 && host.state.tool === "room")
      closeRoom(host.state);
    return "points";
  }

  /** The browser took the press away: stop where it is. */
  const cancel = (e: Tap): Change => up(e);

  return {
    down, move, up, cancel,
    /** The point under the finger right now, for the loupe. */
    held: (): Pt | null => (drag ? where(drag.handle) : null),
  };
}
