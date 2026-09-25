import { describe, expect, it, vi } from 'vitest';
import { UndoSendBuffer } from '../src/undoSend.js';
import type { MiniEmailComposeDraft } from '../src/types.js';

const draft: MiniEmailComposeDraft = {
  mode: 'reply',
  to: [{ email: 'a@b.com' }],
  cc: [],
  bcc: [],
  subject: 'Re: x',
  body: { kind: 'html', content: '<p>hi</p>' },
  attachments: []
};

/** A controllable clock and timer, so no test waits on real time. */
function fakeTimers() {
  let now = 1_000;
  const queue: { fn: () => void; at: number; handle: number }[] = [];
  let nextHandle = 1;

  return {
    options: {
      now: () => now,
      setTimer: (fn: () => void, ms: number) => {
        const handle = nextHandle++;
        queue.push({ fn, at: now + ms, handle });
        return handle;
      },
      clearTimer: (handle: unknown) => {
        const index = queue.findIndex((entry) => entry.handle === handle);
        if (index >= 0) queue.splice(index, 1);
      }
    },
    advance(ms: number): void {
      now += ms;
      const due = queue.filter((entry) => entry.at <= now);
      for (const entry of due) {
        queue.splice(queue.indexOf(entry), 1);
        entry.fn();
      }
    }
  };
}

describe('UndoSendBuffer — holding', () => {
  it('does not send during the hold', () => {
    const timers = fakeTimers();
    const deliver = vi.fn(() => Promise.resolve('sent-1'));
    const buffer = new UndoSendBuffer({ delayMs: 8_000, ...timers.options });

    buffer.hold(draft, deliver);

    expect(deliver).not.toHaveBeenCalled();
    expect(buffer.isHolding).toBe(true);
  });

  it('reports how long is left', () => {
    const timers = fakeTimers();
    const buffer = new UndoSendBuffer({ delayMs: 8_000, ...timers.options });

    buffer.hold(draft, () => Promise.resolve('x'));
    expect(buffer.remainingMs()).toBe(8_000);

    timers.advance(3_000);
    expect(buffer.remainingMs()).toBe(5_000);
  });

  it('sends once the hold expires', async () => {
    const timers = fakeTimers();
    const deliver = vi.fn(() => Promise.resolve('sent-1'));
    const buffer = new UndoSendBuffer({ delayMs: 8_000, ...timers.options });

    const { settled } = buffer.hold(draft, deliver);
    timers.advance(8_000);

    expect((await settled).state).toBe('sent');
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('sends immediately when the host set no delay', async () => {
    const timers = fakeTimers();
    const deliver = vi.fn(() => Promise.resolve('sent-1'));
    const buffer = new UndoSendBuffer({ delayMs: 0, ...timers.options });

    const { settled } = buffer.hold(draft, deliver);

    expect(deliver).toHaveBeenCalledTimes(1);
    expect((await settled).state).toBe('sent');
  });
});

describe('UndoSendBuffer — undo', () => {
  it('cancels before the hold expires, and nothing is sent', async () => {
    const timers = fakeTimers();
    const deliver = vi.fn(() => Promise.resolve('sent-1'));
    const buffer = new UndoSendBuffer({ delayMs: 8_000, ...timers.options });

    const { settled } = buffer.hold(draft, deliver);
    expect(buffer.undo()).toBe(true);

    timers.advance(20_000);

    expect(deliver).not.toHaveBeenCalled();
    expect((await settled).state).toBe('cancelled');
  });

  it('refuses to undo once the message has gone', async () => {
    const timers = fakeTimers();
    const buffer = new UndoSendBuffer({ delayMs: 1_000, ...timers.options });

    const { settled } = buffer.hold(draft, () => Promise.resolve('sent-1'));
    timers.advance(1_000);
    await settled;

    expect(buffer.undo()).toBe(false);
  });

  it('reports nothing to undo when idle', () => {
    const buffer = new UndoSendBuffer({ delayMs: 1_000, ...fakeTimers().options });
    expect(buffer.undo()).toBe(false);
    expect(buffer.remainingMs()).toBe(0);
  });
});

describe('UndoSendBuffer — failure', () => {
  it('marks a failed delivery without losing the draft', async () => {
    const timers = fakeTimers();
    const buffer = new UndoSendBuffer({ delayMs: 1_000, ...timers.options });

    const { settled } = buffer.hold(draft, () => Promise.reject(new Error('nope')));
    timers.advance(1_000);

    const result = await settled;
    expect(result.state).toBe('failed');
    expect(result.draft).toEqual(draft);
  });
});

describe('UndoSendBuffer — one at a time', () => {
  it('refuses a second send while one is holding', () => {
    const timers = fakeTimers();
    const buffer = new UndoSendBuffer({ delayMs: 8_000, ...timers.options });

    buffer.hold(draft, () => Promise.resolve('a'));

    expect(() => buffer.hold(draft, () => Promise.resolve('b'))).toThrow(
      /already waiting/i
    );
  });

  it('accepts a new send after the first was undone', () => {
    const timers = fakeTimers();
    const buffer = new UndoSendBuffer({ delayMs: 8_000, ...timers.options });

    buffer.hold(draft, () => Promise.resolve('a'));
    buffer.undo();

    expect(() => buffer.hold(draft, () => Promise.resolve('b'))).not.toThrow();
  });
});

describe('UndoSendBuffer — destroy', () => {
  it('cancels a holding send when the panel goes away', async () => {
    const timers = fakeTimers();
    const deliver = vi.fn(() => Promise.resolve('sent-1'));
    const buffer = new UndoSendBuffer({ delayMs: 8_000, ...timers.options });

    const { settled } = buffer.hold(draft, deliver);
    buffer.destroy();
    timers.advance(20_000);

    expect(deliver).not.toHaveBeenCalled();
    expect((await settled).state).toBe('cancelled');
  });
});
