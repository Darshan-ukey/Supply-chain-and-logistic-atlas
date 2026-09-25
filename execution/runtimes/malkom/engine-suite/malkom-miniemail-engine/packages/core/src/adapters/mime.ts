import type { MiniEmailAddress, MiniEmailComposeDraft } from '../types.js';

/**
 * Address parsing and RFC 5322 message building.
 *
 * Gmail's send endpoint takes a raw MIME message, so the engine has to build
 * one. Graph takes structured JSON and needs none of this — but both need
 * address parsing, because header values arrive as free text either way.
 */

/**
 * Splits an address header into individual addresses.
 *
 * Commas inside a quoted display name (`"Patel, Asha" <a@b.com>`) do not
 * separate addresses, so quoting and angle brackets are tracked while
 * scanning rather than splitting on commas outright.
 */
export function splitAddressList(header: string): readonly string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let inAngles = false;

  for (const char of header) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === '<') inAngles = true;
    else if (char === '>') inAngles = false;

    if (char === ',' && !inQuotes && !inAngles) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Parses one address into name and email. */
export function parseAddress(raw: string): MiniEmailAddress | undefined {
  const value = raw.trim();
  if (!value) return undefined;

  const angled = /^(.*?)<([^>]+)>\s*$/.exec(value);
  if (angled) {
    const name = (angled[1] ?? '').trim().replace(/^"|"$/g, '').trim();
    const email = (angled[2] ?? '').trim();
    if (!email) return undefined;
    return name ? { email, name } : { email };
  }

  // A bare address with no display name.
  if (value.includes('@')) return { email: value };
  return undefined;
}

/** Parses a full address header into a list. */
export function parseAddressList(header: string | undefined): readonly MiniEmailAddress[] {
  if (!header) return [];
  const out: MiniEmailAddress[] = [];
  for (const part of splitAddressList(header)) {
    const parsed = parseAddress(part);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Renders an address back to header form, quoting a name when needed. */
export function formatAddress(address: MiniEmailAddress): string {
  if (!address.name) return address.email;
  // A name containing a special character must be quoted or the header breaks.
  const needsQuotes = /[",:;<>@[\]\\]/.test(address.name);
  const name = needsQuotes ? `"${address.name.replace(/(["\\])/g, '\\$1')}"` : address.name;
  return `${name} <${address.email}>`;
}

export function formatAddressList(addresses: readonly MiniEmailAddress[]): string {
  return addresses.map(formatAddress).join(', ');
}

/** True when two addresses are the same mailbox. */
export function sameAddress(a: MiniEmailAddress, b: MiniEmailAddress): boolean {
  return a.email.trim().toLowerCase() === b.email.trim().toLowerCase();
}

/** Removes duplicates, keeping the first occurrence and its display name. */
export function dedupeAddresses(
  addresses: readonly MiniEmailAddress[]
): readonly MiniEmailAddress[] {
  const seen = new Set<string>();
  const out: MiniEmailAddress[] = [];
  for (const address of addresses) {
    const key = address.email.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}

/* ── base64 ──────────────────────────────────────────────────────────────── */

/** Standard base64 for a byte buffer. */
export function encodeBase64(content: ArrayBuffer): string {
  const bytes = new Uint8Array(content);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Decodes standard base64 to bytes. */
export function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Gmail returns and accepts base64url, not base64.
 *
 * `-` and `_` replace `+` and `/`, and the `=` padding is dropped, so both
 * directions need a translation step before the standard codecs will work.
 */
export function base64UrlToBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  return padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
}

export function base64ToBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodes Gmail's base64url payload to text. */
export function decodeBase64UrlText(value: string): string {
  const binary = atob(base64UrlToBase64(value));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

/** Decodes Gmail's base64url payload to bytes. */
export function decodeBase64Url(value: string): ArrayBuffer {
  return decodeBase64(base64UrlToBase64(value));
}

/* ── RFC 5322 message building ───────────────────────────────────────────── */

/**
 * Encodes a header value that is not plain ASCII.
 *
 * Raw non-ASCII in a header is not legal and gets mangled in transit, so it
 * goes out as RFC 2047 encoded-words instead.
 */
export function encodeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\u0020-\u007e]/.test(value)) return value;
  const utf8 = new TextEncoder().encode(value);
  return `=?utf-8?B?${encodeBase64(utf8.buffer as ArrayBuffer)}?=`;
}

function headerLine(name: string, value: string): string {
  return `${name}: ${value}`;
}

/** Splits base64 into the 76-character lines MIME expects. */
function wrapBase64(value: string): string {
  return value.replace(/(.{76})/g, '$1\r\n');
}

export interface BuildMessageInput {
  readonly draft: MiniEmailComposeDraft;
  readonly from?: MiniEmailAddress;
  /** Threading headers copied from the message being answered. */
  readonly inReplyTo?: string;
  readonly references?: readonly string[];
  /** Boundary generator, injectable so tests are deterministic. */
  readonly boundary?: string;
}

/**
 * Builds a complete RFC 5322 message.
 *
 * Structure depends on what the draft carries: a body alone goes out as a
 * single part, while attachments require a `multipart/mixed` envelope.
 */
export function buildRfc822Message(input: BuildMessageInput): string {
  const { draft } = input;
  const boundary = input.boundary ?? `malkom-${Math.random().toString(36).slice(2, 14)}`;

  const headers: string[] = [];
  if (input.from) headers.push(headerLine('From', formatAddress(input.from)));
  if (draft.to.length) headers.push(headerLine('To', formatAddressList(draft.to)));
  if (draft.cc.length) headers.push(headerLine('Cc', formatAddressList(draft.cc)));
  if (draft.bcc.length) headers.push(headerLine('Bcc', formatAddressList(draft.bcc)));
  headers.push(headerLine('Subject', encodeHeaderValue(draft.subject)));

  // These two are what keep a reply inside its conversation. Without them the
  // provider files it as a new thread.
  if (input.inReplyTo) headers.push(headerLine('In-Reply-To', input.inReplyTo));
  if (input.references?.length) {
    headers.push(headerLine('References', input.references.join(' ')));
  }
  headers.push(headerLine('MIME-Version', '1.0'));

  const contentType = draft.body.kind === 'html' ? 'text/html' : 'text/plain';
  const bodyBase64 = wrapBase64(
    encodeBase64(new TextEncoder().encode(draft.body.content).buffer as ArrayBuffer)
  );

  if (draft.attachments.length === 0) {
    headers.push(headerLine('Content-Type', `${contentType}; charset="utf-8"`));
    headers.push(headerLine('Content-Transfer-Encoding', 'base64'));
    return `${headers.join('\r\n')}\r\n\r\n${bodyBase64}`;
  }

  headers.push(
    headerLine('Content-Type', `multipart/mixed; boundary="${boundary}"`)
  );

  const parts: string[] = [
    [
      `--${boundary}`,
      headerLine('Content-Type', `${contentType}; charset="utf-8"`),
      headerLine('Content-Transfer-Encoding', 'base64'),
      '',
      bodyBase64
    ].join('\r\n')
  ];

  for (const attachment of draft.attachments) {
    parts.push(
      [
        `--${boundary}`,
        headerLine('Content-Type', `${attachment.mimeType}; name="${attachment.filename}"`),
        headerLine('Content-Transfer-Encoding', 'base64'),
        headerLine(
          'Content-Disposition',
          `attachment; filename="${attachment.filename}"`
        ),
        '',
        wrapBase64(encodeBase64(attachment.content))
      ].join('\r\n')
    );
  }

  parts.push(`--${boundary}--`);
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}
