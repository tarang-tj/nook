// Press rules adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// What a press on the photo means: pick up a point that is already there, or
// place a new one. Pure, so the rule can be tested without a browser.
//
// The rule has four parts. (1) While a sheet's four corners are still being
// placed, a press always places: the corners of a small sheet are too close
// together to tell "adjust corner 1" from "place corner 3". (2) A finger
// reaches further than a mouse. (3) A point's reach shrinks when another
// point is close, so the space between two points stays free for a new tap.
// (4) A picked-up point moves only after the finger has travelled a little,
// so a tap on a point leaves it where it was (see pointer.ts).
import type { Pt } from "../measure/homography";
import { building, handles, type Handle, type State } from "./state";

/** How close a press must be to pick up a point, screen px. */
export const REACH = { mouse: 12, touch: 24 };
/** The least reach a crowded point keeps, screen px. */
export const FLOOR = { mouse: 5, touch: 8 };
/** A point's reach is at most this share of the distance to its nearest
 * neighbour, so two reach discs never overlap. */
export const SPACING_SHARE = 0.4;
/** How far a press must travel before a picked-up point moves, screen px. */
export const TAP_TRAVEL = 4;

export type Press = { kind: "grab"; handle: Handle } | { kind: "place" };

/** The reach of a point whose nearest neighbour is `spacing` away. All three
 * numbers are in the same unit. */
export const grabReach = (radius: number, floor: number, spacing: number): number =>
  Math.max(Math.min(floor, radius), Math.min(radius, SPACING_SHARE * spacing));

/** Decide what a press at photo point `p` does. `scale` is screen pixels per
 * photo pixel at this zoom. A pen counts as a finger. */
export function pressOn(s: State, p: Pt, scale: number, pointerType: string): Press {
  if (building(s)) return { kind: "place" };
  const kind = pointerType === "mouse" ? "mouse" : "touch";
  const radius = REACH[kind] / scale;
  const floor = FLOOR[kind] / scale;
  const all = handles(s);
  let best: Handle | null = null;
  let bestD = Infinity;
  all.forEach(({ at, handle }, k) => {
    const d = Math.hypot(at.x - p.x, at.y - p.y);
    if (d > radius || d > bestD) return;
    let spacing = Infinity;
    all.forEach((other, j) => {
      if (j !== k) spacing = Math.min(spacing, Math.hypot(other.at.x - at.x, other.at.y - at.y));
    });
    if (d > grabReach(radius, floor, spacing)) return;
    bestD = d;
    best = handle;
  });
  return best ? { kind: "grab", handle: best } : { kind: "place" };
}
