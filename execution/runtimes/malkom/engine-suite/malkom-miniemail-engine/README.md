# Malkom Mini Email Engine

A mini mail client for **one email**, rendered inside malkom-client-runtime's
task detail — as it looked in the user's own mailbox, with the actions they
would expect there.

```
@malkom/miniemail-core    framework-free engine, zero runtime dependencies
@malkom/miniemail-react   thin React binding, owns no behaviour
```

Fifth Malkom engine; second on the client plane, after the table engine.

## What it does

**Read** — the real HTML body, sender, recipients, dates, attachments, inline
images, and the earlier messages of the thread with quoted text folded.

**Act** — reply, reply all, forward, add and remove participants, compose a new
mail, attach files, send, undo send, save a draft.

**Search** — real provider mailbox search. Results appear as an overlay; the
reader opens one email at a time. The task's email stays underneath and is
never replaced.

**Not** a mailbox. No inbox, drafts, sent, labels or folders. One conversation
is the anchor, and everything else floats above it.

## Where it sits

```
intake (email) → classify, capture provider metadata onto the queue item
      ↓
agentic worker → extraction, rules, validation, master data
      ↓ on failure
HITL → work-allocation assigns → user opens task detail
      ↓
★ this engine loads the live email and enables the mail actions ★
```

The engine activates only at task detail open. It knows nothing about queues,
allocation, or agentic state.

## Ownership

| Concern | Owner |
| --- | --- |
| Provider connections, org auth, token refresh | malkom-integration-engine |
| Which connector applies to this task | host (client-runtime) |
| Provider API shapes, MIME, threading, drafts, send | **this engine** |
| Faithful, safe rendering | **this engine** |
| Send identity — which mailbox the reply comes from | the connector |

The integration engine supplies **connections, not clean data**, so all
provider mess lives here behind adapters: `GmailAdapter`, `GraphAdapter`. One
normalized model above them; nothing else in the engine knows a provider
exists.

## Quick start

```tsx
import { useMiniEmail, MiniEmailFrame } from '@malkom/miniemail-react';

function TaskEmail({ connection, anchor }) {
  const { engine, state, availability } = useMiniEmail({
    engine: 'miniemail',
    contractVersion: '1.0.0',
    currentUser: { id: user.id, displayName: user.name },
    organisation: { id: org.id },
    onEvent: (event) => audit.record(event),
    input: {
      connection,                       // from malkom-integration-engine
      anchor,                           // conversationId + messageId from intake
      options: { undoSendMs: 10_000 }   // everything else keeps its default
    }
  });

  const message = state.anchorThread?.messages.at(-1);
  if (!message) return null;

  return (
    <>
      <MiniEmailFrame
        message={message}
        options={state.options}
        blockRemoteImages={engine.shouldBlockRemoteImages(message)}
      />
      {availability.reply.allowed && (
        <button onClick={() => engine.compose('reply')}>Reply</button>
      )}
    </>
  );
}
```

## The host contract

Every Malkom engine takes host input through one named, fully typed object:
`MalkomEngineHostConnector<TInput>`. The base is identical across engines; the
`input` payload is typed per engine.

```ts
type MiniEmailHostConnector = MalkomEngineHostConnector<MiniEmailHostInput>;
```

Base: `engine`, `contractVersion`, `currentUser`, `organisation`, `enabled`,
`theme`, `labels`, `icons`, `services`, `onEvent`.
Payload: `connection`, `provider?`, `anchor`, `options?`.

`contractVersion` is checked on construction. A major mismatch fails loudly
rather than behaving strangely.

## Configuration

**Everything configurable, nothing hardcoded.** Every behaviour is a field on
`MiniEmailOptions` with a documented default, and the defaults ship on — a host
overrides only what it disagrees with.

Grouped: search, rendering, compose, send, drafts, attachments, fetch
behaviour. See `DEFAULT_MINIEMAIL_OPTIONS` for the full set with values.

## Two layers decide every action

```
connector capability   →   config
   (can it?)               (does the host want it?)
```

Both must agree. `engine.availability` resolves all actions at once and reports
why each is unavailable.

**There is no approval mechanism.** Reply, reply all and forward go straight
out — the reader is already the trusted human in a HITL step, and the mail
leaves from the connector's own mailbox. Composing a brand-new mail has its own
switch, `newMailEnabled`, because it is not a response to anything in the task.

**Roles are the host's business.** The engine has no concept of roles. The host
decides who may reply, forward, compose, attach or search — and who may change
those settings — then resolves all of it into flat booleans. The engine reads
`newMailEnabled: false` and never asks who decided.

## Rendering: faithful, but never trusted

1. **Sanitize** — allowlist, never blocklist. Scripts, handlers, forms, frames
   and unknown schemes are removed; tables, fonts and inline styles are kept,
   because that is what makes the mail look like itself.
2. **Isolate** — the body renders in a sandboxed `iframe` with no host
   stylesheet, so email CSS cannot reach Malkom and Malkom's resets cannot
   restyle the email.
3. **Resolve inline images** — `cid:` references are swapped for attachment
   bytes as data URLs. No network request.
4. **Withhold remote images** — blocked until the reader asks, because loading
   one tells the sender the mail was opened. Per-sender trust is remembered
   in memory.
5. **Fold the quote** — the repeated older message is marked and hidden, the
   way every mail client does it.

## Development

```bash
npm install
npm run build       # dual ESM + CJS
npm test            # 252 tests
npm run typecheck
```

Strict TypeScript throughout: `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`. No `any` at any boundary
— provider payloads arrive as `unknown` and are narrowed by adapters, so
provider shapes cannot leak into the model.

## Documents

- [Vision](docs/00-VISION.md) — scope, ground rules, non-goals, open questions
- [Architecture](docs/01-ARCHITECTURE.md) — module map and design decisions
