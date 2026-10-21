import { describe, expect, it } from "vitest";
import { boxesOverlap, carryOver, checkFit, firstFit, missText, onFloor } from "./fit";
import { dims, ft, PIECES, type Placed } from "./pieces";
import { ROOMS, roomById } from "./rooms";

const dorm = roomById("dorm-single");
const studio = roomById("studio");
const shared = roomById("shared");

describe("checkFit in the dorm single", () => {
  it("fits a bed in open floor", () => {
    expect(checkFit(dorm, { u: ft(8), v: ft(6) }, "bed", 0, [])).toEqual({ ok: true });
  });

  it("says the wall when the piece hangs past the floor edge", () => {
    expect(checkFit(dorm, { u: ft(10.5), v: ft(6) }, "bed", 0, [])).toEqual({ ok: false, reason: "wall" });
  });

  it("lets a piece sit flush against the walls", () => {
    const { wu, hv } = dims("dresser", 0);
    expect(checkFit(dorm, { u: dorm.u - wu / 2, v: dorm.v - hv / 2 }, "dresser", 0, []).ok).toBe(true);
  });

  it("names the other piece it hits", () => {
    const desk: Placed = { id: "desk", u: ft(7), v: ft(6), turn: 0 };
    const fit = checkFit(dorm, { u: ft(8), v: ft(6) }, "bed", 0, [desk]);
    expect(fit).toEqual({ ok: false, reason: "piece", hit: "desk" });
    if (!fit.ok) expect(missText(fit)).toBe("Hits the desk");
  });

  it("ignores the piece's own old placement", () => {
    const bed: Placed = { id: "bed", u: ft(8), v: ft(6), turn: 0 };
    expect(checkFit(dorm, { u: ft(8.2), v: ft(6) }, "bed", 0, [bed]).ok).toBe(true);
  });

  it("blocks the door swing, the closet and the radiator", () => {
    expect(checkFit(dorm, { u: ft(1.5), v: ft(10) }, "fridge", 0, [])).toMatchObject({ reason: "door" });
    expect(checkFit(dorm, { u: ft(2), v: ft(1.5) }, "fridge", 0, [])).toMatchObject({ reason: "closet" });
    expect(checkFit(dorm, { u: ft(7), v: ft(1) }, "fridge", 0, [])).toMatchObject({ reason: "radiator" });
  });

  it("touching edges is not an overlap", () => {
    expect(boxesOverlap({ u0: 0, u1: 1, v0: 0, v1: 1 }, { u0: 1, u1: 2, v0: 0, v1: 1 })).toBe(false);
    expect(boxesOverlap({ u0: 0, u1: 1, v0: 0, v1: 1 }, { u0: 0.99, u1: 2, v0: 0, v1: 1 })).toBe(true);
  });
});

describe("rotation", () => {
  it("swaps the footprint on a quarter turn and keeps it on a half turn", () => {
    expect(dims("bed", 1)).toEqual({ wu: dims("bed", 0).hv, hv: dims("bed", 0).wu });
    expect(dims("bed", 2)).toEqual(dims("bed", 0));
  });

  it("a long piece fits one way but not the other near a wall", () => {
    // 6.6 ft of bed centered 2 ft from the front wall only fits turned along it.
    const spot = { u: ft(7), v: ft(10) };
    expect(checkFit(dorm, spot, "bed", 0, []).ok).toBe(false);
    expect(checkFit(dorm, spot, "bed", 1, []).ok).toBe(true);
  });
});

describe("the other rooms", () => {
  it("studio: door is on the back wall, closet on the left wall", () => {
    expect(checkFit(studio, { u: ft(13), v: ft(1.5) }, "nightstand", 0, [])).toMatchObject({ reason: "door" });
    expect(checkFit(studio, { u: ft(1), v: ft(6) }, "nightstand", 0, [])).toMatchObject({ reason: "closet" });
    expect(checkFit(studio, { u: ft(9), v: ft(7) }, "loveseat", 0, []).ok).toBe(true);
  });

  it("shared room: both closets block and the radiator is on the left wall", () => {
    expect(checkFit(shared, { u: ft(1.5), v: ft(1) }, "fridge", 0, [])).toMatchObject({ reason: "closet", hit: "closet-a" });
    expect(checkFit(shared, { u: ft(10), v: ft(1) }, "fridge", 0, [])).toMatchObject({ reason: "closet", hit: "closet-b" });
    expect(checkFit(shared, { u: ft(1), v: ft(7) }, "fridge", 0, [])).toMatchObject({ reason: "radiator" });
    expect(checkFit(shared, { u: ft(1.5), v: ft(14) }, "fridge", 0, [])).toMatchObject({ reason: "door" });
  });

  it("every room has a different shape and only valid features", () => {
    expect(new Set(ROOMS.map((room) => `${room.u}x${room.v}`)).size).toBe(ROOMS.length);
    for (const room of ROOMS) {
      for (const feature of room.features) {
        expect(feature.box.u0).toBeGreaterThanOrEqual(0);
        expect(feature.box.v0).toBeGreaterThanOrEqual(0);
        expect(feature.box.u1).toBeLessThanOrEqual(room.u + 1e-9);
        expect(feature.box.v1).toBeLessThanOrEqual(room.v + 1e-9);
      }
    }
  });

  it("onFloor uses the room's own size", () => {
    expect(onFloor({ u: ft(14), v: ft(1) }, studio)).toBe(true);
    expect(onFloor({ u: ft(14), v: ft(1) }, dorm)).toBe(false);
    expect(onFloor(null, dorm)).toBe(false);
  });
});

describe("placing and switching rooms", () => {
  it("tap-to-place finds a valid spot for every piece in every room, one after another", () => {
    for (const room of ROOMS) {
      const placed: Placed[] = [];
      for (const piece of PIECES) {
        const spot = firstFit(room, piece.id, placed);
        expect(spot, `${piece.id} in ${room.id}`).not.toBeNull();
        if (spot) {
          expect(checkFit(room, spot, spot.id, spot.turn, placed).ok).toBe(true);
          placed.push(spot);
        }
      }
    }
  });

  it("carries pieces between rooms and never leaves one in a bad spot", () => {
    const start: Placed[] = [];
    for (const piece of PIECES) {
      const spot = firstFit(dorm, piece.id, start);
      if (spot) start.push(spot);
    }
    for (const to of ROOMS) {
      const { kept, dropped } = carryOver(start, dorm, to);
      expect(kept.length + dropped.length).toBe(start.length);
      kept.forEach((item, index) => {
        expect(checkFit(to, item, item.id, item.turn, kept.slice(0, index)).ok).toBe(true);
        expect(checkFit(to, item, item.id, item.turn, kept).ok).toBe(true);
      });
    }
  });

  it("keeps a piece's relative spot when it still fits", () => {
    const bed: Placed = { id: "bed", u: ft(8), v: ft(6), turn: 0 };
    const { kept } = carryOver([bed], dorm, shared);
    expect(kept[0].u).toBeCloseTo((bed.u / dorm.u) * shared.u);
    expect(kept[0].v).toBeCloseTo((bed.v / dorm.v) * shared.v);
  });
});
