// What a press on the photo means: pick up a point that is already there, or
// place a new one. Pure, so the rule can be tested without a browser.
import type { Pt } from "../measure/homography";
import { nearest } from "../ui/view";
import { handles, type Handle, type State } from "./state";

/** How close (screen px) a press must be to pick up a point. */
export const GRAB_RADIUS_PX = 28;
/** How far (screen px) a press must travel before a picked-up point moves. */
export const TAP_TRAVEL = 0;

export type Press = { kind: "grab"; handle: Handle } | { kind: "place" };

/** Decide what a press at photo point `p` does. `scale` is screen pixels per
 * photo pixel at this zoom. */
export function pressOn(s: State, p: Pt, scale: number, _pointerType: string): Press {
  const all = handles(s);
  const index = nearest(all.map((h) => h.at), p, GRAB_RADIUS_PX / scale);
  return index >= 0 ? { kind: "grab", handle: all[index].handle } : { kind: "place" };
}
