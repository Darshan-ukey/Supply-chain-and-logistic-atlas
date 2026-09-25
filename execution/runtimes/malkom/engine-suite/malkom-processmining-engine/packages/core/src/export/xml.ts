/**
 * A minimal XML writer.
 *
 * Hand-written rather than pulled from a library because export needs exactly
 * one thing — correct escaping — and adding a dependency for it would make
 * exporting a model conditional on installing something. `fast-xml-parser` is
 * already an optional peer for XES *import*; requiring it to write a file the
 * engine fully controls would be a poor trade.
 *
 * Escaping is the whole point. An activity called `R&D <urgent>` appears in
 * real logs, and an unescaped one produces a file that every downstream tool
 * refuses to open — usually with an error that blames the tool.
 */

export function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/**
 * Strip characters XML 1.0 cannot represent at all.
 *
 * Control characters below 0x20 (other than tab, newline and carriage return)
 * are illegal in XML even when escaped, and they turn up in logs exported from
 * systems that stored raw terminal output. Dropping them keeps the file
 * openable; leaving them in makes it unparseable with no useful error.
 */
export function sanitise(value: string): string {
  // Written as a code-point test rather than a regex: a character class full
  // of control-character escapes is unreadable and easy to get subtly wrong
  // in a way no test catches until a real log contains one.
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0)!;
    const isC0 = code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    const isDelOrC1 = code >= 0x7f && code <= 0x9f;
    if (isC0 || isDelOrC1) continue;
    out += char;
  }
  return out;
}

export type Attributes = Record<string, string | number | undefined>;

/** Accumulates indented XML. */
export class XmlWriter {
  private readonly parts: string[] = [];
  private depth = 0;

  constructor(private readonly indent = '  ') {}

  declaration(): this {
    this.parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    return this;
  }

  open(tag: string, attrs: Attributes = {}): this {
    this.parts.push(`${this.pad()}<${tag}${this.renderAttrs(attrs)}>`);
    this.depth += 1;
    return this;
  }

  close(tag: string): this {
    this.depth = Math.max(0, this.depth - 1);
    this.parts.push(`${this.pad()}</${tag}>`);
    return this;
  }

  /** Self-closing element. */
  empty(tag: string, attrs: Attributes = {}): this {
    this.parts.push(`${this.pad()}<${tag}${this.renderAttrs(attrs)}/>`);
    return this;
  }

  /** Element with text content, on one line. */
  text(tag: string, content: string, attrs: Attributes = {}): this {
    this.parts.push(
      `${this.pad()}<${tag}${this.renderAttrs(attrs)}>${escapeText(sanitise(content))}</${tag}>`,
    );
    return this;
  }

  raw(line: string): this {
    this.parts.push(`${this.pad()}${line}`);
    return this;
  }

  toString(): string {
    return `${this.parts.join('\n')}\n`;
  }

  private pad(): string {
    return this.indent.repeat(this.depth);
  }

  private renderAttrs(attrs: Attributes): string {
    const rendered = Object.entries(attrs)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ` ${key}="${escapeAttribute(sanitise(String(value)))}"`)
      .join('');
    return rendered;
  }
}

/**
 * A safe XML NCName derived from arbitrary text.
 *
 * Element ids in PNML and BPMN must be NCNames — no spaces, not starting with
 * a digit — while activity names are whatever the host's data contained. The
 * mapping is deterministic and collision-checked by the caller, so the same
 * model exported twice produces identical ids and the files can be diffed.
 */
export function toNcName(value: string, fallback: string): string {
  const cleaned = value.replaceAll(/[^A-Za-z0-9_.-]/g, '_');
  const prefixed = /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return prefixed === '_' || prefixed === '' ? fallback : prefixed.slice(0, 120);
}
