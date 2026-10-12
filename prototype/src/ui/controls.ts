// Zoom and pan controls: the buttons, the wheel and the keyboard. Each one
// changes the view through the pure functions in app/zoom.
import type { Pt } from "../measure/homography";
import { panBy, zoomAt, ZOOM_STEP, type Size } from "../app/zoom";
import { el } from "./dom";
import { fitContain, type Fit } from "./view";

export type ViewHost = {
  canvas: HTMLCanvasElement;
  photo: () => Size | null;
  box: () => Size;
  view: () => Fit;
  /** Take a new view and redraw. */
  look: (view: Fit) => void;
  /** Enter on the focused photo: press and lift at this canvas position. */
  tapAt: (at: Pt) => void;
};

export function wireView(host: ViewHost): void {
  const { canvas } = host;
  const centre = (): Pt => ({ x: host.box().w / 2, y: host.box().h / 2 });
  const change = (make: (photo: Size) => Fit): void => {
    const photo = host.photo();
    if (photo) host.look(make(photo));
  };
  const zoom = (factor: number, at: Pt = centre()) => change((p) => zoomAt(host.view(), factor, at, p, host.box()));
  const fit = () => change((p) => fitContain(p.w, p.h, host.box().w, host.box().h));

  el("zoom-in").addEventListener("click", () => zoom(ZOOM_STEP));
  el("zoom-out").addEventListener("click", () => zoom(1 / ZOOM_STEP));
  el("zoom-fit").addEventListener("click", fit);
  const move = el("move");
  move.addEventListener("click", () => {
    const on = move.getAttribute("aria-pressed") !== "true";
    move.setAttribute("aria-pressed", String(on));
    canvas.classList.toggle("moving", on);
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!host.photo()) return;
      e.preventDefault(); // zoom the photo, not the page
      const r = canvas.getBoundingClientRect();
      // A trackpad pinch arrives as a wheel with ctrl held, in smaller steps.
      zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), { x: e.clientX - r.left, y: e.clientY - r.top });
    },
    { passive: false },
  );

  // With the photo focused: plus and minus zoom, 0 fits, the arrows slide,
  // and Enter places a point at the cross in the middle.
  const slide: Record<string, [number, number]> = {
    ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40],
  };
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") zoom(ZOOM_STEP);
    else if (e.key === "-") zoom(1 / ZOOM_STEP);
    else if (e.key === "0") fit();
    else if (slide[e.key]) change((p) => panBy(host.view(), slide[e.key][0], slide[e.key][1], p, host.box()));
    else if (e.key === "Enter" || e.key === " ") host.tapAt(centre());
    else return;
    e.preventDefault();
  });
}

/** True when one finger slides the photo instead of placing a point. */
export const isMoving = (): boolean => el("move").getAttribute("aria-pressed") === "true";

/** The tabs: a click or the arrow keys choose a tool. */
export function wireTabs(choose: (tool: string) => void): void {
  const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => choose(tab.dataset.tool ?? ""));
    tab.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      choose(next.dataset.tool ?? "");
      e.preventDefault();
    });
  });
}
