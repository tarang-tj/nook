import type { Point, Proj, Spot } from "./geometry";
import type { Room } from "./rooms";

// The drawing space of the room svg (its viewBox is 88 12 284 252).
export const VIEW = { x: 88, y: 12, w: 284, h: 252 };
const CENTER_X = 230;
const BACK_Y = 132;
const RIGHT = { x: 124, y: 58 };
const LEFT = { x: -124, y: 58 };
const WALL = 104;

export type View = {
  /** Pixels per unit. A room whose u + v is 2 units draws at scale 1. */
  scale: number;
  wall: number;
  project: Proj;
  toUV: (x: number, y: number) => Spot;
};

/**
 * Isometric projection for one room. Every room fills the same width on screen,
 * so a bigger room draws its walls and furniture a little smaller.
 */
export function makeView(room: Room): View {
  const scale = 2 / (room.u + room.v);
  const r = { x: RIGHT.x * scale, y: RIGHT.y * scale };
  const l = { x: LEFT.x * scale, y: LEFT.y * scale };
  const back = { x: CENTER_X - (r.x * room.u + l.x * room.v) / 2, y: BACK_Y };
  const det = r.x * l.y - l.x * r.y;
  return {
    scale,
    wall: WALL * scale,
    project: (u, v, lift = 0): Point => ({
      x: back.x + u * r.x + v * l.x,
      y: back.y + u * r.y + v * l.y - lift * scale,
    }),
    toUV: (x, y) => {
      const dx = x - back.x;
      const dy = y - back.y;
      return { u: (dx * l.y - l.x * dy) / det, v: (r.x * dy - dx * r.y) / det };
    },
  };
}

export function thumbProject(u: number, v: number, lift = 0): Point {
  return {
    x: 36 + (u - 0.5) * 76 + (v - 0.5) * -76,
    y: 46 + (u - 0.5) * 32 + (v - 0.5) * 32 - lift * 0.48,
  };
}
