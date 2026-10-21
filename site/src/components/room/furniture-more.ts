import {
  exclude,
  fitInside,
  insetFace,
  paintParts,
  pair,
  prism,
  shrink,
  slab,
  stepTurn,
  wall,
  type Box,
  type Proj,
  type Shape,
  type Turn,
} from "./geometry";
import { ft, type PieceId } from "./pieces";

const WOOD = { top: "#c4a574", faceU: "#a07850", faceV: "#7a5a3c" };
const WOOD_TOP = { top: "#d7b07a", faceU: "#b08968", faceV: "#8d6844" };
const DARK = "#6e5338";
const BOOKS = ["#ffb000", "#d7ecc4", "#ffb089", "#9aa6b2", "#f7f1e6"];

type Side = "u" | "v";

/** The face that points away from the wall at turn 0, when the camera can see it. */
function frontSide(turn: Turn): Side | null {
  const front = stepTurn(turn, 2);
  return front === 1 ? "u" : front === 2 ? "v" : null;
}

/** Part of a face, from fraction a to b along it. */
function faceSlice(box: Box, side: Side, a: number, b: number): Box {
  if (side === "v") {
    const span = box.u1 - box.u0;
    return { ...box, u0: box.u0 + span * a, u1: box.u0 + span * b };
  }
  const span = box.v1 - box.v0;
  return { ...box, v0: box.v0 + span * a, v1: box.v0 + span * b };
}

function loveseat(full: Box, turn: Turn, project: Proj): Shape[] {
  const sideA = stepTurn(turn, 1);
  const sideB = stepTurn(turn, -1);
  const back = slab(full, turn, 0.06);
  const armA = slab(full, sideA, 0.04);
  const armB = slab(full, sideB, 0.04);
  const seat = exclude(exclude(exclude(full, back, turn), armA, sideA), armB, sideB);
  const cushions = pair(shrink(seat, 0.04), turn);
  const frame = { top: "#8795a3", faceU: "#738291", faceV: "#5f6e7d" };
  return paintParts(project, [
    { box: full, y0: 0, y1: 6, ...frame },
    ...cushions.map((box) => ({ box, y0: 6, y1: 13, top: "#b8c2cc", faceU: "#a3afba", faceV: "#8f9caa", body: true })),
    { box: armA, y0: 0, y1: 17, ...frame },
    { box: armB, y0: 0, y1: 17, ...frame },
    { box: back, y0: 0, y1: 25, top: "#9aa6b2", faceU: "#738291", faceV: "#5f6e7d" },
  ]);
}

function dresser(full: Box, turn: Turn, project: Proj): Shape[] {
  const shell = shrink(full, 0.03);
  const side = frontSide(turn);
  const face = side ? insetFace(shell, side, 0.08) : null;
  const knob = face && side ? insetFace(face, side, 0.44) : null;
  return [
    ...prism(project, shell, 0, 32, WOOD.top, WOOD.faceU, WOOD.faceV, true),
    ...prism(project, full, 32, 35, WOOD_TOP.top, WOOD_TOP.faceU, WOOD_TOP.faceV),
    ...(face && knob && side
      ? [
          wall(project, face, 11, 12.2, side, DARK),
          wall(project, face, 21.5, 22.7, side, DARK),
          ...[5.5, 16, 26.5].map((y) => wall(project, knob, y, y + 2, side, DARK)),
        ]
      : []),
  ];
}

function bookshelf(full: Box, turn: Turn, project: Proj): Shape[] {
  const shell = shrink(full, 0.03);
  const side = frontSide(turn);
  const inner = side ? insetFace(shell, side, 0.07) : null;
  const rows = [3, 22, 41];
  const slots: Array<[number, number, number]> = [
    [0.04, 0.16, 14],
    [0.18, 0.3, 12],
    [0.32, 0.5, 15],
    [0.6, 0.72, 13],
    [0.74, 0.86, 11],
  ];
  return [
    ...prism(project, shell, 0, 60, WOOD.top, WOOD.faceU, WOOD.faceV, true),
    ...prism(project, full, 60, 62, WOOD_TOP.top, WOOD_TOP.faceU, WOOD_TOP.faceV),
    ...(inner && side
      ? [
          wall(project, inner, 3, 58, side, "#4a3d30"),
          ...rows.flatMap((y, row) =>
            slots
              .filter((_, index) => (index + row) % 4 !== 3)
              .map(([a, b, tall], index) =>
                wall(project, faceSlice(inner, side, a, b), y, y + tall, side, BOOKS[(index + row) % BOOKS.length]),
              ),
          ),
          wall(project, inner, 20, 22, side, WOOD.faceU),
          wall(project, inner, 39, 41, side, WOOD.faceU),
        ]
      : []),
  ];
}

function nightstand(full: Box, turn: Turn, project: Proj): Shape[] {
  const shell = shrink(full, 0.05);
  const side = frontSide(turn);
  const face = side ? insetFace(shell, side, 0.1) : null;
  const top = shrink(full, 0.02);
  return [
    ...prism(project, shell, 0, 17, WOOD.top, WOOD.faceU, WOOD.faceV, true),
    ...prism(project, top, 17, 19, WOOD_TOP.top, WOOD_TOP.faceU, WOOD_TOP.faceV),
    ...(face && side
      ? [
          wall(project, face, 9, 10, side, DARK),
          wall(project, insetFace(face, side, 0.42), 12.5, 14.5, side, DARK),
        ]
      : []),
    ...prism(project, fitInside(top, ft(0.4), ft(0.4)), 19, 21, "#5c4630", "#4a3d30", "#3a3028"),
    ...prism(project, fitInside(top, ft(0.08), ft(0.08)), 21, 28, "#8d6844", "#6e5338", "#5c4630"),
    ...prism(project, fitInside(top, ft(0.8), ft(0.8)), 28, 36, "#fff3d6", "#f4e1b8", "#e8d0a0"),
  ];
}

/** Drawings for the pieces added after the first three. */
export function moreShapes(id: Exclude<PieceId, "bed" | "desk" | "fridge">, full: Box, turn: Turn, project: Proj): Shape[] {
  if (id === "loveseat") return loveseat(full, turn, project);
  if (id === "dresser") return dresser(full, turn, project);
  if (id === "bookshelf") return bookshelf(full, turn, project);
  return nightstand(full, turn, project);
}
