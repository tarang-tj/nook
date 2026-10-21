import {
  edge,
  exclude,
  faceStrip,
  fitInside,
  insetAcross,
  insetFace,
  paintParts,
  pair,
  prism,
  pts,
  rest,
  shrink,
  slab,
  stepTurn,
  wall,
  type Box,
  type Proj,
  type Shape,
  type Turn,
} from "./geometry";
import { dims, type PieceId } from "./pieces";
import { moreShapes } from "./furniture-more";

/** Every shape for one piece, painted back to front. Bed, desk and fridge are the first three drawings. */
export function furnitureShapes(id: PieceId, u: number, v: number, turn: Turn, project: Proj): Shape[] {
  const { wu, hv } = dims(id, turn);
  const full: Box = { u0: u - wu / 2, u1: u + wu / 2, v0: v - hv / 2, v1: v + hv / 2 };
  const shadow: Shape = {
    points: pts([
      project(full.u0, full.v0),
      project(full.u1, full.v0),
      project(full.u1, full.v1),
      project(full.u0, full.v1),
    ]),
    fill: "rgba(0,0,0,0.32)",
    depth: -1,
  };

  if (id === "bed") {
    const footTurn = stepTurn(turn, 2);
    const sideA = stepTurn(turn, 1);
    const sideB = stepTurn(turn, -1);
    const head = slab(full, turn, 0.06);
    const foot = slab(full, footTurn, 0.045);
    const railA = slab(full, sideA, 0.042);
    const railB = slab(full, sideB, 0.042);
    const well = exclude(exclude(exclude(exclude(full, head, turn), foot, footTurn), railA, sideA), railB, sideB);
    const mattress = shrink(well, 0.08);
    const pillows = pair(shrink(edge(mattress, turn, 0.42), 0.12), turn);
    const blanket = shrink(edge(mattress, footTurn, 0.58), 0.06);
    const frame = { top: "#c4a574", faceU: "#a07850", faceV: "#7a5a3c" };
    return [
      shadow,
      ...paintParts(project, [
        { box: full, y0: 0, y1: 4, top: "#b08968", faceU: "#8d6844", faceV: "#6e5338" },
        { box: mattress, y0: 4, y1: 11, top: "#f7f1e6", faceU: "#e4d0b8", faceV: "#d4bea4", body: true },
        { box: blanket, y0: 11, y1: 14, top: "#efe2cc", faceU: "#e0cdb4", faceV: "#d2bfa4" },
        ...pillows.map((box) => ({ box, y0: 11, y1: 19, top: "#fffaf4", faceU: "#f4e7d6", faceV: "#e8d8c4" })),
        { box: railA, y0: 4, y1: 14, ...frame },
        { box: railB, y0: 4, y1: 14, ...frame },
        { box: foot, y0: 4, y1: 12, ...frame },
        { box: head, y0: 0, y1: 30, top: "#d7b07a", faceU: "#a07850", faceV: "#6e5338" },
      ]),
    ];
  }

  if (id === "desk") {
    const facing = stepTurn(turn, 2);
    const rear = stepTurn(facing, 2);
    const chairZone = edge(full, facing, 0.36);
    const deskZone = rest(full, facing, 0.36);
    const top = shrink(deskZone, 0.02);
    const apron = shrink(deskZone, 0.12);
    const seat = fitInside(chairZone, 0.17, 0.17);
    const back = insetAcross(slab(seat, rear, 0.045), rear, 0.28);
    const leg = Math.min(wu, hv) * 0.065;
    const peg = (cu: number, cv: number): Box => ({
      u0: cu - leg / 2,
      u1: cu + leg / 2,
      v0: cv - leg / 2,
      v1: cv + leg / 2,
    });
    const deskLegs: Array<[number, number]> = [
      [apron.u0 + leg, apron.v0 + leg],
      [apron.u1 - leg, apron.v0 + leg],
      [apron.u0 + leg, apron.v1 - leg],
      [apron.u1 - leg, apron.v1 - leg],
    ];
    const chairLegs: Array<[number, number]> = [
      [seat.u0 + leg, seat.v0 + leg],
      [seat.u1 - leg, seat.v0 + leg],
      [seat.u0 + leg, seat.v1 - leg],
      [seat.u1 - leg, seat.v1 - leg],
    ];
    const screen = insetAcross(slab(top, rear, 0.04), rear, 0.2);
    const stand = insetAcross(shrink(screen, 0.36), rear, 0.06);
    return [
      shadow,
      ...deskLegs.flatMap(([cu, cv]) => prism(project, peg(cu, cv), 0, 14, "#8d6844", "#6e5338", "#5c4630")),
      ...chairLegs.flatMap(([cu, cv]) => prism(project, peg(cu, cv), 0, 8, "#a07850", "#6e5338", "#5c4630")),
      ...prism(project, apron, 14, 17, "#e7c99a", "#c49662", "#a8845c"),
      ...prism(project, top, 17, 21, "#f3ddb8", "#d7b07a", "#c49662", true),
      ...prism(project, stand, 21, 25, "#2c3844", "#1e2832", "#12181e"),
      ...prism(project, screen, 25, 38, "#3d4c5c", "#24303c", "#12181e"),
      ...prism(project, seat, 8, 12, "#e7c99a", "#c4a574", "#a07850"),
      ...prism(project, back, 12, 26, "#c4a574", "#8d6844", "#6e5338"),
    ];
  }

  if (id !== "fridge") return [shadow, ...moreShapes(id, full, turn, project)];

  const shell = shrink(full, 0.04);
  const front = stepTurn(turn, 2);
  const side = front === 1 ? "u" : front === 2 ? "v" : null;
  const door = side ? insetFace(shell, side, 0.12) : null;
  return [
    shadow,
    ...prism(project, shrink(full, 0.1), 0, 3, "#9aa6b2", "#8795a3", "#738291"),
    ...prism(project, shell, 3, 50, "#f7f9fb", "#e4edf3", "#d0dbe4", true),
    ...(door && side
      ? [
          wall(project, door, 7, 46, side, "#ffffff"),
          wall(project, door, 18, 19.4, side, "#c5d0da"),
          wall(project, faceStrip(door, side), 26, 36, side, "#7d8d9c"),
        ]
      : []),
  ];
}
