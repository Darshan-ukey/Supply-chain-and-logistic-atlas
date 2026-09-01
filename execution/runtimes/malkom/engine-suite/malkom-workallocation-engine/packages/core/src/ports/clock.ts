/** Injectable time source — pipeline and stores never call Date.now() directly. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
