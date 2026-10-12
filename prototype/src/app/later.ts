// Error bars are slow (hundreds of solves each), so they are not worked out
// on every pointer move. The page asks for the value that belongs to a key;
// if that exact key has been worked out it gets it, otherwise it gets null
// (and shows "working") and the work is booked for after a short pause, or
// sooner when the finger lifts. A value is only ever handed out for the key
// it was worked out for, so a stale bar cannot sit beside a new value.
export type Timer = { set: (run: () => void, ms: number) => unknown; clear: (handle: unknown) => void };

const browserTimer: Timer = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** How long the taps must stay still before the bars are worked out, ms. */
export const PAUSE_MS = 350;
/** After the finger lifts: just long enough for "working" to be painted. */
export const SOON_MS = 30;

export function createLater<T>(onReady: () => void, timer: Timer = browserTimer) {
  let ready: { key: string; value: T } | null = null;
  let pending: { key: string; compute: () => T } | null = null;
  let handle: unknown = null;

  const run = (): void => {
    handle = null;
    if (!pending) return;
    const { key, compute } = pending;
    pending = null;
    ready = { key, value: compute() };
    onReady();
  };
  const book = (ms: number): void => {
    if (handle !== null) timer.clear(handle);
    handle = timer.set(run, ms);
  };

  return {
    /** The value for `key`, or null while it is still to be worked out. */
    want(key: string, compute: () => T): T | null {
      if (ready?.key === key) return ready.value;
      ready = null; // whatever was there belongs to other taps
      if (pending?.key !== key) {
        pending = { key, compute };
        book(PAUSE_MS);
      }
      return null;
    },
    /** The finger lifted: do not wait out the pause. */
    hurry(): void {
      if (pending) book(SOON_MS);
    },
    /** Nothing is wanted any more. */
    drop(): void {
      ready = null;
      pending = null;
      if (handle !== null) timer.clear(handle);
      handle = null;
    },
    waiting: (): boolean => pending !== null,
  };
}
