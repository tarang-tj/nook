// A made-up scene for the tests: a flat floor photographed by an ideal
// pinhole camera. Because we choose the camera, we know the true answer.
import type { FusedInput } from "../src/measure/fused";
import type { Pt } from "../src/measure/homography";
import { referenceById } from "../src/measure/references";

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

// ---- More of the same scene, for the tests that fuse several known sizes ----

/** The corners of a sheet lying on the floor (mm), centred at `centre` and
 * turned by `turnDeg`, in the order LETTER_ON_FLOOR uses. */
export function sheetOnFloor(long: number, short: number, centre: Pt, turnDeg: number): Pt[] {
  const cos = Math.cos((turnDeg * Math.PI) / 180);
  const sin = Math.sin((turnDeg * Math.PI) / 180);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({
    x: centre.x + (i * long * cos - j * short * sin) / 2,
    y: centre.y + (i * long * sin + j * short * cos) / 2,
  }));
}

/** The span every accuracy test measures: exactly one metre, about four
 * metres past the Letter sheet, partly across the view and partly away. */
export const FAR_SPAN = { a: { x: -400, y: 3700 }, b: { x: 400, y: 4300 }, mm: 1000 };
/** A second sheet (A4) lying out near that span, turned 20 degrees. */
export const A4_FAR_ON_FLOOR: Pt[] = sheetOnFloor(297, 210, { x: 550, y: 3500 }, 20);
/** A length someone taped out near that span: exactly one metre. */
export const KNOWN_SPAN = { a: { x: -900, y: 3400 }, b: { x: -300, y: 4200 }, mm: 1000 };

/** Taps as a person makes them: each true photo point moved by bell-curve
 * noise of `sigma` photo pixels, and carrying that sigma as its `s`. */
export const tapped = (floor: Pt[], sigma: number, normal: () => number): Pt[] =>
  floor.map((f) => {
    const p = project(f);
    return { x: p.x + sigma * normal(), y: p.y + sigma * normal(), s: sigma };
  });

export function median(values: number[]): number {
  const v = [...values].sort((p, q) => p - q);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

export type Case = "one sheet" | "two sheets" | "one sheet and one known length";

/** One simulated retake of the photo: every tap lands `sigma` photo pixels
 * off. Returns what the page would hand to solveFused, and the two taps on
 * the ends of FAR_SPAN. */
export function retake(which: Case, sigma: number, normal: () => number): { input: FusedInput; a: Pt; b: Pt } {
  const input: FusedInput = {
    sheet: { corners: tapped(LETTER_ON_FLOOR, sigma, normal), reference: referenceById("letter"), swapSides: false },
  };
  if (which === "two sheets")
    input.secondSheet = { corners: tapped(A4_FAR_ON_FLOOR, sigma, normal), reference: referenceById("a4") };
  if (which === "one sheet and one known length") {
    const [a, b] = tapped([KNOWN_SPAN.a, KNOWN_SPAN.b], sigma, normal);
    input.spans = [{ a, b, lengthMm: KNOWN_SPAN.mm }];
  }
  const [a, b] = tapped([FAR_SPAN.a, FAR_SPAN.b], sigma, normal);
  return { input, a, b };
}
