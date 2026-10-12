// Geometry for the corner-walk room scan.
// All positions come from WebXR (local-floor reference space, Y up, metres).
// Floor corners sit at Y ≈ 0; the ceiling tap gives the room height via Y.
// Wall lengths and the floor area are computed in the XZ plane so that small
// Y drift in tracked floor positions does not distort the numbers.
//
// No error bars are given. Phone tracking can drift as you walk, and we do
// not have an honest model of how much. The page says so next to every number.

/** A point in WebXR local-floor space (metres, Y up). */
export type Pt3 = { x: number; y: number; z: number };

/** A completed room ready to be drawn and measured. */
export type ScanRoom = {
  /** Floor corners in placement order, metres. */
  corners: Pt3[];
  /** Room height in metres (ceiling Y above floor Y = 0). */
  height: number;
  /** Whether the height came from a ceiling tap or was typed by hand. */
  heightSource: "measured" | "typed";
};

export type ScanMeasures =
  | {
      ok: true;
      /** Length of each wall in metres, closing wall included. */
      walls: number[];
      /** Total perimeter in metres. */
      perimeter: number;
      /** Floor area in square metres. */
      area: number;
    }
  | { ok: false; reason: string };

/** How close a new floor corner must be to the first to offer auto-close, m. */
export const CLOSE_SNAP_M = 0.3;

/** Straight-line distance in the XZ (floor) plane, metres. */
export const distXZ = (a: Pt3, b: Pt3): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** Signed cross product of vectors OA and OB projected onto Y (XZ plane). */
const crossXZ = (o: Pt3, a: Pt3, b: Pt3): number =>
  (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** True when segments ab and cd properly cross in the XZ plane
 * (shared endpoints do not count as crossing). */
const segmentsCrossXZ = (a: Pt3, b: Pt3, c: Pt3, d: Pt3): boolean =>
  crossXZ(c, d, a) * crossXZ(c, d, b) < 0 &&
  crossXZ(a, b, c) * crossXZ(a, b, d) < 0;

/** True when any two non-adjacent walls of the closed outline cross in XZ. */
export function selfCrossesXZ(corners: Pt3[]): boolean {
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // shared endpoint through the closing wall
      if (
        segmentsCrossXZ(
          corners[i],
          corners[(i + 1) % n],
          corners[j],
          corners[(j + 1) % n],
        )
      )
        return true;
    }
  }
  return false;
}

/** Shoelace area of a polygon in the XZ plane, square metres. Always positive. */
export function polygonAreaXZ(corners: Pt3[]): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

/** Length of each wall in metres (XZ plane), closing wall included. */
export const wallLengthsM = (corners: Pt3[]): number[] =>
  corners.map((p, i) => distXZ(p, corners[(i + 1) % corners.length]));

/** True when `candidate` is within CLOSE_SNAP_M of the first corner in XZ
 * and the outline already has at least three corners placed. */
export const isNearFirst = (corners: Pt3[], candidate: Pt3): boolean =>
  corners.length >= 3 && distXZ(candidate, corners[0]) <= CLOSE_SNAP_M;

/** Why these corners cannot form a valid room outline, or null when they can. */
export function scanProblem(corners: Pt3[]): string | null {
  if (corners.length < 3)
    return `An outline needs at least three corners; this one has ${corners.length}.`;
  if (selfCrossesXZ(corners))
    return "The outline crosses itself, so it has no single area. Walk the corners in order, going round the room.";
  if (!(polygonAreaXZ(corners) > 0))
    return "The corners are all in one line, so they enclose no floor area.";
  return null;
}

/** Wall lengths, perimeter, and floor area from floor positions, or the reason
 * in words when they cannot be given. */
export function scanMeasures(corners: Pt3[]): ScanMeasures {
  const reason = scanProblem(corners);
  if (reason) return { ok: false, reason };
  const walls = wallLengthsM(corners);
  return {
    ok: true,
    walls,
    perimeter: walls.reduce((t, w) => t + w, 0),
    area: polygonAreaXZ(corners),
  };
}
