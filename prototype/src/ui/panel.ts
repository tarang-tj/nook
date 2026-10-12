// Copies the report's words onto the page. No deciding happens here.
import type { Plan } from "../measure/plan";
import { UNCHECKED, type Report } from "../app/report";
import type { State } from "../app/state";
import { el, list, say } from "./dom";

export type PanelExtras = {
  state: State;
  hasPhoto: boolean;
  sample: boolean;
  zoom: string;
  unit: string;
  /** The plan to draw under the room's numbers, when there is an outline. */
  plan: Plan | null;
};

export function showPanel(words: Report, x: PanelExtras): void {
  const { state } = x;
  say("zoom-text", x.zoom);
  say("notice", words.notice);
  say("step", words.step);
  el("working").hidden = !words.working;
  const result = el("result");
  if (result.textContent !== words.headline) result.textContent = words.headline;
  say("problem", words.problem);
  list("rows", words.rows.map((row) => ({ strong: `${row.name}: `, rest: row.text })));
  list("verdicts", words.verdicts);
  list("notes", words.notes);
  list("truth", words.truth);
  say("unchecked", words.basis ? UNCHECKED : "");
  el("basis-box").hidden = !words.basis;
  say("basis", words.basis);
  say("sheet-words", words.sheet);

  // What belongs to which tool.
  el("fit-box").hidden = state.tool !== "fit" || !x.hasPhoto;
  el("thing-unit").textContent = x.unit;
  el("turn-row").hidden = state.tool !== "fit" || !state.closed;
  el("turn-text").textContent = `Turned ${state.turn}° on the floor. Drag the dashed box on the photo by its middle.`;
  el("close").hidden = state.tool !== "room" || state.closed || state.points.room.length < 3;
  for (const tab of document.querySelectorAll<HTMLElement>('[role="tab"]')) {
    const on = tab.dataset.tool === state.tool;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on) el("tool").setAttribute("aria-labelledby", tab.id);
  }

  const planBox = el("plan-box");
  const plan = el("plan");
  const svg = x.plan?.ok ? x.plan.svg : "";
  planBox.hidden = !svg;
  if (plan.dataset.svg !== svg) {
    plan.dataset.svg = svg;
    plan.innerHTML = svg; // built by plan.ts, which escapes every piece of text it is given
  }
  el("sample-box").hidden = !x.sample;
  document.body.classList.toggle("no-photo", !x.hasPhoto); // hides what needs a photo
}
