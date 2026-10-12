// "Place the taps for me": put the made-up floor's taps down for whatever
// the current tool is waiting for. Pure, so it can be tested.
import { sampleTaps } from "../sample/floor";
import { closeRoom, place, target, type State } from "./state";

/** Place every tap the current tool still needs. Returns how many it placed. */
export function placeSampleTaps(s: State): number {
  let placed = 0;
  // The fit tool tries a thing inside the outline, so it needs the outline too.
  if (s.tool === "fit" && s.points.sheet.length === 4 && !s.closed && s.points.room.length === 0) {
    for (const tap of sampleTaps("room")) {
      s.points.room.push(tap);
      s.history.push("room");
      placed++;
    }
    closeRoom(s);
  }
  for (;;) {
    const group = target(s);
    const tap = group ? sampleTaps(group)[s.points[group].length] : undefined;
    if (!tap) break;
    place(s, tap);
    placed++;
  }
  if (s.tool === "room" && s.points.room.length === sampleTaps("room").length) closeRoom(s);
  return placed;
}
