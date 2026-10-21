import { prism, pts, wall, type Box, type Proj, type Shape } from "./geometry";
import type { Feature } from "./rooms";

export type FeatureArt = {
  /** Flat marks drawn under every piece: a door leaf or window on the wall, a swing zone on the floor. */
  flat: Shape[];
  /** Solid parts painted in depth order with the furniture. */
  solid: Shape[];
  /** Depth used to sort solids against furniture, like a piece's u + v. */
  key: number;
};

const ARC_STEPS = 8;

/** A quad on the wall plane the feature sits on, from y0 to y1. */
function onWall(project: Proj, feature: Feature, y0: number, y1: number, fill: string): Shape {
  const { u0, u1, v0, v1 } = feature.box;
  const a = feature.wall === "back" ? [u0, 0] : [0, v0];
  const b = feature.wall === "back" ? [u1, 0] : [0, v1];
  return {
    points: pts([project(a[0], a[1], y0), project(b[0], b[1], y0), project(b[0], b[1], y1), project(a[0], a[1], y1)]),
    fill,
    depth: -2,
  };
}

/** The blocked square, then the quarter circle the door sweeps, hinged on the far end of its opening. */
function swing(project: Proj, box: Box, side: Feature["wall"]): Shape[] {
  const square: Shape = {
    points: pts([project(box.u0, box.v0), project(box.u1, box.v0), project(box.u1, box.v1), project(box.u0, box.v1)]),
    fill: "rgba(255, 176, 0, 0.05)",
    depth: -1,
  };
  const r = side === "back" ? box.u1 - box.u0 : box.v1 - box.v0;
  const points = [side === "back" ? project(box.u1, 0) : project(0, box.v0)];
  for (let i = 0; i <= ARC_STEPS; i += 1) {
    const t = (i / ARC_STEPS) * (Math.PI / 2);
    points.push(
      side === "back"
        ? project(box.u1 - r * Math.cos(t), r * Math.sin(t))
        : project(r * Math.sin(t), box.v0 + r * Math.cos(t)),
    );
  }
  return [square, { points: pts(points), fill: "rgba(255, 176, 0, 0.1)", depth: -1 }];
}

export function featureArt(feature: Feature, project: Proj): FeatureArt {
  const { box } = feature;
  const key = (box.u0 + box.u1) / 2 + (box.v0 + box.v1) / 2;
  const front = feature.wall === "back" ? "v" : "u";

  if (feature.kind === "door") {
    return {
      flat: [onWall(project, feature, 0, 76, "#5c4b38"), onWall(project, feature, 4, 72, "#6e5a44"), ...swing(project, box, feature.wall)],
      solid: [],
      key,
    };
  }

  if (feature.kind === "radiator") {
    return {
      flat: [onWall(project, feature, 34, 82, "rgba(255, 220, 170, 0.28)"), onWall(project, feature, 56, 58, "#3a342e")],
      solid: prism(project, box, 0, 12, "#b8c2cc", "#9aa6b2", "#8795a3"),
      key,
    };
  }

  const mid: Box =
    front === "v"
      ? { ...box, u0: (box.u0 + box.u1) / 2 - 0.003, u1: (box.u0 + box.u1) / 2 + 0.003 }
      : { ...box, v0: (box.v0 + box.v1) / 2 - 0.003, v1: (box.v0 + box.v1) / 2 + 0.003 };
  return {
    flat: [],
    solid: [
      ...prism(project, box, 0, 80, "#4a4038", "#3f3730", "#342d27"),
      wall(project, mid, 4, 76, front, "#241f1a"),
    ],
    key,
  };
}
