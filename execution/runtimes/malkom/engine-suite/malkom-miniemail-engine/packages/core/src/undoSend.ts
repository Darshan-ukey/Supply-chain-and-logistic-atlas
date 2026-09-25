import type { MiniEmailComposeDraft, MiniEmailPendingSend } from './types.js';

/**
 * The undo-send hold.
 *
 * Nothing clever, and deliberately so: the message is held on this side for a
 * configured delay and only then handed to the provider. Cancelling before the
 * delay expires means the send never happened at all — no recall, no deletion
 * from anyone's mailbox, nothing to explain to the reader.
 *
 * This is also why a send is never retried at the adapter: once the hold
 * expires the message goes exactly once.
 */

export type NowFn = () => number;

export interface UndoSendOptions {
  readonly delayMs: number;
  /** Injectable clock and timer, so tests need no real waiting. */
  readonly now?: NowFn;
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface HoldResult {
  readonly pending: MiniEmailPendingSend;
  /** Resolves when the send completes, is cancelled, or fails. */
  readonly settled: Promise<MiniEmailPendingSend>;
}

/**
 * Holds one send at a time.
 *
 * One is enough: the panel shows a single compose surface, and a second send
 * cannot be started while the first is still holding without confusing which
 * Undo belongs to which message.
 */
export class UndoSendBuffer {
  readonly #delayMs: number;
  readonly #now: NowFn;
  readonly #setTimer: (fn: () => void, ms: number) => unknown;
  readonly #clearTimer: (handle: unknown) => void;

  #pending: MiniEmailPendingSend | undefined;
  #handle: unknown;
  #resolve: ((value: MiniEmailPendingSend) => void) | undefined;
  #sequence = 0;

  constructor(options: UndoSendOptions) {
    this.#delayMs = options.delayMs;
    this.#now = options.now ?? (() => Date.now());
    this.#setTimer =
      options.setTimer ?? ((fn, ms) => setTimeout(fn, ms) as unknown);
    this.#clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as never));
  }

  get pending(): MiniEmailPendingSend | undefined {
    return this.#pending;
  }

  get isHolding(): boolean {
    return this.#pending?.state === 'holding';
  }

  /**
   * Queues a send.
   *
   * With a delay of zero the message goes immediately — the hold is a feature
   * the host can switch off, not a mandatory pause.
   */
  hold(
    draft: MiniEmailComposeDraft,
    deliver: (draft: MiniEmailComposeDraft) => Promise<string>
  ): HoldResult {
    if (this.#pending?.state === 'holding') {
      throw new Error('A message is already waiting to send. Undo or wait for it first.');
    }

    this.#sequence += 1;
    const id = `send-${this.#sequence}`;
    const pending: MiniEmailPendingSend = {
      id,
      draft,
      sendsAt: this.#now() + this.#delayMs,
      state: 'holding'
    };
    this.#pending = pending;

    const settled = new Promise<MiniEmailPendingSend>((resolve) => {
      this.#resolve = resolve;
    });

    const fire = (): void => {
      // A cancel that landed first wins; the timer firing afterwards is a
      // no-op rather than a race that sends anyway.
      if (this.#pending?.id !== id || this.#pending.state !== 'holding') return;

      this.#pending = { ...pending, state: 'sending' };

      void deliver(draft)
        .then(() => {
          if (this.#pending?.id !== id) return;
          this.#settle({ ...pending, state: 'sent' });
        })
        .catch(() => {
          if (this.#pending?.id !== id) return;
          this.#settle({ ...pending, state: 'failed' });
        });
    };

    if (this.#delayMs <= 0) fire();
    else this.#handle = this.#setTimer(fire, this.#delayMs);

    return { pending, settled };
  }

  /**
   * Cancels a holding send.
   *
   * Returns false once the message has left — there is nothing to undo after
   * that, and pretending otherwise would be a lie to the reader.
   */
  undo(): boolean {
    if (this.#pending?.state !== 'holding') return false;

    if (this.#handle !== undefined) {
      this.#clearTimer(this.#handle);
      this.#handle = undefined;
    }

    this.#settle({ ...this.#pending, state: 'cancelled' });
    return true;
  }

  /** Milliseconds left on the hold; zero once it has expired or settled. */
  remainingMs(): number {
    if (this.#pending?.state !== 'holding') return 0;
    return Math.max(0, this.#pending.sendsAt - this.#now());
  }

  /** Drops any hold without sending. Used when the panel goes away. */
  destroy(): void {
    if (this.#handle !== undefined) {
      this.#clearTimer(this.#handle);
      this.#handle = undefined;
    }
    if (this.#pending?.state === 'holding') {
      this.#settle({ ...this.#pending, state: 'cancelled' });
    }
  }

  #settle(pending: MiniEmailPendingSend): void {
    this.#pending = pending;
    this.#resolve?.(pending);
    this.#resolve = undefined;
  }
}
