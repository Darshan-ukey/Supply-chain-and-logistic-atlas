import { describe, expect, it } from 'vitest';
import { resolveAvailability } from '../src/availability.js';
import { DEFAULT_MINIEMAIL_OPTIONS } from '../src/defaults/options.js';
import type { MiniEmailCapabilities, ResolvedMiniEmailOptions } from '../src/types.js';
import { ALL_CAPABILITIES } from './helpers/connection.js';

function options(over: Partial<ResolvedMiniEmailOptions> = {}): ResolvedMiniEmailOptions {
  return { ...DEFAULT_MINIEMAIL_OPTIONS, ...over };
}

function caps(over: Partial<MiniEmailCapabilities> = {}): MiniEmailCapabilities {
  return { ...ALL_CAPABILITIES, ...over };
}

describe('resolveAvailability — defaults', () => {
  it('offers everything when the connector can and the host has not said otherwise', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options()
    });

    expect(availability.read.allowed).toBe(true);
    expect(availability.search.allowed).toBe(true);
    expect(availability.reply.allowed).toBe(true);
    expect(availability.newMail.allowed).toBe(true);
    expect(availability.send.allowed).toBe(true);
  });

  it('offers nothing until capabilities are known', () => {
    const availability = resolveAvailability({
      capabilities: undefined,
      options: options()
    });

    expect(availability.read.allowed).toBe(false);
    expect(availability.read.reason).toBe('connectorCapability');
  });
});

describe('resolveAvailability — capability layer', () => {
  it('hides sending when the connector cannot send', () => {
    const availability = resolveAvailability({
      capabilities: caps({ canSend: false }),
      options: options()
    });

    expect(availability.send.allowed).toBe(false);
    expect(availability.send.reason).toBe('connectorCapability');
    expect(availability.reply.allowed).toBe(false);
    expect(availability.forward.allowed).toBe(false);
    // Reading is unaffected.
    expect(availability.read.allowed).toBe(true);
  });

  it('hides search when the connector cannot search', () => {
    const availability = resolveAvailability({
      capabilities: caps({ canSearch: false }),
      options: options()
    });

    expect(availability.search.allowed).toBe(false);
    expect(availability.search.reason).toBe('connectorCapability');
  });

  it('hides drafts when the connector cannot draft', () => {
    const availability = resolveAvailability({
      capabilities: caps({ canDraft: false }),
      options: options()
    });

    expect(availability.saveDraft.allowed).toBe(false);
    // Sending is still possible without server-side drafts.
    expect(availability.send.allowed).toBe(true);
  });

  it('hides attachment download when the connector cannot fetch them', () => {
    const availability = resolveAvailability({
      capabilities: caps({ canFetchAttachments: false }),
      options: options()
    });

    expect(availability.downloadAttachment.allowed).toBe(false);
  });
});

describe('resolveAvailability — config layer', () => {
  it('hides search when the host switched it off', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options({ searchEnabled: false })
    });

    expect(availability.search.allowed).toBe(false);
    expect(availability.search.reason).toBe('hostConfig');
  });

  it('hides new mail on its own switch without touching reply', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options({ newMailEnabled: false })
    });

    expect(availability.newMail.allowed).toBe(false);
    expect(availability.newMail.reason).toBe('hostConfig');
    expect(availability.reply.allowed).toBe(true);
  });

  it('withdraws send once every way of composing is off', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options({
        replyEnabled: false,
        replyAllEnabled: false,
        forwardEnabled: false,
        newMailEnabled: false
      })
    });

    expect(availability.send.allowed).toBe(false);
    expect(availability.send.reason).toBe('hostConfig');
  });

  it('hides drafts when the host turned draft mode off', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options({ draftMode: 'off' })
    });

    expect(availability.saveDraft.allowed).toBe(false);
    expect(availability.saveDraft.reason).toBe('hostConfig');
  });

  it('hides attachments on the attachment switch', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options({ attachmentsEnabled: false })
    });

    expect(availability.attach.allowed).toBe(false);
    expect(availability.downloadAttachment.allowed).toBe(false);
  });
});

describe('resolveAvailability — capability outranks config', () => {
  it('reports the connector, not config, when both would block', () => {
    const availability = resolveAvailability({
      capabilities: caps({ canSend: false }),
      options: options({ replyEnabled: false })
    });

    // The connector is checked first, because it is the harder fact.
    expect(availability.reply.reason).toBe('connectorCapability');
  });
});

describe('resolveAvailability — family switches', () => {
  it('offers nothing when the engine itself is switched off', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options(),
      switches: { engineEnabled: false }
    });

    expect(availability.read.allowed).toBe(false);
    expect(availability.reply.allowed).toBe(false);
  });

  it('leaves reading intact in a read-only session', () => {
    const availability = resolveAvailability({
      capabilities: caps(),
      options: options(),
      switches: { writeEnabled: false }
    });

    expect(availability.read.allowed).toBe(true);
    expect(availability.search.allowed).toBe(true);
    expect(availability.downloadAttachment.allowed).toBe(true);

    expect(availability.reply.allowed).toBe(false);
    expect(availability.reply.reason).toBe('hostConfig');
    expect(availability.send.allowed).toBe(false);
    expect(availability.attach.allowed).toBe(false);
  });
});
