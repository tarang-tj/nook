// A made-up scene for the tests: a flat floor photographed by an ideal
// pinhole camera. Because we choose the camera, we know the true answer.
import type { Pt } from "../src/measure/homography";

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
