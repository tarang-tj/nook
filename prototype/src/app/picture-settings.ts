// Some settings describe one picture: which paper each sheet is, which way
// round it lies, how long the known length is. They must not outlive that
// picture, or the next one is solved from the last one's answers with nothing
// on screen to show it. The made-up floor knows its own papers and sets them,
// and its papers must not outlive it either. Pure.
import { REFERENCES } from "../measure/references";
import { SAMPLE_TRUTH } from "../sample/floor";
import type { Settings } from "./numbers";

/** The settings to start a picture with: a photo that was just loaded, the
 * made-up floor, or the same picture after Start over. The units, the first
 * paper for a photo, and the thing's size are the person's and are kept. */
export function forNewPicture(set: Settings, sample: boolean): Settings {
  return {
    ...set,
    paper: sample ? SAMPLE_TRUTH.paper : set.paper,
    swap: false,
    paper2: sample ? SAMPLE_TRUTH.secondPaper : REFERENCES[0].id,
    swap2: false,
    spanMm: NaN,
  };
}

/** The person's own first paper, set aside while the made-up floor shows the
 * paper it was painted with. Null while a photo is showing. */
export type Aside = { paper: string } | null;

/** Start a picture: its settings, and what is set aside while it shows. The
 * made-up floor takes over the first paper, so the person's choice is kept
 * to one side and put back for the next photo. Without that an A4 sheet in
 * the next photo would be solved as US Letter because a sample was looked at. */
export function startPicture(set: Settings, sample: boolean, aside: Aside): { set: Settings; aside: Aside } {
  const own = aside?.paper ?? set.paper;
  return { set: forNewPicture({ ...set, paper: own }, sample), aside: sample ? { paper: own } : null };
}

/** The settings after an extra reference is removed: what was set for it goes too. */
export function withoutExtra(set: Settings, extra: "second" | "span", sample = false): Settings {
  const fresh = forNewPicture(set, sample);
  return extra === "span" ? { ...set, spanMm: fresh.spanMm } : { ...set, paper2: fresh.paper2, swap2: fresh.swap2 };
}
