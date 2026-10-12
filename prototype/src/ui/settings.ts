// The choices made with the controls, read off the page in one place.
import type { Settings } from "../app/numbers";
import { isUnit } from "../measure/units";
import { el } from "./dom";

const input = (id: string) => el<HTMLInputElement>(id);

export function readSettings(): Settings {
  const unit = input("unit").value;
  return {
    paper: input("paper").value,
    swap: input("swap").checked,
    unit: isUnit(unit) ? unit : "cm",
    paper2: "a4",
    swap2: false,
    spanLength: NaN,
    thingWidth: input("thing-width").valueAsNumber,
    thingDepth: input("thing-depth").valueAsNumber,
  };
}

/** Redraw when any of these controls changes. */
export const SETTING_IDS = ["swap", "paper", "unit", "thing-width", "thing-depth"];
