import { motion, useReducedMotion } from "motion/react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type PieceId = "bed" | "desk" | "fridge";
type Turn = 0 | 1 | 2 | 3;

type Piece = {
  id: PieceId;
  name: string;
  wu: number;
  hv: number;
  home: { u: number; v: number };
};

type Spot = { u: number; v: number };
type Placed = { id: PieceId; u: number; v: number; turn: Turn };
type Drag = { id: PieceId; x: number; y: number; turn: Turn; fromRoom: boolean };
type Point = { x: number; y: number };
type Proj = (u: number, v: number, lift?: number) => Point;
type Shape = { points: string; fill: string; body?: boolean; depth: number };
type Box = { u0: number; u1: number; v0: number; v1: number };

const PIECES: Piece[] = [
  { id: "bed", name: "Twin bed", wu: 0.46, hv: 0.34, home: { u: 0.62, v: 0.58 } },
  { id: "desk", name: "Desk", wu: 0.36, hv: 0.28, home: { u: 0.3, v: 0.34 } },
  { id: "fridge", name: "Mini fridge", wu: 0.22, hv: 0.2, home: { u: 0.76, v: 0.3 } },
];

const BACK = { x: 230, y: 132 };
const RIGHT = { x: 124, y: 58 };
const LEFT = { x: -124, y: 58 };
const WALL = 104;

function pieceById(id: PieceId): Piece {
  const piece = PIECES.find((item) => item.id === id);
  if (!piece) throw new Error(`Unknown piece ${id}`);
  return piece;
}

function floorPoint(u: number, v: number) {
  return {
    x: BACK.x + u * RIGHT.x + v * LEFT.x,
    y: BACK.y + u * RIGHT.y + v * LEFT.y,
  };
}

function roomProject(u: number, v: number, lift = 0): Point {
  const point = floorPoint(u, v);
  return { x: point.x, y: point.y - lift };
}

function thumbProject(u: number, v: number, lift = 0): Point {
  return {
    x: 36 + (u - 0.5) * 76 + (v - 0.5) * -76,
    y: 46 + (u - 0.5) * 32 + (v - 0.5) * 32 - lift * 0.48,
  };
}

function toUV(x: number, y: number): Spot {
  const dx = x - BACK.x;
  const dy = y - BACK.y;
  const det = RIGHT.x * LEFT.y - LEFT.x * RIGHT.y;
  return {
    u: (dx * LEFT.y - LEFT.x * dy) / det,
    v: (RIGHT.x * dy - dx * RIGHT.y) / det,
  };
}

function dims(id: PieceId, turn: Turn) {
  const piece = pieceById(id);
  return turn % 2 === 1 ? { wu: piece.hv, hv: piece.wu } : { wu: piece.wu, hv: piece.hv };
}

function stepTurn(turn: Turn, dir: -1 | 1 | 2): Turn {
  return ((turn + dir + 4) % 4) as Turn;
}

function onFloor(spot: Spot | null): spot is Spot {
  return !!spot && spot.u >= 0 && spot.v >= 0 && spot.u <= 1 && spot.v <= 1;
}

function footprintFits(spot: Spot, id: PieceId, turn: Turn): boolean {
  const { wu, hv } = dims(id, turn);
  return (
    spot.u - wu / 2 >= 0 &&
    spot.v - hv / 2 >= 0 &&
    spot.u + wu / 2 <= 1 &&
    spot.v + hv / 2 <= 1
  );
}

function overlaps(spot: Spot, id: PieceId, turn: Turn, others: Placed[]): boolean {
  const { wu, hv } = dims(id, turn);
  return others.some((other) => {
    const box = dims(other.id, other.turn);
    const gapU = Math.abs(spot.u - other.u) * 2;
    const gapV = Math.abs(spot.v - other.v) * 2;
    return gapU < wu + box.wu && gapV < hv + box.hv;
  });
}

function canPlace(spot: Spot, id: PieceId, turn: Turn, others: Placed[]): boolean {
  return footprintFits(spot, id, turn) && !overlaps(spot, id, turn, others);
}

function pts(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function prism(
  project: Proj,
  box: Box,
  y0: number,
  y1: number,
  top: string,
  faceU: string,
  faceV: string,
  body = false,
): Shape[] {
  const { u0, u1, v0, v1 } = box;
  if (u1 - u0 < 0.004 || v1 - v0 < 0.004 || y1 - y0 <= 0) return [];
  const at = (u: number, v: number, y: number) => project(u, v, y);
  const side = (points: Point[], fill: string): Shape => ({ points: pts(points), fill, depth: 0 });
  // Far walls first, then the two walls facing the camera, then the top.
  return [
    side([at(u0, v0, y0), at(u0, v1, y0), at(u0, v1, y1), at(u0, v0, y1)], faceU),
    side([at(u0, v0, y0), at(u1, v0, y0), at(u1, v0, y1), at(u0, v0, y1)], faceV),
    side([at(u0, v1, y0), at(u1, v1, y0), at(u1, v1, y1), at(u0, v1, y1)], faceV),
    side([at(u1, v0, y0), at(u1, v1, y0), at(u1, v1, y1), at(u1, v0, y1)], faceU),
    {
      points: pts([at(u0, v0, y1), at(u1, v0, y1), at(u1, v1, y1), at(u0, v1, y1)]),
      fill: top,
      body,
      depth: 0,
    },
  ];
}

function edge(box: Box, turn: Turn, thick: number): Box {
  const du = (box.u1 - box.u0) * thick;
  const dv = (box.v1 - box.v0) * thick;
  if (turn === 0) return { ...box, v1: box.v0 + dv };
  if (turn === 1) return { ...box, u0: box.u1 - du };
  if (turn === 2) return { ...box, v0: box.v1 - dv };
  return { ...box, u1: box.u0 + du };
}

function rest(box: Box, turn: Turn, thick: number): Box {
  const du = (box.u1 - box.u0) * thick;
  const dv = (box.v1 - box.v0) * thick;
  if (turn === 0) return { ...box, v0: box.v0 + dv };
  if (turn === 1) return { ...box, u1: box.u1 - du };
  if (turn === 2) return { ...box, v1: box.v1 - dv };
  return { ...box, u0: box.u0 + du };
}

function shrink(box: Box, amount: number): Box {
  const du = (box.u1 - box.u0) * amount;
  const dv = (box.v1 - box.v0) * amount;
  return { u0: box.u0 + du, u1: box.u1 - du, v0: box.v0 + dv, v1: box.v1 - dv };
}

function slab(box: Box, turn: Turn, depth: number): Box {
  const along = turn === 0 || turn === 2 ? box.v1 - box.v0 : box.u1 - box.u0;
  const d = Math.min(Math.max(depth, 0.02), along * 0.78);
  if (turn === 0) return { ...box, v1: box.v0 + d };
  if (turn === 2) return { ...box, v0: box.v1 - d };
  if (turn === 1) return { ...box, u0: box.u1 - d };
  return { ...box, u1: box.u0 + d };
}

function insetAcross(box: Box, turn: Turn, amount: number): Box {
  if (turn === 1 || turn === 3) {
    const dv = (box.v1 - box.v0) * amount;
    return { ...box, v0: box.v0 + dv, v1: box.v1 - dv };
  }
  const du = (box.u1 - box.u0) * amount;
  return { ...box, u0: box.u0 + du, u1: box.u1 - du };
}

function exclude(parent: Box, cut: Box, turn: Turn): Box {
  if (turn === 0) return { ...parent, v0: cut.v1 };
  if (turn === 2) return { ...parent, v1: cut.v0 };
  if (turn === 1) return { ...parent, u1: cut.u0 };
  return { ...parent, u0: cut.u1 };
}

function fitInside(zone: Box, wu: number, hv: number): Box {
  const du = Math.min(wu, (zone.u1 - zone.u0) * 0.94);
  const dv = Math.min(hv, (zone.v1 - zone.v0) * 0.94);
  const cu = (zone.u0 + zone.u1) / 2;
  const cv = (zone.v0 + zone.v1) / 2;
  return { u0: cu - du / 2, u1: cu + du / 2, v0: cv - dv / 2, v1: cv + dv / 2 };
}

function wall(project: Proj, box: Box, y0: number, y1: number, side: "u" | "v", fill: string): Shape {
  const { u0, u1, v0, v1 } = box;
  const at = (u: number, v: number, y: number) => project(u, v, y);
  const points =
    side === "v"
      ? [at(u0, v1, y0), at(u1, v1, y0), at(u1, v1, y1), at(u0, v1, y1)]
      : [at(u1, v0, y0), at(u1, v1, y0), at(u1, v1, y1), at(u1, v0, y1)];
  const depth = side === "v" ? (u0 + u1) / 2 + v1 + 0.01 : u1 + (v0 + v1) / 2 + 0.01;
  return { points: pts(points), fill, depth };
}

function insetFace(box: Box, side: "u" | "v", pad: number): Box {
  if (side === "v") {
    const du = (box.u1 - box.u0) * pad;
    return { ...box, u0: box.u0 + du, u1: box.u1 - du };
  }
  const dv = (box.v1 - box.v0) * pad;
  return { ...box, v0: box.v0 + dv, v1: box.v1 - dv };
}

function faceStrip(box: Box, side: "u" | "v"): Box {
  if (side === "v") {
    const w = (box.u1 - box.u0) * 0.14;
    return { ...box, u0: box.u1 - w };
  }
  const w = (box.v1 - box.v0) * 0.14;
  return { ...box, v0: box.v1 - w };
}

function pair(box: Box, turn: Turn): [Box, Box] {
  const alongU = turn === 0 || turn === 2;
  const gap = 0.08;
  if (alongU) {
    const span = box.u1 - box.u0;
    const mid = box.u0 + span / 2;
    const halfGap = (span * gap) / 2;
    return [
      { ...box, u1: mid - halfGap },
      { ...box, u0: mid + halfGap },
    ];
  }
  const span = box.v1 - box.v0;
  const mid = box.v0 + span / 2;
  const halfGap = (span * gap) / 2;
  return [
    { ...box, v1: mid - halfGap },
    { ...box, v0: mid + halfGap },
  ];
}

type Part = {
  box: Box;
  y0: number;
  y1: number;
  top: string;
  faceU: string;
  faceV: string;
  body?: boolean;
  bias?: number;
};

function paintParts(project: Proj, parts: Part[]): Shape[] {
  return parts
    .map((part, order) => ({ ...part, order }))
    .sort(
      (a, b) =>
        a.box.u0 + a.box.v0 + (a.bias ?? 0) - (b.box.u0 + b.box.v0 + (b.bias ?? 0)) || a.order - b.order,
    )
    .flatMap((part) => prism(project, part.box, part.y0, part.y1, part.top, part.faceU, part.faceV, part.body));
}

function furnitureShapes(id: PieceId, u: number, v: number, turn: Turn, project: Proj): Shape[] {
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

export function RoomSketch() {
  const reduce = useReducedMotion() ?? false;
  const svgRef = useRef<SVGSVGElement>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const dragRef = useRef<Drag | null>(null);
  const stopDragRef = useRef<(() => void) | null>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<PieceId | null>(null);
  const [reject, setReject] = useState(false);

  function locate(clientX: number, clientY: number): Spot | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const local = point.matrixTransform(matrix.inverse());
    const spot = toUV(local.x, local.y);
    if (spot.u < -0.12 || spot.v < -0.12 || spot.u > 1.12 || spot.v > 1.12) return null;
    return spot;
  }

  function startDrag(id: PieceId, fromRoom: boolean, event: ReactPointerEvent<Element>) {
    event.preventDefault();
    stopDragRef.current?.();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers refuse capture. The window listeners still follow the pointer.
    }
    startRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    const existing = placed.find((item) => item.id === id);
    const next = { id, x: event.clientX, y: event.clientY, turn: existing?.turn ?? 0, fromRoom };
    dragRef.current = next;
    setDrag(next);

    const move = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      if (dx * dx + dy * dy > 36) movedRef.current = true;
      const updated = { ...dragRef.current, x: ev.clientX, y: ev.clientY };
      dragRef.current = updated;
      setDrag(updated);
    };
    const end = (ev: PointerEvent) => {
      stop();
      finishDrag(ev as unknown as ReactPointerEvent<Element>);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (stopDragRef.current === stop) stopDragRef.current = null;
    };
    stopDragRef.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function cancelDrag() {
    stopDragRef.current?.();
    dragRef.current = null;
    setDrag(null);
  }

  function finishDrag(event: ReactPointerEvent<Element>) {
    stopDragRef.current?.();
    const current = dragRef.current;
    const moved = movedRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current) return;
    if (!moved) {
      if (!current.fromRoom) {
        const home = pieceById(current.id).home;
        setPlaced((items) => {
          if (items.some((item) => item.id === current.id)) return items;
          if (!canPlace(home, current.id, 0, items)) return items;
          return [...items, { id: current.id, ...home, turn: 0 }];
        });
      }
      setSelected(current.id);
      if (current.fromRoom && event.currentTarget instanceof SVGElement) event.currentTarget.focus();
      return;
    }

    const spot = locate(event.clientX, event.clientY);
    if (!onFloor(spot)) {
      setReject(false);
      setSelected((id) => (id === current.id ? null : id));
      setPlaced((items) => items.filter((item) => item.id !== current.id));
      return;
    }
    if (!canPlace(spot, current.id, current.turn, placed.filter((item) => item.id !== current.id))) {
      setReject(true);
      setSelected(current.id);
      return;
    }
    setReject(false);
    setSelected(current.id);
    setPlaced((items) => [
      ...items.filter((item) => item.id !== current.id),
      { id: current.id, u: spot.u, v: spot.v, turn: current.turn },
    ]);
  }

  function nudge(id: PieceId, du: number, dv: number) {
    const item = placed.find((entry) => entry.id === id);
    if (!item) return;
    const spot = { u: item.u + du, v: item.v + dv };
    const others = placed.filter((entry) => entry.id !== id);
    if (!canPlace(spot, id, item.turn, others)) return;
    setReject(false);
    setPlaced([...others, { ...item, ...spot }]);
  }

  function rotate(id: PieceId, dir: -1 | 1 = 1) {
    const item = placed.find((entry) => entry.id === id);
    if (!item) return;
    const turn = stepTurn(item.turn, dir);
    const others = placed.filter((entry) => entry.id !== id);
    if (!canPlace({ u: item.u, v: item.v }, id, turn, others)) {
      setReject(true);
      return;
    }
    setReject(false);
    setPlaced([...others, { ...item, turn }]);
  }

  const dragId = drag?.id ?? null;
  const dragSpot = drag ? locate(drag.x, drag.y) : null;
  const dragOutside = drag ? !onFloor(dragSpot) : false;
  const dragOk =
    drag && dragSpot && !dragOutside
      ? canPlace(dragSpot, drag.id, drag.turn, placed.filter((item) => item.id !== drag.id))
      : false;
  const active = placed.find((item) => item.id === selected) ?? null;

  let verdict = "Drag a piece onto the floor";
  let tone: "idle" | "fit" | "miss" = "idle";
  if (drag && dragOutside && drag.fromRoom) {
    verdict = "Out of the room";
    tone = "miss";
  } else if (drag && dragOutside) {
    verdict = "Drop it on the floor";
    tone = "idle";
  } else if (drag) {
    verdict = dragOk ? "Fits in this example" : "Doesn't fit";
    tone = dragOk ? "fit" : "miss";
  } else if (reject) {
    verdict = "Doesn't fit";
    tone = "miss";
  } else if (placed.length > 0) {
    verdict = "Fits in this example";
    tone = "fit";
  }

  const back = floorPoint(0, 0);
  const right = floorPoint(1, 0);
  const front = floorPoint(1, 1);
  const left = floorPoint(0, 1);
  const floor = `${back.x},${back.y} ${right.x},${right.y} ${front.x},${front.y} ${left.x},${left.y}`;
  const leftWall = `${back.x},${back.y} ${left.x},${left.y} ${left.x},${left.y - WALL} ${back.x},${back.y - WALL}`;
  const backWall = `${back.x},${back.y} ${right.x},${right.y} ${right.x},${right.y - WALL} ${back.x},${back.y - WALL}`;
  const ordered = [...placed].sort((a, b) => a.u + a.v - (b.u + b.v));

  return (
    <div className="sketch" id="sketch">
      <div className="play">
        <ul className="catalog" aria-label="Furniture">
          {PIECES.map((piece) => {
            const inRoom = placed.some((item) => item.id === piece.id);
            return (
              <li key={piece.id}>
                <button
                  type="button"
                  className={inRoom ? "catalog-item is-placed" : "catalog-item"}
                  aria-pressed={inRoom}
                  aria-label={`${piece.name}. Drag it into the room.`}
                  onPointerDown={(event) => startDrag(piece.id, false, event)}
                  onPointerUp={finishDrag}
                  onPointerCancel={cancelDrag}
                >
                  <MiniArt id={piece.id} turn={0} />
                  <span>{piece.name}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="scene-wrap">
          <motion.div
            className="scene"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <svg ref={svgRef} className="room-svg" viewBox="88 12 284 252" role="group" aria-label="Example room">
              <polygon className="wall wall-left" points={leftWall} />
              <polygon className="wall wall-back" points={backWall} />
              <polygon className={dragOk ? "floor is-hot" : "floor"} points={floor} />
              <g className="floor-grid" aria-hidden="true">
                {[0.25, 0.5, 0.75].map((mark) => {
                  const across = [floorPoint(mark, 0), floorPoint(mark, 1)];
                  const depth = [floorPoint(0, mark), floorPoint(1, mark)];
                  return (
                    <g key={mark}>
                      <line x1={across[0].x} y1={across[0].y} x2={across[1].x} y2={across[1].y} />
                      <line x1={depth[0].x} y1={depth[0].y} x2={depth[1].x} y2={depth[1].y} />
                    </g>
                  );
                })}
              </g>
              {placed.length === 0 && !drag && (
                <text className="floor-hint" x={floorPoint(0.5, 0.55).x} y={floorPoint(0.5, 0.55).y}>
                  Drop pieces here
                </text>
              )}
              {ordered.map((item) => (
                <g
                  key={item.id}
                  className={`furn${item.id === selected ? " is-selected" : ""}${dragId === item.id ? " is-dragging" : ""}`}
                  data-turn={item.turn}
                  tabIndex={0}
                  role="button"
                  aria-label={`${pieceById(item.id).name}. Drag to move it. Use the arrows to turn it. Drag it out of the room to remove it.`}
                  onPointerDown={(event) => startDrag(item.id, true, event)}
                  onPointerUp={finishDrag}
                  onPointerCancel={cancelDrag}
                  onDoubleClick={() => rotate(item.id)}
                  onKeyDown={(event) => {
                    const step = event.shiftKey ? 0.08 : 0.04;
                    if (event.key === "ArrowLeft") nudge(item.id, -step, 0);
                    else if (event.key === "ArrowRight") nudge(item.id, step, 0);
                    else if (event.key === "ArrowUp") nudge(item.id, 0, -step);
                    else if (event.key === "ArrowDown") nudge(item.id, 0, step);
                    else if (event.key === "r" || event.key === "R") rotate(item.id);
                    else return;
                    event.preventDefault();
                  }}
                >
                  {furnitureShapes(item.id, item.u, item.v, item.turn, roomProject).map((shape, index) => (
                    <polygon
                      key={index}
                      points={shape.points}
                      fill={shape.fill}
                      className={shape.body ? "body" : undefined}
                    />
                  ))}
                </g>
              ))}
            </svg>
            {active && dragId !== active.id && (
              <div className="spin" style={arrowAnchor(active)}>
                <button type="button" aria-label={`Turn ${pieceById(active.id).name} left`} onClick={() => rotate(active.id, -1)}>
                  <SpinIcon dir={-1} />
                </button>
                <button type="button" aria-label={`Turn ${pieceById(active.id).name} right`} onClick={() => rotate(active.id, 1)}>
                  <SpinIcon dir={1} />
                </button>
              </div>
            )}
          </motion.div>
          <p className={`verdict is-${tone}`} role="status">
            {verdict}
          </p>
        </div>
      </div>
      <p className="sketch-note">
        Drag the pieces onto the floor. Use the arrows to turn the selected one. Drag a piece out
        of the room to remove it. This is a sketch of the idea, not a measurement of your room.
      </p>
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <MiniArt id={drag.id} turn={drag.turn} />
        </div>
      )}
    </div>
  );
}

function arrowAnchor(item: Placed): { left: string; top: string } {
  const { wu, hv } = dims(item.id, item.turn);
  const point = roomProject(item.u + wu / 2 + 0.04, item.v - hv / 2, 6);
  const left = Math.min(90, Math.max(10, ((point.x - 88) / 284) * 100));
  const top = Math.min(86, Math.max(12, ((point.y - 12) / 252) * 100));
  return { left: `${left}%`, top: `${top}%` };
}

function SpinIcon({ dir }: { dir: -1 | 1 }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={
          dir === 1
            ? "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
            : "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={dir === 1 ? "M21 3v5h-5" : "M3 3v5h5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniArt({ id, turn }: { id: PieceId; turn: Turn }) {
  return (
    <svg className="glyph" viewBox="0 0 72 64" aria-hidden="true">
      {furnitureShapes(id, 0.5, 0.5, turn, thumbProject).map((shape, index) => (
        <polygon key={index} points={shape.points} fill={shape.fill} />
      ))}
    </svg>
  );
}
