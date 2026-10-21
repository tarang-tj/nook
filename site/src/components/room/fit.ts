import type { Box, Spot, Turn } from "./geometry";
import { dims, ft, pieceById, type Placed, type PieceId } from "./pieces";
import type { FeatureKind, Room } from "./rooms";

export type Miss = { ok: false; reason: "wall" } | { ok: false; reason: FeatureKind | "piece"; hit: string };
export type Fit = { ok: true } | Miss;

export function pieceBox(spot: Spot, id: PieceId, turn: Turn): Box {
  const { wu, hv } = dims(id, turn);
  return { u0: spot.u - wu / 2, u1: spot.u + wu / 2, v0: spot.v - hv / 2, v1: spot.v + hv / 2 };
}

/** Touching edges is fine; only a real overlap counts. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.u0 < b.u1 && b.u0 < a.u1 && a.v0 < b.v1 && b.v0 < a.v1;
}

export function onFloor(spot: Spot | null, room: Room): spot is Spot {
  return !!spot && spot.u >= 0 && spot.v >= 0 && spot.u <= room.u && spot.v <= room.v;
}

/** Checks the walls first, then the fixed features, then the other pieces. */
export function checkFit(room: Room, spot: Spot, id: PieceId, turn: Turn, others: Placed[]): Fit {
  const box = pieceBox(spot, id, turn);
  const eps = 1e-9;
  if (box.u0 < -eps || box.v0 < -eps || box.u1 > room.u + eps || box.v1 > room.v + eps) {
    return { ok: false, reason: "wall" };
  }
  const feature = room.features.find((item) => boxesOverlap(box, item.box));
  if (feature) return { ok: false, reason: feature.kind, hit: feature.id };
  const other = others.find((item) => item.id !== id && boxesOverlap(box, pieceBox(item, item.id, item.turn)));
  if (other) return { ok: false, reason: "piece", hit: other.id };
  return { ok: true };
}

export function canPlace(room: Room, spot: Spot, id: PieceId, turn: Turn, others: Placed[]): boolean {
  return checkFit(room, spot, id, turn, others).ok;
}

/** Short words for the verdict line. */
export function missText(miss: Miss): string {
  if (miss.reason === "wall") return "Runs into the wall";
  if (miss.reason === "door") return "Blocks the door";
  if (miss.reason === "closet") return "Blocks the closet";
  if (miss.reason === "radiator") return "Hits the radiator";
  return `Hits the ${pieceById(miss.hit as PieceId).name.toLowerCase()}`;
}

const STEP = ft(0.5);

/**
 * The spot nearest the piece's home that fits, trying turn 0 and then turn 1.
 * Used for tap-to-place and when a piece has to move after a room switch.
 */
export function firstFit(room: Room, id: PieceId, others: Placed[], prefer?: Spot, turns: Turn[] = [0, 1]): Placed | null {
  const home = prefer ?? { u: pieceById(id).home.u * room.u, v: pieceById(id).home.v * room.v };
  const spots: Spot[] = [home];
  for (let u = 0; u <= room.u + 1e-9; u += STEP) {
    for (let v = 0; v <= room.v + 1e-9; v += STEP) spots.push({ u, v });
  }
  const far = (spot: Spot) => (spot.u - home.u) ** 2 + (spot.v - home.v) ** 2;
  spots.sort((a, b) => far(a) - far(b));
  for (const turn of turns) {
    const spot = spots.find((item) => canPlace(room, item, id, turn, others));
    if (spot) return { id, u: spot.u, v: spot.v, turn };
  }
  return null;
}

/**
 * Moves placements into another room. Each piece keeps its relative spot and turn
 * when it fits there, else moves to the nearest spot that fits, else is left out.
 * Every kept piece is valid in the new room.
 */
export function carryOver(placed: Placed[], from: Room, to: Room): { kept: Placed[]; dropped: PieceId[] } {
  const kept: Placed[] = [];
  const dropped: PieceId[] = [];
  for (const item of placed) {
    const spot = { u: (item.u / from.u) * to.u, v: (item.v / from.v) * to.v };
    if (canPlace(to, spot, item.id, item.turn, kept)) {
      kept.push({ ...item, ...spot });
      continue;
    }
    const moved = firstFit(to, item.id, kept, spot, [item.turn, ((item.turn + 1) % 4) as Turn]);
    if (moved) kept.push(moved);
    else dropped.push(item.id);
  }
  return { kept, dropped };
}
