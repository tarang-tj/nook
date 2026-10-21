// Box and prism helpers for the isometric room sketch. Pure functions, no React.

export type Turn = 0 | 1 | 2 | 3;
export type Spot = { u: number; v: number };
export type Point = { x: number; y: number };
export type Proj = (u: number, v: number, lift?: number) => Point;
export type Shape = { points: string; fill: string; body?: boolean; depth: number };
export type Box = { u0: number; u1: number; v0: number; v1: number };

export function stepTurn(turn: Turn, dir: -1 | 1 | 2): Turn {
  return ((turn + dir + 4) % 4) as Turn;
}

export function pts(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export function prism(
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

export function edge(box: Box, turn: Turn, thick: number): Box {
  const du = (box.u1 - box.u0) * thick;
  const dv = (box.v1 - box.v0) * thick;
  if (turn === 0) return { ...box, v1: box.v0 + dv };
  if (turn === 1) return { ...box, u0: box.u1 - du };
  if (turn === 2) return { ...box, v0: box.v1 - dv };
  return { ...box, u1: box.u0 + du };
}

export function rest(box: Box, turn: Turn, thick: number): Box {
  const du = (box.u1 - box.u0) * thick;
  const dv = (box.v1 - box.v0) * thick;
  if (turn === 0) return { ...box, v0: box.v0 + dv };
  if (turn === 1) return { ...box, u1: box.u1 - du };
  if (turn === 2) return { ...box, v1: box.v1 - dv };
  return { ...box, u0: box.u0 + du };
}

export function shrink(box: Box, amount: number): Box {
  const du = (box.u1 - box.u0) * amount;
  const dv = (box.v1 - box.v0) * amount;
  return { u0: box.u0 + du, u1: box.u1 - du, v0: box.v0 + dv, v1: box.v1 - dv };
}

export function slab(box: Box, turn: Turn, depth: number): Box {
  const along = turn === 0 || turn === 2 ? box.v1 - box.v0 : box.u1 - box.u0;
  const d = Math.min(Math.max(depth, 0.02), along * 0.78);
  if (turn === 0) return { ...box, v1: box.v0 + d };
  if (turn === 2) return { ...box, v0: box.v1 - d };
  if (turn === 1) return { ...box, u0: box.u1 - d };
  return { ...box, u1: box.u0 + d };
}

export function insetAcross(box: Box, turn: Turn, amount: number): Box {
  if (turn === 1 || turn === 3) {
    const dv = (box.v1 - box.v0) * amount;
    return { ...box, v0: box.v0 + dv, v1: box.v1 - dv };
  }
  const du = (box.u1 - box.u0) * amount;
  return { ...box, u0: box.u0 + du, u1: box.u1 - du };
}

export function exclude(parent: Box, cut: Box, turn: Turn): Box {
  if (turn === 0) return { ...parent, v0: cut.v1 };
  if (turn === 2) return { ...parent, v1: cut.v0 };
  if (turn === 1) return { ...parent, u1: cut.u0 };
  return { ...parent, u0: cut.u1 };
}

export function fitInside(zone: Box, wu: number, hv: number): Box {
  const du = Math.min(wu, (zone.u1 - zone.u0) * 0.94);
  const dv = Math.min(hv, (zone.v1 - zone.v0) * 0.94);
  const cu = (zone.u0 + zone.u1) / 2;
  const cv = (zone.v0 + zone.v1) / 2;
  return { u0: cu - du / 2, u1: cu + du / 2, v0: cv - dv / 2, v1: cv + dv / 2 };
}

export function wall(project: Proj, box: Box, y0: number, y1: number, side: "u" | "v", fill: string): Shape {
  const { u0, u1, v0, v1 } = box;
  const at = (u: number, v: number, y: number) => project(u, v, y);
  const points =
    side === "v"
      ? [at(u0, v1, y0), at(u1, v1, y0), at(u1, v1, y1), at(u0, v1, y1)]
      : [at(u1, v0, y0), at(u1, v1, y0), at(u1, v1, y1), at(u1, v0, y1)];
  const depth = side === "v" ? (u0 + u1) / 2 + v1 + 0.01 : u1 + (v0 + v1) / 2 + 0.01;
  return { points: pts(points), fill, depth };
}

export function insetFace(box: Box, side: "u" | "v", pad: number): Box {
  if (side === "v") {
    const du = (box.u1 - box.u0) * pad;
    return { ...box, u0: box.u0 + du, u1: box.u1 - du };
  }
  const dv = (box.v1 - box.v0) * pad;
  return { ...box, v0: box.v0 + dv, v1: box.v1 - dv };
}

export function faceStrip(box: Box, side: "u" | "v"): Box {
  if (side === "v") {
    const w = (box.u1 - box.u0) * 0.14;
    return { ...box, u0: box.u1 - w };
  }
  const w = (box.v1 - box.v0) * 0.14;
  return { ...box, v0: box.v1 - w };
}

export function pair(box: Box, turn: Turn): [Box, Box] {
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

export type Part = {
  box: Box;
  y0: number;
  y1: number;
  top: string;
  faceU: string;
  faceV: string;
  body?: boolean;
  bias?: number;
};

export function paintParts(project: Proj, parts: Part[]): Shape[] {
  return parts
    .map((part, order) => ({ ...part, order }))
    .sort(
      (a, b) =>
        a.box.u0 + a.box.v0 + (a.bias ?? 0) - (b.box.u0 + b.box.v0 + (b.bias ?? 0)) || a.order - b.order,
    )
    .flatMap((part) => prism(project, part.box, part.y0, part.y1, part.top, part.faceU, part.faceV, part.body));
}
