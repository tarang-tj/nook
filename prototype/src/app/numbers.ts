// From taps to numbers. One plane map is solved from every known size in the
// photo (solveFused), every tool reads its numbers off that one map, and
// every error bar comes from the same loop: move every tap by its own
// uncertainty (jitterFused for the references, jitterPoint for the rest),
// solve again, a few hundred times (spreadOf).
//
// Pure. The bars are the slow part (hundreds of solves), so the page asks
// for them separately and less often than it redraws (see later.ts).
import { clearance, footprint } from "../measure/fit";
import { jitterFused, solveFused, type FusedInput } from "../measure/fused";
import { applyHomography, planeDistance, type Mat3, type Pt } from "../measure/homography";
import { floorPoints, outlineMeasures } from "../measure/outline";
import { referenceById } from "../measure/references";
import { jitterPoint, spreadOf, withBar, type Bar, type Draw } from "../measure/spread";
import { toMm, type Unit } from "../measure/units";
import { thingAt, type State } from "./state";

/** The choices made with the controls, read off the page by main.ts.
 * Lengths are in the chosen unit, as typed. */
export type Settings = {
  paper: string; swap: boolean; unit: Unit;
  paper2: string; swap2: boolean; spanLength: number;
  thingWidth: number; thingDepth: number;
};

/** Everything the numbers depend on, and nothing else: two equal scenes give
 * equal numbers, so the page can tell a fresh bar from a stale one. */
export type Scene = {
  input: FusedInput;
  ends: Pt[];
  room: Pt[];
  gap: Pt[];
  thing: { at: Pt; widthMm: number; depthMm: number; turnDeg: number } | null;
};

/** Numbers by name, in mm (area in mm squared): distance, wall0, wall1, ...,
 * perimeter, area, gap, spare. Null where there is no number. */
export type Values = Record<string, number | null>;
export type Bars = Record<string, Bar>;

export type Solved =
  | { ok: false; reason: string }
  | {
      ok: true;
      h: Mat3;
      /** The references the plane map was solved from. */
      used: string[];
      values: Values;
      /** Why the outline gives no numbers, when it does not. */
      outlineProblem: string | null;
      /** Floor positions, mm, for the plan and for drawing. */
      floor: { sheet: Pt[] | null; room: Pt[] | null; foot: Pt[] | null };
    };

/** What the taps and settings add up to, or null until the sheet has its four corners. */
export function sceneOf(s: State, set: Settings): Scene | null {
  const { sheet, second, span, ends, room, gap } = s.points;
  if (sheet.length < 4) return null;
  const input: FusedInput = { sheet: { corners: sheet, reference: referenceById(set.paper), swapSides: set.swap } };
  if (second.length === 4) input.secondSheet = { corners: second, reference: referenceById(set.paper2), swapSides: set.swap2 };
  if (span.length === 2) input.spans = [{ a: span[0], b: span[1], lengthMm: toMm(set.spanLength, set.unit) }];
  const at = thingAt(s);
  const [widthMm, depthMm] = [toMm(set.thingWidth, set.unit), toMm(set.thingDepth, set.unit)];
  return {
    input,
    ends: s.tool === "distance" && ends.length === 2 ? ends : [],
    room: s.tool !== "distance" && s.closed ? room : [],
    gap: s.tool === "fit" && gap.length === 2 ? gap : [],
    thing: at && widthMm > 0 && depthMm > 0 ? { at, widthMm, depthMm, turnDeg: s.turn } : null,
  };
}

const positive = (v: number | null): number | null => (v !== null && Number.isFinite(v) && v > 0 ? v : null);

/** Read every number off one plane map. `move` is applied to each tap first:
 * the identity for the taps as placed, a random nudge for a simulated set.
 * The taps are always moved in the same order, so a seeded run repeats. */
function measure(scene: Scene, h: Mat3, move: (p: Pt) => Pt, foot: Pt[] | null): { values: Values; outlineProblem: string | null; room: Pt[] | null } {
  const values: Values = {};
  let outlineProblem: string | null = null;
  let room: Pt[] | null = null;
  if (scene.ends.length === 2) {
    const [a, b] = scene.ends.map(move);
    values.distance = positive(planeDistance(h, a, b));
  }
  if (scene.room.length >= 3) {
    room = floorPoints(h, scene.room.map(move));
    const m = room ? outlineMeasures(room) : null;
    if (!room) outlineProblem = "A corner is at or above the floor's horizon in this photo, so it has no position on the floor.";
    else if (m && !m.ok) outlineProblem = m.reason;
    scene.room.forEach((_, i) => (values[`wall${i}`] = m?.ok ? positive(m.walls[i]) : null));
    values.perimeter = m?.ok ? m.perimeter : null;
    values.area = m?.ok ? positive(m.area) : null;
    if (foot) values.spare = room && m?.ok ? clearance(foot, room) : null;
  }
  if (scene.gap.length === 2) {
    const [a, b] = scene.gap.map(move);
    values.gap = positive(planeDistance(h, a, b));
  }
  return { values, outlineProblem, room };
}

/** The thing's footprint on the floor, mm, through the map as placed. */
function footOf(scene: Scene, h: Mat3): Pt[] | null {
  if (!scene.thing) return null;
  const centre = applyHomography(h, scene.thing.at);
  return centre ? footprint(centre, scene.thing.widthMm, scene.thing.depthMm, (scene.thing.turnDeg * Math.PI) / 180) : null;
}

/** One solve at the taps as placed: fast enough to run on every redraw. */
export function solve(scene: Scene): Solved {
  const fused = solveFused(scene.input);
  if (!fused.ok) return fused;
  const foot = scene.room.length >= 3 ? footOf(scene, fused.h) : null;
  const now = measure(scene, fused.h, (p) => p, foot);
  return {
    ok: true, h: fused.h, used: fused.used, values: now.values, outlineProblem: now.outlineProblem,
    floor: { sheet: floorPoints(fused.h, scene.input.sheet.corners), room: now.room, foot },
  };
}

/** The error bar for every number in `solved`. Slow: 400 solves. Every
 * number sees the same simulated taps, so the bars agree with each other;
 * the simulated sets are worked out once and shared between the numbers. */
export function barsOf(scene: Scene, solved: Solved, options: { samples?: number; seed?: number } = {}): Bars {
  const bars: Bars = {};
  if (!solved.ok) return bars;
  const { values, floor } = solved;
  const trials: (Values | null)[] = [];
  const trial = (draw: Draw): Values | null => {
    const fused = solveFused(jitterFused(scene.input, draw));
    return fused.ok ? measure(scene, fused.h, (p) => jitterPoint(p, draw), floor.foot).values : null;
  };
  for (const key of Object.keys(values)) {
    let next = 0;
    const evaluate = (draw: Draw | null): number | null => {
      if (!draw) return values[key];
      const n = next++;
      // The first number to ask for set n works it out; the rest reuse it.
      if (n >= trials.length) trials.push(trial(draw));
      return trials[n]?.[key] ?? null;
    };
    // Room to spare may honestly be near zero or negative; a size may not.
    bars[key] = withBar(spreadOf(evaluate, options), key === "spare" ? "signed" : "size");
  }
  return bars;
}
