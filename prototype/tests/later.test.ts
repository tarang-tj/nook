import { describe, expect, it } from "vitest";
import { createLater, PAUSE_MS, SOON_MS, type Timer } from "../src/app/later";

/** A clock the test moves by hand. */
function fakeTimer() {
  let now = 0;
  let booked: { at: number; run: () => void } | null = null;
  const timer: Timer = {
    set: (run, ms) => { booked = { at: now + ms, run }; return booked; },
    clear: (handle) => { if (booked === handle) booked = null; },
  };
  return {
    timer,
    pass(ms: number) {
      now += ms;
      const due = booked as { at: number; run: () => void } | null;
      if (due && due.at <= now) { booked = null; due.run(); }
    },
  };
}

describe("error bars worked out later", () => {
  it("are not worked out on every pointer move: only after a pause, and then only for the last taps", () => {
    const clock = fakeTimer();
    let ready = 0;
    const computed: string[] = [];
    const later = createLater<string>(() => ready++, clock.timer);
    const want = (key: string) => later.want(key, () => { computed.push(key); return `bar for ${key}`; });
    for (const key of ["taps 1", "taps 2", "taps 3"]) {
      expect(want(key)).toBeNull(); // a finger is dragging: "working"
      clock.pass(100);
    }
    expect(computed).toEqual([]);
    clock.pass(PAUSE_MS);
    expect(computed).toEqual(["taps 3"]);
    expect(ready).toBe(1);
    expect(want("taps 3")).toBe("bar for taps 3");
  });

  it("never hand out a bar that belongs to other taps", () => {
    const clock = fakeTimer();
    const later = createLater<string>(() => {}, clock.timer);
    later.want("old", () => "old bar");
    clock.pass(PAUSE_MS);
    expect(later.want("old", () => "x")).toBe("old bar");
    expect(later.want("new", () => "new bar")).toBeNull();
    // Going back to the old taps does not bring the old bar back either: it was thrown away.
    expect(later.want("old", () => "old bar again")).toBeNull();
    clock.pass(PAUSE_MS);
    expect(later.want("old", () => "x")).toBe("old bar again");
  });

  it("do not wait out the pause once the finger lifts", () => {
    const clock = fakeTimer();
    const later = createLater<number>(() => {}, clock.timer);
    expect(later.want("k", () => 7)).toBeNull();
    later.hurry();
    clock.pass(SOON_MS);
    expect(later.want("k", () => 0)).toBe(7);
    expect(later.waiting()).toBe(false);
  });

  it("asking again for the same taps does not push the work back", () => {
    const clock = fakeTimer();
    const later = createLater<number>(() => {}, clock.timer);
    later.want("k", () => 1);
    clock.pass(PAUSE_MS - 50);
    later.want("k", () => 1); // a redraw for some other reason
    clock.pass(50);
    expect(later.want("k", () => 2)).toBe(1);
    later.drop();
    expect(later.want("k", () => 3)).toBeNull();
  });
});
