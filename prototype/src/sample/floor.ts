// A made-up floor with known answers, so the whole flow can be tried in ten
// seconds with no paper, no room and no photo. Nothing here is a real room:
// the floor is flat by construction and the camera is an ideal pinhole, the
// same one the tests use (tests/scene.ts). Because we choose every position,
// the true value for whatever was tapped can be printed beside the measured one.
//
// This file is the geometry only. Drawing it is in ./draw.
import type { Pt } from "../measure/homography";
import { dist } from "../measure/homography";
import { outlineMeasures } from "../measure/outline";
import type { Group } from "../app/state";

export const SAMPLE_SIZE = { w: 3000, h: 4000 }; // the made-up photo, pixels

const HEIGHT = 1400; // camera height above the floor, mm
const BACK = 1500; // camera stands this far behind the floor origin, mm
const TILT = (35 * Math.PI) / 180; // camera pitched down from level
const FOCAL = 3200; // focal length in pixels
const CENTRE = { x: SAMPLE_SIZE.w / 2, y: SAMPLE_SIZE.h / 2 };

/** Where a floor point (mm) lands in the made-up photo (pixels). */
export function projectFloor(floor: Pt): Pt {
  const dy = floor.y + BACK;
  const forward = dy * Math.cos(TILT) + HEIGHT * Math.sin(TILT);
  const down = HEIGHT * Math.cos(TILT) - dy * Math.sin(TILT);
  return { x: CENTRE.x + (FOCAL * floor.x) / forward, y: CENTRE.y + (FOCAL * down) / forward };
}

/** The floor spot (mm) a photo pixel of the made-up photo shows: projectFloor
 * backwards. The page drew this floor, so this is exact, with no plane map
 * and no taps on a sheet in between. Null at or above the horizon. */
export function floorOfPhoto(photo: Pt): Pt | null {
  const u = (photo.x - CENTRE.x) / FOCAL;
  const v = (photo.y - CENTRE.y) / FOCAL;
  const below = v * Math.cos(TILT) + Math.sin(TILT);
  if (!(below > 1e-9)) return null;
  const dy = (HEIGHT * (Math.cos(TILT) - v * Math.sin(TILT))) / below;
  return { x: u * (dy * Math.cos(TILT) + HEIGHT * Math.sin(TILT)), y: dy - BACK };
}

/** A sheet `long` by `short` mm centred on `centre`, turned by `turnDeg`. */
function sheetAt(long: number, short: number, centre: Pt, turnDeg: number): Pt[] {
  const cos = Math.cos((turnDeg * Math.PI) / 180);
  const sin = Math.sin((turnDeg * Math.PI) / 180);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({
    x: centre.x + (i * long * cos - j * short * sin) / 2,
    y: centre.y + (i * long * sin + j * short * cos) / 2,
  }));
}

/** Everything on the made-up floor, in floor millimetres. */
export const SAMPLE_FLOOR: Record<Group, Pt[]> = {
  /** A US Letter sheet, long side across the view. */
  sheet: [{ x: 0, y: 0 }, { x: 279.4, y: 0 }, { x: 279.4, y: 215.9 }, { x: 0, y: 215.9 }],
  /** Two marked spots exactly one metre apart. */
  ends: [{ x: -300, y: 400 }, { x: 700, y: 400 }],
  /** An L-shaped outline painted on the floor, corners in order. */
  room: [
    { x: -700, y: -300 }, { x: 800, y: -300 }, { x: 800, y: 1200 },
    { x: 200, y: 1200 }, { x: 200, y: 2200 }, { x: -700, y: 2200 },
  ],
  /** The two sides of the narrow arm of the L, exactly 90 cm apart. */
  gap: [{ x: -700, y: 1700 }, { x: 200, y: 1700 }],
  /** A second sheet (A4) lying in the narrow arm, turned 20 degrees. */
  second: sheetAt(297, 210, { x: -250, y: 1960 }, 20),
  /** A stick exactly one metre long. */
  span: [{ x: -550, y: 150 }, { x: -550, y: 1150 }],
};

const room = outlineMeasures(SAMPLE_FLOOR.room) as { ok: true; walls: number[]; perimeter: number; area: number };

/** The true values, in mm and mm squared. */
export const SAMPLE_TRUTH = {
  distance: dist(SAMPLE_FLOOR.ends[0], SAMPLE_FLOOR.ends[1]),
  walls: room.walls,
  perimeter: room.perimeter,
  area: room.area,
  gap: dist(SAMPLE_FLOOR.gap[0], SAMPLE_FLOOR.gap[1]),
  span: dist(SAMPLE_FLOOR.span[0], SAMPLE_FLOOR.span[1]),
  secondPaper: "a4",
};

/** Taps placed for the person sit exactly on the true spots and count as
 * placed zoomed right in: this many photo pixels of tap error. */
export const SAMPLE_TAP_SIGMA = 1.5;

/** The taps for one group, in photo pixels, in the order they are placed. */
export const sampleTaps = (group: Group): Pt[] =>
  SAMPLE_FLOOR[group].map((floor) => ({ ...projectFloor(floor), s: SAMPLE_TAP_SIGMA }));
