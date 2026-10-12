// Fingers and the mouse on the photo. Each call takes a plain description of
// one pointer event in canvas pixels and changes the state or the view, so
// the tests can replay a tap, a drag or a pinch without a browser.
import type { Pt } from "../measure/homography";
import { TAP_SIGMA_SCREEN_PX } from "../measure/monte-carlo";
import { toImage, type Fit } from "../ui/view";
import { pressOn, TAP_TRAVEL } from "./press";
import { closeRoom, handles, moveHandle, place, undo, type Handle, type State } from "./state";
import { panBy, pinchView, type Size } from "./zoom";

/** One pointer event: which pointer, where on the canvas (CSS px), what kind. */
export type Tap = { id: number; x: number; y: number; type: string };
export type Host = {
  state: State;
  /** The photo's size in its own pixels, or null before one is loaded. */
  photo: () => Size | null;
  /** The canvas's size on screen, CSS px. */
  box: () => Size;
  view: () => Fit;
  setView: (view: Fit) => void;
  /** True when one finger slides the photo instead of placing a point. */
  panning: () => boolean;
};
/** What a call changed, so the page knows what to redraw. */
export type Change = "none" | "points" | "view";

type Drag = {
  id: number;
  /** Null when this press slides the photo. */
  handle: Handle | null;
  from: Tap;
  last: Tap;
  /** The press picked up a point that was already there. */
  grabbed: boolean;
  moving: boolean;
  /** From the press to the point, photo px, so a picked-up point does not jump. */
  offset: Pt;
  /** Where a picked-up point was, to put it back if a second finger arrives. */
  before: Pt | null;
};
type Pinch = { a: Tap; b: Tap; a0: Tap; b0: Tap; start: Fit };

export function createPointer(host: Host) {
  let drag: Drag | null = null;
  let pinch: Pinch | null = null;

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

  /** A second finger arrived: the first press was the start of a pinch, not
   * a tap, so take back whatever it did. */
  function startPinch(first: Drag, e: Tap): Change {
    if (first.handle && !first.grabbed) undo(host.state);
    else if (first.handle && first.before) moveHandle(host.state, first.handle, first.before);
    pinch = { a: first.last, b: e, a0: first.last, b0: e, start: host.view() };
    drag = null;
    return "points";
  }

  function down(e: Tap): Change {
    const size = host.photo();
    if (!size || pinch) return "none";
    if (drag) return drag.id === e.id || e.type === "mouse" ? "none" : startPinch(drag, e);
    const idle = { id: e.id, from: e, last: e, offset: { x: 0, y: 0 }, before: null };
    if (host.panning()) {
      drag = { ...idle, handle: null, grabbed: false, moving: true };
      return "view";
    }
    const at = photoPoint(e);
    const press = pressOn(host.state, at, host.view().scale, e.type);
    if (press.kind === "grab") {
      const before = where(press.handle) as Pt;
      drag = {
        ...idle, handle: press.handle, grabbed: true, moving: false,
        offset: { x: before.x - at.x, y: before.y - at.y }, before: { ...before },
      };
      return "points";
    }
    const handle = place(host.state, at);
    if (!handle) return "none";
    drag = { ...idle, handle, grabbed: false, moving: true };
    return "points";
  }

  function move(e: Tap): Change {
    if (pinch) {
      if (e.id === pinch.a.id) pinch.a = e;
      else if (e.id === pinch.b.id) pinch.b = e;
      else return "none";
      host.setView(pinchView(pinch.start, pinch.a0, pinch.b0, pinch.a, pinch.b, host.photo() as Size, host.box()));
      return "view";
    }
    if (!drag || e.id !== drag.id) return "none";
    const last = drag.last;
    drag.last = e;
    if (!drag.handle) {
      host.setView(panBy(host.view(), e.x - last.x, e.y - last.y, host.photo() as Size, host.box()));
      return "view";
    }
    if (!drag.moving && Math.hypot(e.x - drag.from.x, e.y - drag.from.y) < TAP_TRAVEL) return "none";
    drag.moving = true;
    moveHandle(host.state, drag.handle, photoPoint(e, drag.offset));
    return "points";
  }

  function up(e: Tap): Change {
    if (pinch) {
      if (e.id !== pinch.a.id && e.id !== pinch.b.id) return "none";
      pinch = null; // the finger still down does nothing until it lifts
      return "view";
    }
    if (!drag || e.id !== drag.id) return "none";
    const { handle, grabbed, moving } = drag;
    drag = null;
    // A tap on the first corner of an open outline closes it.
    if (grabbed && !moving && handle?.group === "room" && handle.index === 0 && host.state.tool === "room")
      closeRoom(host.state);
    return handle ? "points" : "view";
  }

  return {
    down, move, up,
    /** The browser took the press away: stop where it is. */
    cancel: up,
    /** The point under the finger right now, for the loupe. */
    held: (): Pt | null => (drag?.handle ? where(drag.handle) : null),
    /** True while a finger or the mouse button is down on the photo. */
    busy: (): boolean => !!drag || !!pinch,
  };
}
