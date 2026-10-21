import type { Box } from "./geometry";
import { ft } from "./pieces";

export type RoomId = "dorm-single" | "studio" | "shared";
export type FeatureKind = "door" | "closet" | "radiator";

/** A fixed part of the room that no piece may sit on. `wall` is the wall it is drawn on. */
export type Feature = { id: string; kind: FeatureKind; wall: "back" | "left"; box: Box };

/**
 * u runs along the back wall (left to right in the drawing), v runs along the
 * left wall (back to front). Both walls are drawn; the two front sides are open.
 */
export type Room = { id: RoomId; name: string; u: number; v: number; features: Feature[] };

const zone = (
  id: string,
  kind: FeatureKind,
  wall: Feature["wall"],
  u0: number,
  u1: number,
  v0: number,
  v1: number,
): Feature => ({ id, kind, wall, box: { u0: ft(u0), u1: ft(u1), v0: ft(v0), v1: ft(v1) } });

// Example rooms. Sizes are assumptions picked to look like common student rooms,
// not data about any building:
// - Dorm single: 11 x 12 ft, a closet in the back corner, a window with a
//   radiator strip (0.7 ft deep) on the back wall, a 3 ft door that swings in.
// - Studio apartment: 15 x 13 ft main room, door in the back wall, a closet
//   2 ft deep on the left wall, radiator under the back window.
// - Shared bedroom: 12 x 16 ft, two closets on the back wall, a radiator on the
//   left wall, the door near the front of the left wall.
// A door swing zone is the 3 x 3 ft square the door sweeps.
export const ROOMS: Room[] = [
  {
    id: "dorm-single",
    name: "Dorm single",
    u: ft(11),
    v: ft(12),
    features: [
      zone("closet", "closet", "back", 0, 3.5, 0, 2),
      zone("radiator", "radiator", "back", 5.5, 10, 0, 0.7),
      zone("door", "door", "left", 0, 3, 8.8, 11.8),
    ],
  },
  {
    id: "studio",
    name: "Studio",
    u: ft(15),
    v: ft(13),
    features: [
      zone("door", "door", "back", 11.5, 14.5, 0, 3),
      zone("radiator", "radiator", "back", 2.5, 8.5, 0, 0.7),
      zone("closet", "closet", "left", 0, 2, 3.5, 8.5),
    ],
  },
  {
    id: "shared",
    name: "Shared room",
    u: ft(12),
    v: ft(16),
    features: [
      zone("closet-a", "closet", "back", 0, 3.5, 0, 2),
      zone("closet-b", "closet", "back", 8.5, 12, 0, 2),
      zone("radiator", "radiator", "left", 0, 0.7, 4.5, 10.5),
      zone("door", "door", "left", 0, 3, 12.5, 15.5),
    ],
  },
];

export function roomById(id: RoomId): Room {
  const room = ROOMS.find((item) => item.id === id);
  if (!room) throw new Error(`Unknown room ${id}`);
  return room;
}
