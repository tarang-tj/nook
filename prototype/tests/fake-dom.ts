// A stand-in for the browser, so a test can load src/main.ts itself and press
// the page's own controls. It knows every id in index.html, the starting value
// of every box, and how to hand a click or a change to the page's listeners.
// Nothing is painted: the canvas swallows every drawing call.
import html from "../index.html?raw";
import { vi } from "vitest";

/** Stands in for anything that is only drawn on: every property is itself,
 * every call returns itself, and in sums it counts as zero. */
const swallow: unknown = new Proxy(function () {}, {
  get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : key === "then" ? undefined : swallow),
  apply: () => swallow,
  set: () => true,
});

type Listener = (event: Record<string, unknown>) => void;

export class FakeElement {
  value = "";
  checked = false;
  hidden = false;
  disabled = false;
  textContent = "";
  innerHTML = "";
  href = "";
  download = "";
  width = 0;
  height = 0;
  tabIndex = 0;
  files: unknown[] | null = null;
  dataset: Record<string, string> = {};
  children: unknown[] = [];
  classList = { toggle: () => false, add: () => {}, remove: () => {} };
  private attrs: Record<string, string> = {};
  private listeners: Record<string, Listener[]> = {};

  constructor(readonly id = "") {}

  addEventListener(name: string, run: Listener): void {
    (this.listeners[name] ??= []).push(run);
  }
  /** Hand an event to the page's listeners, as the browser would. */
  fire(name: string, event: Record<string, unknown> = {}): void {
    for (const run of this.listeners[name] ?? []) run({ preventDefault: () => {}, ...event });
  }
  click(): void {
    this.fire("click");
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 390, height: 511 }; // the audit's phone
  }
  getContext(): unknown {
    return swallow;
  }
  matches(): boolean {
    return false;
  }
  replaceChildren(...kids: unknown[]): void {
    this.children = kids;
  }
  append(...kids: unknown[]): void {
    this.children.push(...kids);
  }
  remove(): void {}
  focus(): void {}
  setPointerCapture(): void {}
}

const attr = (tag: string, name: string): string | null => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

/** Every element of index.html that has an id, with its starting state. */
function elementsOf(page: string): Map<string, FakeElement> {
  const found = new Map<string, FakeElement>();
  for (const match of page.matchAll(/<(\w+)\b[^>]*\sid="([^"]+)"[^>]*>/g)) {
    const [tag, kind, id] = match;
    const node = new FakeElement(id);
    node.hidden = /\shidden[\s>/]/.test(tag);
    node.value = attr(tag, "value") ?? "";
    // A select starts on its first option.
    if (kind === "select") node.value = page.slice(match.index).match(/<option value="([^"]*)"/)?.[1] ?? "";
    for (const name of ["role", "aria-pressed"]) {
      const value = attr(tag, name);
      if (value !== null) node.setAttribute(name, value);
    }
    const tool = attr(tag, "data-tool");
    if (tool !== null) node.dataset.tool = tool;
    found.set(id, node);
  }
  return found;
}

export type FakePage = {
  el: (id: string) => FakeElement;
  /** Set a box or a menu and tell the page, as typing or choosing does. */
  set: (id: string, value: string) => void;
  /** Tick or untick a box and tell the page. */
  tick: (id: string, on: boolean) => void;
  press: (id: string) => void;
  /** Choose a photo file: it opens at 3000 by 4000 pixels. */
  loadPhoto: () => void;
  /** The text of every file the page has handed over, oldest first. */
  saved: () => Promise<string[]>;
};

/** Put a fresh page in place of the browser and start src/main.ts on it.
 * Timers are fake: call vi.runAllTimers() to let the error bars be worked out. */
export async function startPage(): Promise<FakePage> {
  const elements = elementsOf(html);
  const body = new FakeElement("body");
  const blobs: Blob[] = [];
  vi.useFakeTimers();
  vi.resetModules();
  vi.stubGlobal("document", {
    body,
    getElementById: (id: string) => elements.get(id) ?? null,
    querySelectorAll: (query: string) =>
      query === '[role="tab"]' ? [...elements.values()].filter((node) => node.getAttribute("role") === "tab") : [],
    createElement: () => new FakeElement(),
  });
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("ResizeObserver", class { observe(): void {} });
  vi.stubGlobal("Image", class {
    naturalWidth = 3000;
    naturalHeight = 4000;
    onload: (() => void) | null = null;
    set src(_url: string) {
      this.onload?.();
    }
  });
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return "blob:fake";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  await import("../src/main");

  const el = (id: string): FakeElement => {
    const node = elements.get(id);
    if (!node) throw new Error(`No #${id} in index.html`);
    return node;
  };
  return {
    el,
    set(id, value) {
      el(id).value = value;
      el(id).fire("input");
      el(id).fire("change");
    },
    tick(id, on) {
      el(id).checked = on;
      el(id).fire("change");
    },
    press: (id) => el(id).click(),
    loadPhoto() {
      const before = blobs.length;
      el("choose").files = [new Blob(["photo"])];
      el("choose").fire("change");
      blobs.splice(before); // the photo itself is not a saved file
    },
    saved: () => Promise.all(blobs.map((blob) => blob.text())),
  };
}

/** Put the real timers and globals back. */
export function stopPage(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}
