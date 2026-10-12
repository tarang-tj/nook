// The choices made with the controls, read off the page in one place.
import type { Settings } from "../app/numbers";
import { EMPTY_LENGTH, stepTyped, typedFrom, type TypedLength } from "../app/typed-length";
import { isUnit, type Unit } from "../measure/units";
import { el } from "./dom";

const input = (id: string) => el<HTMLInputElement>(id);

/** The boxes a length is typed into, by the setting each one fills. */
const LENGTH_BOX = { spanMm: "span-length", thingWidthMm: "thing-width", thingDepthMm: "thing-depth" } as const;
type LengthKey = keyof typeof LENGTH_BOX;
const KEYS = Object.keys(LENGTH_BOX) as LengthKey[];

/** What each box held at the last look, and the unit that was showing. */
const held: Record<LengthKey, TypedLength> = { spanMm: EMPTY_LENGTH, thingWidthMm: EMPTY_LENGTH, thingDepthMm: EMPTY_LENGTH };
let shownUnit: Unit | null = null;

const unitNow = (): Unit => {
  const unit = input("unit").value;
  return isUnit(unit) ? unit : "cm";
};

export function readSettings(): Settings {
  const unit = unitNow();
  for (const key of KEYS) {
    const box = input(LENGTH_BOX[key]);
    held[key] = stepTyped(held[key], box.value, shownUnit ?? unit, unit);
    // Only when Units changed: the same length, written in the new unit.
    if (box.value !== held[key].text) box.value = held[key].text;
  }
  shownUnit = unit;
  return {
    paper: input("paper").value,
    swap: input("swap").checked,
    unit,
    paper2: input("paper2").value,
    swap2: input("swap2").checked,
    spanMm: held.spanMm.mm,
    thingWidthMm: held.thingWidthMm.mm,
    thingDepthMm: held.thingDepthMm.mm,
  };
}

/** Fill a length box with a length the page knows, or empty it (NaN). */
export function setLength(key: LengthKey, mm: number): void {
  held[key] = typedFrom(mm, shownUnit ?? unitNow());
  input(LENGTH_BOX[key]).value = held[key].text;
}

/** Redraw when any of these controls changes. */
export const SETTING_IDS = ["swap", "paper", "unit", "thing-width", "thing-depth", "paper2", "swap2", "span-length"];
