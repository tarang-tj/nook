// A made-up scene for the tests: a flat floor photographed by an ideal
// pinhole camera. Because we choose the camera, we know the true answer.
import type { Pt } from "../src/measure/homography";
import { solveHomography } from "../src/measure/homography";
import { floorPoints } from "../src/measure/outline";
import { jitterPoint, type Draw } from "../src/measure/spread";

const HEIGHT = 1400; // camera height above the floor, mm
const BACK = 1500; // camera stands this far behind the floor origin, mm
const TILT = (35 * Math.PI) / 180; // camera pitched down from level
const FOCAL = 3200; // focal length in pixels (a made-up value, like the rest)
const CENTRE = { x: 1500, y: 2000 }; // middle of a 3000 x 4000 photo

/** Where a floor point (mm) lands in the photo (pixels). */
export function project(floor: Pt): Pt {
  const dx = floor.x;
  const dy = floor.y + BACK;
  const dz = -HEIGHT;
  const forward = dy * Math.cos(TILT) - dz * Math.sin(TILT);
  const down = -dy * Math.sin(TILT) - dz * Math.cos(TILT);
  return {
    x: CENTRE.x + (FOCAL * dx) / forward,
    y: CENTRE.y + (FOCAL * down) / forward,
  };
}

/** A US Letter sheet on the floor, long side across the view, in mm. */
export const LETTER_ON_FLOOR: Pt[] = [
  { x: 0, y: 0 },
  { x: 279.4, y: 0 },
  { x: 279.4, y: 215.9 },
  { x: 0, y: 215.9 },
];

export const letterInPhoto = (): Pt[] => LETTER_ON_FLOOR.map(project);

// --- Rooms, retakes and the taps-to-number closure, for the outline, plan and fit tests.
/** A room 1.5 m by 2.5 m round the sheet, corners in order. All four corners
 * land inside the 3000 x 4000 photo. */
export const ROOM_ON_FLOOR: Pt[] = [
  { x: -700, y: -300 },
  { x: 800, y: -300 },
  { x: 800, y: 2200 },
  { x: -700, y: 2200 },
];
export const ROOM_TRUTH = { walls: [1500, 2500, 1500, 2500], perimeter: 8000, area: 3_750_000 };

/** The same room with a 600 by 1000 mm bite out of its far right corner. */
export const L_ROOM_ON_FLOOR: Pt[] = [
  { x: -700, y: -300 },
  { x: 800, y: -300 },
  { x: 800, y: 1200 },
  { x: 200, y: 1200 },
  { x: 200, y: 2200 },
  { x: -700, y: 2200 },
];
export const L_ROOM_TRUTH = { walls: [1500, 1500, 600, 1000, 900, 2500], perimeter: 8000, area: 3_150_000 };

/** One retake: every tap lands `sigmaPx` (one standard deviation) off where
 * it was meant, and remembers that as its own `s`. */
export const retake = (taps: Pt[], sigmaPx: number, normal: Draw): Pt[] =>
  taps.map((p) => ({ ...jitterPoint({ ...p, s: sigmaPx }, normal), s: sigmaPx }));

/** The closure spreadOf wants: move every tap, solve the plane map from the
 * sheet's taps, put the other taps on the floor and measure them. The floor
 * positions come out in this scene's own millimetres. */
export const fromTaps =
  (sheet: Pt[], taps: Pt[], measure: (floor: Pt[]) => number | null) =>
  (draw: Draw | null): number | null => {
    const move = (p: Pt): Pt => (draw ? jitterPoint(p, draw) : p);
    const h = solveHomography(sheet.map(move), LETTER_ON_FLOOR);
    const floor = h ? floorPoints(h, taps.map(move)) : null;
    return floor ? measure(floor) : null;
  };
