import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  buildQuote,
  createDraft,
  forwardSubject,
  isPlausibleEmail,
  moveParticipant,
  removeParticipant,
  replyAllRecipients,
  replyRecipients,
  replySubject,
  validateAttachment,
  validateDraft
} from '../src/compose.js';
import { DEFAULT_MINIEMAIL_OPTIONS } from '../src/defaults/options.js';
import type {
  MiniEmailComposeDraft,
  MiniEmailMessage,
  ResolvedMiniEmailOptions
} from '../src/types.js';

function options(over: Partial<ResolvedMiniEmailOptions> = {}): ResolvedMiniEmailOptions {
  return { ...DEFAULT_MINIEMAIL_OPTIONS, ...over };
}

function message(over: Partial<MiniEmailMessage> = {}): MiniEmailMessage {
  return {
    id: 'msg-1',
    conversationId: 'thread-1',
    subject: 'Invoice 4471',
    from: { email: 'asha@example.com', name: 'Asha Patel' },
    to: [{ email: 'ops@malkom.test' }, { email: 'vik@example.com', name: 'Vik' }],
    cc: [{ email: 'audit@example.com' }],
    bcc: [{ email: 'secret@example.com' }],
    replyTo: [],
    receivedAt: '2026-08-12T09:15:00.000Z',
    body: { kind: 'html', content: '<p>Please pay this.</p>' },
    attachments: [],
    headers: { messageId: '<abc@x>', references: ['<r1@x>'] },
    ...over
  };
}

const SELF = { email: 'ops@malkom.test' };

describe('subject prefixes', () => {
  it('adds Re: once', () => {
    expect(replySubject('Invoice')).toBe('Re: Invoice');
    expect(replySubject('Re: Invoice')).toBe('Re: Invoice');
  });

  it('recognises non-English reply prefixes', () => {
    expect(replySubject('AW: Rechnung')).toBe('AW: Rechnung');
    expect(replySubject('SV: Faktura')).toBe('SV: Faktura');
  });

  it('recognises the numbered Re[2]: form', () => {
    expect(replySubject('Re[2]: Invoice')).toBe('Re[2]: Invoice');
  });

  it('adds Fwd: once', () => {
    expect(forwardSubject('Invoice')).toBe('Fwd: Invoice');
    expect(forwardSubject('Fwd: Invoice')).toBe('Fwd: Invoice');
    expect(forwardSubject('Fw: Invoice')).toBe('Fw: Invoice');
  });
});

describe('recipients', () => {
  it('replies to the sender', () => {
    expect(replyRecipients(message())).toEqual([
      { email: 'asha@example.com', name: 'Asha Patel' }
    ]);
  });

  it('honours Reply-To over From', () => {
    const source = message({ replyTo: [{ email: 'billing@example.com' }] });
    expect(replyRecipients(source)).toEqual([{ email: 'billing@example.com' }]);
  });

  it('reply-all keeps everyone except the replying mailbox', () => {
    const { to, cc } = replyAllRecipients(message(), SELF);

    expect(to).toEqual([
      { email: 'asha@example.com', name: 'Asha Patel' },
      { email: 'vik@example.com', name: 'Vik' }
    ]);
    expect(cc).toEqual([{ email: 'audit@example.com' }]);
  });

  it('never carries bcc forward', () => {
    const { to, cc } = replyAllRecipients(message(), SELF);
    const all = [...to, ...cc].map((a) => a.email);
    expect(all).not.toContain('secret@example.com');
  });

  it('does not repeat an address that is on both To and Cc', () => {
    const source = message({
      to: [{ email: 'dup@example.com' }],
      cc: [{ email: 'dup@example.com' }]
    });
    const { to, cc } = replyAllRecipients(source, SELF);

    expect(to.filter((a) => a.email === 'dup@example.com')).toHaveLength(1);
    expect(cc).toEqual([]);
  });

  it('ignores case when excluding the replying mailbox', () => {
    const { to } = replyAllRecipients(message(), { email: 'OPS@MALKOM.TEST' });
    expect(to.map((a) => a.email)).not.toContain('ops@malkom.test');
  });
});

describe('createDraft — reply', () => {
  it('builds a reply with subject, recipients and threading ids', () => {
    const draft = createDraft({ mode: 'reply', source: message(), self: SELF, options: options() });

    expect(draft.mode).toBe('reply');
    expect(draft.subject).toBe('Re: Invoice 4471');
    expect(draft.to).toEqual([{ email: 'asha@example.com', name: 'Asha Patel' }]);
    expect(draft.threadContext?.conversationId).toBe('thread-1');
    expect(draft.threadContext?.messageIdHeader).toBe('<abc@x>');
  });

  it('extends the references chain rather than replacing it', () => {
    const draft = createDraft({ mode: 'reply', source: message(), options: options() });
    expect(draft.threadContext?.references).toEqual(['<r1@x>', '<abc@x>']);
  });

  it('quotes the original by default', () => {
    const draft = createDraft({ mode: 'reply', source: message(), options: options() });

    expect(draft.body.content).toContain('gmail_quote');
    expect(draft.body.content).toContain('Please pay this.');
    expect(draft.body.content).toContain('wrote:');
  });

  it('omits the quote when the host switched it off', () => {
    const draft = createDraft({
      mode: 'reply',
      source: message(),
      options: options({ quoteOriginalOnReply: false })
    });

    expect(draft.body.content).not.toContain('gmail_quote');
  });

  it('leaves room to type above the quote', () => {
    const draft = createDraft({ mode: 'reply', source: message(), options: options() });
    expect(draft.body.content.startsWith('<div><br></div>')).toBe(true);
  });
});

describe('createDraft — reply all', () => {
  it('fills To and Cc from the original', () => {
    const draft = createDraft({
      mode: 'replyAll',
      source: message(),
      self: SELF,
      options: options()
    });

    expect(draft.to.map((a) => a.email)).toEqual(['asha@example.com', 'vik@example.com']);
    expect(draft.cc.map((a) => a.email)).toEqual(['audit@example.com']);
    expect(draft.bcc).toEqual([]);
  });
});

describe('createDraft — forward', () => {
  it('starts with no recipients', () => {
    const draft = createDraft({ mode: 'forward', source: message(), options: options() });

    expect(draft.to).toEqual([]);
    expect(draft.subject).toBe('Fwd: Invoice 4471');
  });

  it('includes the forwarded header block', () => {
    const draft = createDraft({ mode: 'forward', source: message(), options: options() });

    expect(draft.body.content).toContain('Forwarded message');
    expect(draft.body.content).toContain('asha@example.com');
    expect(draft.body.content).toContain('Subject: Invoice 4471');
  });
});

describe('createDraft — new', () => {
  it('is empty and carries no threading', () => {
    const draft = createDraft({ mode: 'new', options: options() });

    expect(draft).toMatchObject({ mode: 'new', subject: '', to: [], cc: [], bcc: [] });
    expect(draft.threadContext).toBeUndefined();
  });

  it('falls back to a new mail when no source message was given', () => {
    expect(createDraft({ mode: 'reply', options: options() }).mode).toBe('new');
  });
});

describe('buildQuote', () => {
  it('wraps plain text so line breaks survive', () => {
    const quote = buildQuote(
      message({ body: { kind: 'text', content: 'line one\nline two' } })
    );
    expect(quote).toContain('<pre');
    expect(quote).toContain('line one\nline two');
  });

  it('escapes markup in the attribution line', () => {
    const quote = buildQuote(message({ from: { email: 'a@b.com', name: '<script>' } }));
    expect(quote).toContain('&lt;script&gt;');
  });
});

describe('participants', () => {
  const draft: MiniEmailComposeDraft = {
    mode: 'reply',
    to: [{ email: 'a@b.com' }],
    cc: [],
    bcc: [],
    subject: 'x',
    body: { kind: 'html', content: '' },
    attachments: []
  };

  it('adds to a line', () => {
    expect(addParticipant(draft, 'cc', { email: 'c@d.com' }).cc).toEqual([
      { email: 'c@d.com' }
    ]);
  });

  it('refuses a duplicate on the same line', () => {
    expect(addParticipant(draft, 'to', { email: 'A@B.com' }).to).toHaveLength(1);
  });

  it('removes from a line', () => {
    expect(removeParticipant(draft, 'to', { email: 'a@b.com' }).to).toEqual([]);
  });

  it('moves between lines', () => {
    const moved = moveParticipant(draft, 'to', 'cc', { email: 'a@b.com' });
    expect(moved.to).toEqual([]);
    expect(moved.cc).toEqual([{ email: 'a@b.com' }]);
  });

  it('leaves the draft alone when moving to the same line', () => {
    expect(moveParticipant(draft, 'to', 'to', { email: 'a@b.com' })).toBe(draft);
  });
});

describe('validation', () => {
  const base: MiniEmailComposeDraft = {
    mode: 'reply',
    to: [{ email: 'a@b.com' }],
    cc: [],
    bcc: [],
    subject: 'x',
    body: { kind: 'html', content: '' },
    attachments: []
  };

  it('accepts a plausible address', () => {
    expect(isPlausibleEmail('a.b+tag@sub.example.co.uk')).toBe(true);
    expect(isPlausibleEmail('not an email')).toBe(false);
  });

  it('requires at least one recipient', () => {
    expect(validateDraft({ ...base, to: [] }, options())?.code).toBe('sendFailed');
  });

  it('accepts a draft addressed only via bcc', () => {
    expect(
      validateDraft({ ...base, to: [], bcc: [{ email: 'a@b.com' }] }, options())
    ).toBeUndefined();
  });

  it('rejects an obviously invalid address', () => {
    const result = validateDraft({ ...base, to: [{ email: 'nope' }] }, options());
    expect(result?.message).toContain('nope');
  });

  it('rejects an oversized attachment', () => {
    const result = validateDraft(
      {
        ...base,
        attachments: [
          {
            id: 'a',
            filename: 'big.zip',
            mimeType: 'application/zip',
            sizeBytes: 30 * 1024 * 1024,
            content: new ArrayBuffer(0)
          }
        ]
      },
      options({ maxAttachmentMb: 25 })
    );

    expect(result?.code).toBe('attachmentTooLarge');
  });

  it('rejects a disallowed file type when the host set a list', () => {
    const result = validateAttachment(
      {
        id: 'a',
        filename: 'x.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 10,
        content: new ArrayBuffer(0)
      },
      options({ allowedAttachmentTypes: ['application/pdf'] })
    );

    expect(result?.code).toBe('attachmentTypeNotAllowed');
  });

  it('allows any type by default', () => {
    const result = validateAttachment(
      {
        id: 'a',
        filename: 'x.exe',
        mimeType: 'application/x-msdownload',
        sizeBytes: 10,
        content: new ArrayBuffer(0)
      },
      options()
    );

    expect(result).toBeUndefined();
  });
});
