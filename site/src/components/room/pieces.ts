import type { Spot, Turn } from "./geometry";

// Floor coordinates are in "grid units": one unit is 12 feet, the side of the
// first square room this sketch had. Pieces and rooms are written in feet and
// turned into units with ft(), so the drawing code keeps its original scale.
export const FEET_PER_UNIT = 12;
export const ft = (feet: number) => feet / FEET_PER_UNIT;

export type PieceId = "bed" | "desk" | "fridge" | "loveseat" | "dresser" | "bookshelf" | "nightstand";

export type Piece = {
  id: PieceId;
  name: string;
  /** Footprint along u at turn 0, in units. */
  wu: number;
  /** Footprint along v at turn 0, in units. */
  hv: number;
  /** Preferred spot for a tap-to-place, as a fraction of the room (0 to 1). */
  home: Spot;
};

// Footprint assumptions, rounded, including the frame or the space a chair needs.
// They are typical retail sizes, not measurements of any product:
// - Twin bed: twin mattress 39 x 75 in, about 3.4 x 6.6 ft with a frame and headboard.
// - Desk: 46 in wide, 24 in deep, plus about 20 in for the chair: 3.8 x 3.6 ft.
// - Mini fridge: about 20 x 20 in, 1.7 x 1.7 ft.
// - Loveseat: about 58 x 32 in, 4.8 x 2.7 ft.
// - Dresser: three drawers, about 32 x 18 in, 2.7 x 1.5 ft.
// - Bookshelf: about 30 x 12 in, 2.5 x 1 ft.
// - Nightstand: about 18 x 16 in, 1.5 x 1.3 ft.
export const PIECES: Piece[] = [
  { id: "bed", name: "Twin bed", wu: ft(3.4), hv: ft(6.6), home: { u: 0.7, v: 0.55 } },
  { id: "desk", name: "Desk", wu: ft(3.8), hv: ft(3.6), home: { u: 0.3, v: 0.3 } },
  { id: "fridge", name: "Mini fridge", wu: ft(1.7), hv: ft(1.7), home: { u: 0.82, v: 0.2 } },
  { id: "loveseat", name: "Loveseat", wu: ft(4.8), hv: ft(2.7), home: { u: 0.45, v: 0.8 } },
  { id: "dresser", name: "Dresser", wu: ft(2.7), hv: ft(1.5), home: { u: 0.55, v: 0.12 } },
  { id: "bookshelf", name: "Bookshelf", wu: ft(2.5), hv: ft(1), home: { u: 0.25, v: 0.08 } },
  { id: "nightstand", name: "Nightstand", wu: ft(1.5), hv: ft(1.3), home: { u: 0.9, v: 0.9 } },
];

export function pieceById(id: PieceId): Piece {
  const piece = PIECES.find((item) => item.id === id);
  if (!piece) throw new Error(`Unknown piece ${id}`);
  return piece;
}

export function dims(id: PieceId, turn: Turn) {
  const piece = pieceById(id);
  return turn % 2 === 1 ? { wu: piece.hv, hv: piece.wu } : { wu: piece.wu, hv: piece.hv };
}

export type Placed = { id: PieceId; u: number; v: number; turn: Turn };
