// Adapted from SPECTRA (c) 2026 Tarang Jammalamadaka, used here by its author.
//
// The one function the page calls: six taps in, a distance with an error bar
// out, or a plain reason why there is no distance. It never returns NaN or 0.
import { dist, planeDistance, type Pt } from "./homography";
import { degenerateReason, orderCorners, solveSheet } from "./sheet";
import { BASIS, distanceSpread, TAP_SIGMA_SCREEN_PX } from "./monte-carlo";
import { formatMeasured } from "./format";
import { measured, type Measured } from "./noise";
import type { Reference } from "./references";
import { fromMm, type Unit } from "./units";

export type Outcome =
  | {
      ok: true;
      /** The distance and its bar, in the chosen unit. */
      measured: Measured;
      /** For example "123.4 ± 0.6 cm". */
      text: string;
      /** Set when some simulated taps had to be dropped. */
      warning: string | null;
    }
  | { ok: false; reason: string };

const fail = (reason: string): Outcome => ({ ok: false, reason });

export type Input = {
  /** Four taps on the sheet's corners, any order, photo pixels. */
  corners: Pt[];
  /** Two taps on the floor, photo pixels. */
  a: Pt;
  b: Pt;
  reference: Reference;
  unit: Unit;
  /** Flip the guess about which side of the sheet is the long one. */
  swapSides?: boolean;
  /** Tap uncertainty in photo pixels for points that do not carry their own. */
  sigmaPx?: number;
};

export function measureFloorDistance(input: Input): Outcome {
  const { corners, a, b, reference, unit } = input;
  const ordered = orderCorners(corners);
  const why = degenerateReason(ordered);
  if (why) return fail(`The four corners cannot be used: ${why}.`);

  const sheet = solveSheet(ordered, reference.long, reference.short, input.swapSides ?? false);
  if (!sheet) return fail("The four corners do not describe a flat sheet seen by a camera.");

  if (dist(a, b) < 2) return fail("The two floor points are on the same spot.");

  const mm = planeDistance(sheet.h, a, b);
  if (mm === null || !Number.isFinite(mm) || mm <= 0)
    return fail(
      "A floor point is at or above the floor's horizon in this photo, so it has no position on the floor.",
    );

  const spread = distanceSpread(sheet, a, b, input.sigmaPx ?? TAP_SIGMA_SCREEN_PX);
  if (!spread || !(spread.sd > 0))
    return fail(
      "No trustworthy error bar here: small changes in the taps swing the answer too far. " +
        "Move the points closer to the sheet, or retake the photo from higher up.",
    );

  const result = measured(fromMm(mm, unit), fromMm(2 * spread.sd, unit), unit, BASIS);
  return {
    ok: true,
    measured: result,
    text: formatMeasured(result),
    warning:
      spread.kept < 1
        ? `Only ${Math.floor(spread.kept * 100)}% of the simulated taps could be used. The bar is a lower bound here, so do not read this value as precise.`
        : null,
  };
}
