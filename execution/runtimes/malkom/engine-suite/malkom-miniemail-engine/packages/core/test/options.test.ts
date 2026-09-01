import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MINIEMAIL_OPTIONS,
  resolveMiniEmailOptions
} from '@malkom/miniemail-core';

describe('resolveMiniEmailOptions', () => {
  it('returns the full default set when the host says nothing', () => {
    expect(resolveMiniEmailOptions(undefined)).toEqual(DEFAULT_MINIEMAIL_OPTIONS);
  });

  it('does not hand back the shared default object', () => {
    expect(resolveMiniEmailOptions(undefined)).not.toBe(DEFAULT_MINIEMAIL_OPTIONS);
  });

  it('applies only the fields the host stated', () => {
    const resolved = resolveMiniEmailOptions({ searchEnabled: false, undoSendMs: 3000 });
    expect(resolved.searchEnabled).toBe(false);
    expect(resolved.undoSendMs).toBe(3000);
    expect(resolved.replyEnabled).toBe(DEFAULT_MINIEMAIL_OPTIONS.replyEnabled);
  });

  it('treats an explicit undefined as "not stated"', () => {
    const resolved = resolveMiniEmailOptions({ blockRemoteImages: undefined });
    expect(resolved.blockRemoteImages).toBe(true);
  });

  it('keeps false as a real value, not a missing one', () => {
    expect(resolveMiniEmailOptions({ newMailEnabled: false }).newMailEnabled).toBe(false);
  });

  it('ships every switch on by default so the engine works untouched', () => {
    expect(DEFAULT_MINIEMAIL_OPTIONS.searchEnabled).toBe(true);
    expect(DEFAULT_MINIEMAIL_OPTIONS.replyEnabled).toBe(true);
    expect(DEFAULT_MINIEMAIL_OPTIONS.replyAllEnabled).toBe(true);
    expect(DEFAULT_MINIEMAIL_OPTIONS.forwardEnabled).toBe(true);
    expect(DEFAULT_MINIEMAIL_OPTIONS.newMailEnabled).toBe(true);
    expect(DEFAULT_MINIEMAIL_OPTIONS.attachmentsEnabled).toBe(true);
    expect(DEFAULT_MINIEMAIL_OPTIONS.undoSendEnabled).toBe(true);
  });

  it('blocks remote images by default — faithful, but never trusted', () => {
    expect(DEFAULT_MINIEMAIL_OPTIONS.blockRemoteImages).toBe(true);
    expect(DEFAULT_MINIEMAIL_OPTIONS.sanitizerProfile).toBe('strict');
  });
});
