// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// A room outline on the floor: the corners in the order they were tapped, in
// millimetres. Plain numbers only. The error bar comes from wrapping each
// number in spreadOf (spread.ts), which calls this again for every simulated
// set of taps.
//
// Floor only. One photo and a flat sheet say nothing about height or walls,
// so a "wall" here is the line where a wall meets the floor.
import { applyHomography, dist, type Mat3, type Pt } from "./homography";
import { BASIS } from "./monte-carlo";
import { fromMm, type Unit } from "./units";

/** What the bar on a wall, the perimeter or the area covers, word for word.
 * The last part is from tests/outline.test.ts, which retakes a made-up room
 * a few hundred times and counts how often the bar holds the true value. */
export const OUTLINE_BASIS =
  `${BASIS} A wall here is the line where the wall meets the floor. Height is not measured. ` +
  "In simulated retakes of a made-up room with careful taps, the bar held the true value about 95 times in 100. " +
  "With sloppy taps most far walls were refused, and the bars still shown held it less often, " +
  "as low as 8 in 10 for the area. Read a wide bar as a rough guide.";

/** Corners closer than this are the same corner tapped twice, mm. */
const SAME_CORNER_MM = 1;

export type OutlineMeasures =
  | {
      ok: true;
      /** Wall i runs from corner i to corner i + 1; the last one closes the outline. mm. */
      walls: number[];
      /** mm. */
      perimeter: number;
      /** mm squared. */
      area: number;
    }
  | { ok: false; reason: string };

/** Photo taps to floor positions (mm) through a plane map. Null when any tap
 * is at or beyond the floor's horizon, where it has no floor position. */
export function floorPoints(h: Mat3, taps: Pt[]): Pt[] | null {
  const out: Pt[] = [];
  for (const tap of taps) {
    const p = applyHomography(h, tap);
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    out.push(p);
  }
  return out;
}

const cross = (o: Pt, a: Pt, b: Pt): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** Do segments ab and cd cross properly (touching ends do not count)? */
export const segmentsCross = (a: Pt, b: Pt, c: Pt, d: Pt): boolean =>
  cross(c, d, a) * cross(c, d, b) < 0 && cross(a, b, c) * cross(a, b, d) < 0;

/** True when two walls of the closed outline that are not neighbours cross. */
export function selfCrosses(corners: Pt[]): boolean {
  const n = corners.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // neighbours through the closing wall
      if (segmentsCross(corners[i], corners[(i + 1) % n], corners[j], corners[(j + 1) % n]))
        return true;
    }
  return false;
}

/** Length of each wall, the closing wall included. */
export const wallLengths = (corners: Pt[]): number[] =>
  corners.map((p, i) => dist(p, corners[(i + 1) % corners.length]));

/** Area of an outline that does not cross itself (the shoelace formula: half
 * the sum of the cross products of neighbouring corners). Either winding. */
export function polygonArea(corners: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Why these corners are not a room outline, or null when they are. */
export function outlineProblem(corners: Pt[]): string | null {
  if (corners.length < 3)
    return `An outline needs at least three corners, and this one has ${corners.length}.`;
  if (!corners.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    return "A corner has no position on the floor.";
  for (let i = 0; i < corners.length; i++)
    for (let j = i + 1; j < corners.length; j++)
      if (dist(corners[i], corners[j]) < SAME_CORNER_MM)
        return `Corners ${i + 1} and ${j + 1} are on the same spot.`;
  if (selfCrosses(corners))
    return "The outline crosses itself, so it has no single area. Tap the corners in order, going round the room.";
  if (!(polygonArea(corners) > 0)) return "The corners are all in one line, so they enclose no floor.";
  return null;
}

/** Every wall, the perimeter and the floor area from floor positions in mm,
 * or the reason in words. Never a guess, never NaN. */
export function outlineMeasures(corners: Pt[]): OutlineMeasures {
  const reason = outlineProblem(corners);
  if (reason) return { ok: false, reason };
  const walls = wallLengths(corners);
  return {
    ok: true,
    walls,
    perimeter: walls.reduce((total, wall) => total + wall, 0),
    area: polygonArea(corners),
  };
}

/** An area in mm squared as cm squared or square inches. */
export const areaFromMm2 = (mm2: number, unit: Unit): number => fromMm(fromMm(mm2, unit), unit);
export const areaUnit = (unit: Unit): string => `${unit}²`;
