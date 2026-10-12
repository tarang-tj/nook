// A made-up 4 m × 3 m room, 2.4 m tall, so the scan result can be shown on
// a laptop without a phone, a camera, or a real room.
// This is not a real room. Everything here is constructed, not measured.
import type { ScanRoom } from "./geometry";

/** The made-up room. Corners start at the origin and run clockwise looking
 * down: SW → SE → NE → NW. Wall lengths: 4 m, 3 m, 4 m, 3 m. Area: 12 m².
 * Height: 2.4 m, labelled as "measured" so the rendered room does not carry
 * a "typed, not checked" warning that would mislead on the real scan path. */
export const SAMPLE_SCAN_ROOM: ScanRoom = {
  corners: [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ],
  height: 2.4,
  heightSource: "measured",
};
