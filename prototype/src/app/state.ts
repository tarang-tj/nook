// What the person has tapped so far, and the rules for where the next tap
// goes. Pure: no page and no canvas, so the tests can drive it directly.
import type { Pt } from "../measure/homography";

export type Tool = "distance" | "room" | "fit";
/** A set of taps that belong together. `sheet` is the first sheet's corners,
 * `ends` the two spots of a distance, `room` an outline's corners, `gap` the
 * two sides of a gap, `second` a second sheet, `span` a known length's ends. */
export type Group = "sheet" | "ends" | "room" | "gap" | "second" | "span";
/** Something on the photo that can be picked up. `thing` is the footprint
 * of the thing being tried for fit; it has one handle, its middle. */
export type Handle = { group: Group | "thing"; index: number };

/** How many taps each group takes. */
export const LIMIT: Record<Group, number> = { sheet: 4, ends: 2, room: 24, gap: 2, second: 4, span: 2 };

export type State = {
  tool: Tool;
  /** An extra reference the person asked to add and has not started tapping. */
  adding: "second" | "span" | null;
  points: Record<Group, Pt[]>;
  /** The room outline has been closed. */
  closed: boolean;
  /** Middle of the thing's footprint, photo pixels. Null until it is dragged. */
  thing: Pt | null;
  /** The footprint's turn on the floor, degrees. */
  turn: number;
  /** What was done, newest last, so Undo can take back one step. */
  history: (Group | "close")[];
};

export const newState = (tool: Tool = "distance"): State => ({
  tool,
  adding: null,
  points: { sheet: [], ends: [], room: [], gap: [], second: [], span: [] },
  closed: false,
  thing: null,
  turn: 0,
  history: [],
});

const EXTRAS = ["second", "span"] as const;

/** Where the next tap goes, or null when this tool has all its taps. */
export function target(s: State): Group | null {
  if (s.points.sheet.length < LIMIT.sheet) return "sheet";
  for (const g of EXTRAS) {
    const n = s.points[g].length;
    if ((s.adding === g || n > 0) && n < LIMIT[g]) return g;
  }
  if (s.tool === "distance") return s.points.ends.length < LIMIT.ends ? "ends" : null;
  if (s.tool === "room") return s.closed || s.points.room.length >= LIMIT.room ? null : "room";
  return s.points.gap.length < LIMIT.gap ? "gap" : null;
}

/** True while a sheet's four corners are still being placed. */
export function building(s: State): boolean {
  const t = target(s);
  return t === "sheet" || t === "second";
}

/** The groups drawn, and open to being picked up, in the chosen tool. */
export function shown(s: State): Group[] {
  const groups: Group[] = ["sheet", "second", "span"];
  groups.push(s.tool === "distance" ? "ends" : "room");
  if (s.tool === "fit") groups.push("gap");
  return groups;
}

const middle = (pts: Pt[]): Pt => ({
  x: pts.reduce((t, p) => t + p.x, 0) / pts.length,
  y: pts.reduce((t, p) => t + p.y, 0) / pts.length,
});

/** Where the thing's footprint sits on the photo: where it was dragged to,
 * or the middle of the room's corners. Null until a room is closed. */
export function thingAt(s: State): Pt | null {
  if (s.tool !== "fit" || !s.closed || s.points.room.length < 3) return null;
  return s.thing ?? middle(s.points.room);
}

export function handles(s: State): { at: Pt; handle: Handle }[] {
  const out = shown(s).flatMap((group) => s.points[group].map((at, index) => ({ at, handle: { group, index } as Handle })));
  const thing = thingAt(s);
  if (thing) out.push({ at: thing, handle: { group: "thing", index: 0 } });
  return out;
}

/** Add a tap to the group that is waiting for one. Null when none is. */
export function place(s: State, p: Pt): Handle | null {
  const group = target(s);
  if (!group) return null;
  s.points[group].push(p);
  s.history.push(group);
  if (s.adding === group) s.adding = null;
  return { group, index: s.points[group].length - 1 };
}

export function moveHandle(s: State, h: Handle, p: Pt): void {
  if (h.group === "thing") s.thing = { x: p.x, y: p.y };
  else s.points[h.group][h.index] = p;
}

/** Close the room outline. False when there is nothing to close. */
export function closeRoom(s: State): boolean {
  if (s.closed || s.points.room.length < 3) return false;
  s.closed = true;
  s.history.push("close");
  return true;
}

/** Take back the last tap, or reopen the outline if closing was last. */
export function undo(s: State): void {
  const last = s.history.pop();
  if (!last) return;
  if (last === "close") s.closed = false;
  else s.points[last].pop();
}

/** Drop one extra reference and every trace of it. */
export function removeExtra(s: State, group: "second" | "span"): void {
  s.points[group] = [];
  s.history = s.history.filter((g) => g !== group);
  if (s.adding === group) s.adding = null;
}

/** Clear every tap. The photo and the chosen tool stay. */
export function reset(s: State): void {
  Object.assign(s, newState(s.tool));
}

export const hasTaps = (s: State): boolean => s.history.length > 0;
