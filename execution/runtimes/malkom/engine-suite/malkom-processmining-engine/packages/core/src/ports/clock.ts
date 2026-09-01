/**
 * Time port. Every engine-stamped instant (coverage records, refresh times)
 * goes through this so tests are deterministic and never sleep.
 *
 * Note the deliberate asymmetry with event timestamps: those come from the
 * host's data and are never re-stamped here.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Test clock — advances only when told to. */
export class FixedClock implements Clock {
  private current: Date;
  constructor(start: Date | string) {
    this.current = typeof start === 'string' ? new Date(start) : start;
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(to: Date | string): void {
    this.current = typeof to === 'string' ? new Date(to) : to;
  }
}
