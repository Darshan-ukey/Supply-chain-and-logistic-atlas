# Malkom Mini Email Engine — Architecture

## Position in the engine family

Fifth Malkom engine; second **client-plane** engine, after the table engine.
Same family ground rules: everything configurable, nothing hardcoded;
user-facing strings in `labels`, icons in `icons`, classes in `theme`; core is
framework-free and React is a thin wrapper.

Where the table engine renders host-supplied rows, this one fetches its own
data from a third party — so it carries two things the table engine does not: a
**provider boundary** and a **trust boundary**.

## Split of ownership

```
┌────────────────────────────────────────────────────────────────┐
│ host (malkom-client-runtime)                                   │
│   builds MalkomEngineHostConnector<MiniEmailHostInput>         │
│   resolves its role rules into flat booleans                   │
└───────────────────────────┬────────────────────────────────────┘
                            │ connector
┌───────────────────────────▼────────────────────────────────────┐
│ MalkomMiniEmailEngine (state + policy)                         │
│   contract validation · capability read · availability         │
│   anchor thread · search overlay · compose · undo send         │
│  ┌──────────────────────────┐  ┌───────────────────────────┐   │
│  │ render/ (trust boundary) │  │ adapters/ (provider bdry) │   │
│  │  sanitize · frame        │  │  gmail · graph            │   │
│  │  images · quote          │  │  mime · callProvider      │   │
│  └──────────────────────────┘  └───────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

Neither boundary module knows about the other. The sanitizer has never heard of
Gmail; the Gmail adapter has never heard of an iframe.

## Module map (`packages/core/src`)

| Module | Responsibility |
| --- | --- |
| `types.ts` | Entire public type surface, incl. `MalkomEngineHostConnector` |
| `contract.ts` | Contract version + connector validation on construction |
| `defaults/options.ts` | Every behavioural constant, and `resolveMiniEmailOptions` |
| `availability.ts` | Capability × config → which actions may be offered |
| `compose.ts` | Reply / reply-all / forward / new draft building, participants, validation |
| `undoSend.ts` | The hold buffer behind Undo |
| `engine.ts` | State, actions, events, wiring |
| `render/sanitize.ts` | Allowlist HTML cleaner |
| `render/frame.ts` | Sandboxed iframe, auto-height, quote folding |
| `render/images.ts` | `cid:` resolution, remote-image reveal, per-sender trust |
| `render/quote.ts` | Quoted-region detection and marking |
| `adapters/adapter.ts` | Adapter interface, timeout/retry, error mapping, narrowing helpers |
| `adapters/mime.ts` | Address parsing, base64/base64url, RFC 5322 building |
| `adapters/gmail.ts` | Gmail: MIME tree, base64url, threads, raw send |
| `adapters/graph.ts` | Graph: structured JSON, conversation filter, sendMail |
| `adapters/index.ts` | `createAdapter` — the only place providers are enumerated |

## Design decisions

### The anchor never moves

`state.anchorThread` is the email the task was raised against. Search results
open into `state.overlayThread`, which floats above it. Nothing replaces the
anchor, because losing it would strand the reader in someone else's mailbox
with no way back to their work.

### Two layers, never three

Capability answers "can the connector do this"; config answers "does the host
want it". Both must agree. There is no third permissions layer, because the
host has already resolved its role rules into the config it handed over —
keeping role logic in one place across all engines instead of reimplemented,
differently, in each.

`resolveAvailability` computes every action at once so the answer cannot drift
between two parts of the UI asking the same question.

### No approvals anywhere

Reply, reply all and forward send straight out. The reader is the trusted human
in a HITL step and the mail leaves from the connector's own mailbox, so a
second sign-off would add ceremony without adding safety. New mail is a switch,
not an approval.

### `class` and `id` survive sanitizing

Deliberate, and the one place the allowlist widens. Inside a sealed frame with
no host stylesheet and no script they are inert — and they carry the only
reliable evidence of a quoted region (`gmail_quote`, `divRplyFwdMsg`,
`yahoo_quoted`). Stripping them would leave quote detection guessing from prose.

### Scheme detection, not URL parsing

`new URL()` needs a base and throws on the relative and malformed values email
is full of, so schemes are matched directly after stripping control characters
— including `U+FFFD`, which an HTML parser substitutes for a NUL byte. A naive
prefix test lets `java\0script:` through.

### The frame is written, not `srcdoc`'d

`srcdoc` would leave the body unreachable for later mutation. Writing through
the frame's own document keeps the live DOM available, so revealing images and
unfolding a quote need no re-parse and no re-sanitize.

`allow-scripts` is absent from the sandbox, and must stay absent.

### Sends are never retried

`callProvider` retries reads on 408/429/5xx. Sends pass `{ retry: false }`,
because a retried send may deliver the same message twice and the reader has no
way to take that back. Undo works precisely because the message has not left
yet — it is a hold, not a recall.

### Inline images are pre-fetched; documents are not

A `cid:` image with no bytes renders as a hole in the mail, so those are fetched
during load. A document attachment costs nothing to leave until someone asks
for it. A failed inline fetch degrades to a placeholder rather than failing the
whole mail.

### `exactOptionalPropertyTypes` and clearing state

`Partial<MiniEmailState>` cannot express "clear the compose surface" under this
flag — absent and explicitly-`undefined` are different things. `#setState`
takes a patch where `undefined` means clear, and deletes the key rather than
storing an undefined value.

## Provider differences the adapters absorb

| | Gmail | Graph |
| --- | --- | --- |
| Conversation | `threads.get` returns all messages | property on messages; needs a filtered list |
| Body | nested MIME part tree, must be walked | structured `body` field |
| Encoding | base64url | base64 |
| Attachments | separate call per attachment | sub-collection, `$expand`able |
| Send | raw RFC 5322 message | structured JSON |
| Threading | `threadId` + headers | `conversationId` + `internetMessageHeaders` |
| Search | one `q` string, Gmail syntax | `$search` (KQL) or `$filter`, never both |
| Paging | `nextPageToken` | `@odata.nextLink`, skiptoken extracted |

Adding a provider means one new adapter and one branch in `createAdapter`.
Nothing above the boundary changes.

## Tests

252 across 13 files. The two boundaries carry the heaviest coverage:

- `sanitize` (31) — execution vectors, faithful rendering, link and image policy
- `engine` (41) — loading, search overlay, compose, send, undo, guards
- `compose` (34) — recipients, subjects, quoting, participants, validation
- `gmail` (25) / `graph` (26) — provider payload shapes against fake connectors
- `frame` (18) — isolation, sanitizing on the way in, images, quote, sizing
- `quote` (17), `images` (16), `availability` (14), `undoSend` (11)
- `contract` (7), `options` (7), React binding (5)
