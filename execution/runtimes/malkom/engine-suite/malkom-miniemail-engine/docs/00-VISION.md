# Malkom Mini Email Engine — Vision

**Package family:** `@malkom/miniemail-core`, `@malkom/miniemail-react`
**Plane:** client (renders inside malkom-client-runtime)
**Position:** fifth Malkom engine; second client-plane engine (after table)
**Status:** vision — no code yet

---

## 1. One-line purpose

Show a single email inside a task detail exactly as it looked in the user's
own mailbox, and let the user act on it — reply, reply all, forward, change
participants, attach, send — without leaving Malkom.

---

## 2. What it is, and what it is not

**It is** a mini mail client scoped to **one email thread**.

**It is not** a mailbox. There are no routes for inbox, drafts, sent,
archive, labels or folders. Nothing is browsable. The engine is handed one
conversation and that conversation is the anchor of the panel.

**Search is the one exception, and it is real mailbox search.** The user can
search the actual mailbox through the provider. The engine shows the hits as
a result list, the user picks **one** email, and that email is fetched and
rendered through exactly the same path as the anchor email — same adapter,
same sanitizing, same actions.

Two rules keep this from becoming a mailbox:

1. **Search is an overlay.** Results and any email opened from them float
   above the panel. Dismiss the overlay and you are back on the task email.
2. **The anchor never moves.** The email attached to the task is always
   present underneath and is never replaced, navigated away from, or lost.

Still one email on screen at a time. The result list is a picker, not a view.

---

## 3. Where it sits in the Malkom pipeline

```
intake (email)
   │  classify + categorize
   │  capture provider metadata: conversationId, messageId, receivedAt
   ▼
queue item  ──────────────────────────────────────────────┐
   │                                                       │
   ▼                                                       │
agentic worker                                             │
   │  reads the same mail via the org's integration         │
   │  pulls attachments as documents                        │
   │  extraction → rules-engine → validation → master data  │
   │  performs the work assigned to the queue item          │
   │                                                        │
   └── on failure / low confidence ──► HITL                 │
                                        │                   │
                                        ▼                   │
                          work-allocation-engine assigns    │
                                        │                   │
                                        ▼                   │
                                   user's "My Queue"        │
                                        │                   │
                                        ▼                   │
                              open task detail  ◄───────────┘
                                        │
                                        ▼
                         ★ malkom-miniemail-engine ★
                    pulls the live mail, renders it,
                       enables the mail actions
```

The engine activates **only at task detail open**. It stores nothing about
the pipeline and knows nothing about queues, allocation, or agentic state.

---

## 4. Ownership boundary

| Concern | Owner |
| --- | --- |
| Provider connections, org auth, token refresh | malkom-integration-engine |
| Deciding which connector applies to this task | host (client-runtime) |
| Provider API shapes, MIME, threading, drafts, send | **this engine** |
| Rendering the email faithfully and safely | **this engine** |
| Send identity (which mailbox the reply comes from) | the connector |

The integration engine supplies **connections, not clean data**. So all
provider mess lives here, behind adapters.

```
        host (client-runtime)
                │  connector handle + email metadata + permissions
                ▼
   ┌──────────────────────────────────────────┐
   │ MalkomMiniEmailEngine (agnostic API)     │
   │                                          │
   │   normalized email model                 │
   │   renderer · composer · action layer     │
   │  ┌────────────────┐  ┌────────────────┐  │
   │  │ GmailAdapter   │  │ GraphAdapter   │  │
   │  └────────────────┘  └────────────────┘  │
   └──────────────────────────────────────────┘
```

Adding a provider later = adding one adapter. Nothing else changes.

**Providers in scope:** Gmail and Outlook (Microsoft Graph). Both are
two-way — read, thread, attachments, drafts, send. Together they cover the
large majority of enterprise mail. SMTP/IMAP is explicitly out of v1; it
would be send-only plus a separate read path, and would weaken drafts and
undo-send. It can arrive later as an adapter if a customer needs it.

---

## 5. Feature scope

### Read
- Full HTML body, rendered as the provider rendered it
- Sender, recipients, cc, bcc (where visible), subject, date
- Inline images resolved from attachment parts
- Remote images blocked until the user allows them
- Earlier messages in the thread, collapsible, quoted-text folding
- Attachment list with download / open-in-Malkom

### Search
- Configurable, **default on** — the host switches it off if it wants to
- Real mailbox search through the provider (Gmail query syntax / Graph search)
- Results shown as a transient overlay list — sender, subject, snippet, date
- Opening a result fetches and renders that email through the normal path
- Anchor email is never replaced; dismissing the overlay returns to it
- Local text search within the currently rendered thread

### Act
- Reply
- Reply all
- Forward
- Add participant / remove participant
- Compose a new mail
- Attach documents
- Send
- Undo send
- Save draft (provider-side)

### Never
- Mailbox navigation of any kind
- Bulk actions across emails
- Deleting or moving mail
- Folder / label management

---

## 6. How faithful rendering works

The body is already HTML. The engine displays it rather than rebuilding it.

1. **Sanitize** — strip scripts, event handlers, trackers, dangerous URLs.
2. **Isolate** — render inside a sealed frame so email CSS cannot leak into
   Malkom and Malkom's CSS cannot alter the email.
3. **Resolve inline images** — swap `cid:` references for the real
   attachment bytes fetched through the connector.
4. **Hold remote images** — blocked by default, with a "show images" bar,
   matching Gmail and Outlook behaviour.
5. **Fit the frame** — height auto-sizes, wide emails scroll inside
   themselves, never breaking the task-detail layout.

The rule: **faithful, but never trusted.**

---

## 7. Actions and identity

- Replies go out through the connector's mailbox. Whatever mailbox the
  connector owns is the sender. The engine does not choose an identity.
- Threading is preserved using provider ids and standard headers, so the
  reply lands in the correct conversation on the provider side.
- Sent mail appears in the real mailbox's Sent folder, because it is a real
  send.
- **Undo send** is client-side: the engine holds the message for a
  configurable delay and shows Undo. On expiry it sends; on cancel it drops.

---

## 8. Capability negotiation

The engine asks the connector what it is permitted to do and adapts:

```
canRead · canSearch · canSend · canDraft · canFetchAttachments ·
canModifyParticipants
```

Buttons the connector cannot support are hidden or disabled with a reason.
The engine never presents an action it cannot complete.

Config layers on top of capability — see §11. If the connector can send but
the host has switched sending off, sending is off. Capability is "is it
possible"; config is "is it wanted".

---

## 9. `MalkomEngineHostConnector` — the first-class host object

Every Malkom engine takes its host input through **one named, fully typed
object**: `MalkomEngineHostConnector`. This is a family standard, not a
mini-email invention. The client runtime is told, once, *which object to
connect to* — the same name, the same shape, for every engine it hosts.

The object has a **common part** (identical across all engines) and an
**engine part** (typed per engine via a generic).

```ts
/** Family-wide. Identical for every Malkom engine. */
export interface MalkomEngineHostConnectorBase {
  /** Which engine this connector is feeding. */
  readonly engine: MalkomEngineId;          // 'miniemail' | 'table' | ...
  /** Contract version, so host and engine can disagree loudly. */
  readonly contractVersion: string;
  /** Who is acting — display, audit, allocation. */
  readonly currentUser: MalkomHostUser;
  /** Tenant / organisation the session belongs to. */
  readonly organisation: MalkomHostOrganisation;
  /**
   * Flat, already-resolved switches. The host has finished applying its
   * role rules before this point — the engine sees booleans, never roles.
   * Engine-specific switches live in `input.options`.
   */
  readonly enabled?: MalkomHostSwitches;
  /** Family ground rule — nothing hardcoded. */
  readonly theme?: MalkomTheme;
  readonly labels?: MalkomLabels;
  readonly icons?: MalkomIcons;
  /** Engine → host. Lifecycle, actions, errors, audit. */
  readonly events?: MalkomHostEventSink;
  /** Host services the engine may call back into. */
  readonly services?: MalkomHostServices;   // logging, documents, toast
}

/** Generic wrapper. Each engine supplies its own payload type. */
export interface MalkomEngineHostConnector<TInput>
  extends MalkomEngineHostConnectorBase {
  readonly input: TInput;
}
```

### The mini-email payload

```ts
export interface MiniEmailHostInput {
  /** Live connection handle from malkom-integration-engine. */
  readonly connection: MalkomIntegrationConnection;
  /** 'gmail' | 'outlook'. May be inferred from the connection. */
  readonly provider?: MiniEmailProvider;
  /** The task's anchor email — captured at intake, never replaced. */
  readonly anchor: {
    readonly conversationId: string;
    readonly messageId: string;
    readonly receivedAt: string;            // ISO
  };
  /** Behavioural config; every field has a documented default. */
  readonly options?: MiniEmailOptions;      // undoSendMs, blockRemoteImages,
                                            // searchEnabled, maxAttachmentMb…
}

export type MiniEmailHostConnector =
  MalkomEngineHostConnector<MiniEmailHostInput>;
```

### Why it is done this way

- **One name to wire.** The runtime does not learn a new prop shape per
  engine — it builds a `MalkomEngineHostConnector` and fills `input`.
- **Fully typed both ways.** The generic carries the engine payload, so a
  wrong shape fails at compile time in the host, not at runtime in a task.
- **Versioned.** `contractVersion` lets an older host and a newer engine
  fail with a clear message instead of behaving strangely.
- **Guarded.** The engine validates the connector on mount and reports a
  precise, actionable error for anything missing.

Outputs travel back through `events`: lifecycle (loaded, failed), actions
(replied, forwarded, sent, draft saved, attachment downloaded, search
performed, result opened), and errors — so the host can audit and advance
the queue item.

---

## 10. Stack

Same stack as the rest of the engine family — no new tooling.

| Piece | Choice |
| --- | --- |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax` |
| Target | ES2022, ESNext modules, Bundler resolution |
| Layout | npm workspaces — `packages/core`, `packages/react` |
| Build | `tsc -b` for ESM, script-built CJS; dual `exports` map |
| Tests | Vitest + jsdom |
| Node | >= 22.5 for dev; published packages support >= 18 |
| Styling | Tailwind tokens + Material Symbols Rounded, all via `theme` / `icons` |
| Runtime deps | none in core; React 19 is a peer of the react package |

Packages: **`@malkom/miniemail-core`** (framework-free engine) and
**`@malkom/miniemail-react`** (thin wrapper). Core owns all logic; the React
package owns no behaviour.

Typing rule for this engine: **no `any` at any boundary.** Provider payloads
are parsed into the normalized model through typed adapters; unknown
provider fields are dropped, not passed through.

---

## 11. Configuration — everything, no exceptions

Family ground rule, applied hard here: **nothing is hardcoded.** Every
behaviour is a config field with a documented default. Defaults make the
engine work out of the box; the host overrides anything it disagrees with.

- All user-facing strings in `labels`, all icons in `icons`, all classes in
  `theme`.
- Strict TypeScript, no domain logic in core.
- Core is framework-free; React is a thin wrapper.
- Engine owns no global state and no DOM singletons.

### `MiniEmailOptions` — the full configurable surface

Illustrative, not final. Every field optional; the value shown is the
default the engine applies when the host says nothing.

```ts
export interface MiniEmailOptions {
  // ── Search ────────────────────────────────────────────────────
  searchEnabled?: boolean;              // true  — host may switch off
  searchPageSize?: number;              // 25
  searchDebounceMs?: number;            // 300
  searchResultActionsEnabled?: boolean; // true  — reply/forward from a hit
  searchOverlayDismissOnEscape?: boolean; // true

  // ── Rendering ─────────────────────────────────────────────────
  blockRemoteImages?: boolean;          // true
  rememberImageChoicePerSender?: boolean; // true
  collapseQuotedText?: boolean;         // true
  collapseThreadBeyond?: number;        // 3 — newest kept open
  maxRenderHeightPx?: number | 'auto';  // 'auto'
  sanitizerProfile?: SanitizerProfile;  // 'strict'
  allowedSchemes?: readonly string[];   // ['http','https','mailto','cid']

  // ── Compose ───────────────────────────────────────────────────
  replyEnabled?: boolean;               // true
  replyAllEnabled?: boolean;            // true
  forwardEnabled?: boolean;             // true
  newMailEnabled?: boolean;             // true
  participantEditEnabled?: boolean;     // true
  signatureMode?: 'provider' | 'none' | 'host'; // 'provider'
  quoteOriginalOnReply?: boolean;       // true

  // ── Send ──────────────────────────────────────────────────────
  // No approval mechanism anywhere. Switches only.
  undoSendEnabled?: boolean;            // true
  undoSendMs?: number;                  // 8000
  confirmBeforeSend?: boolean;          // false — a UI confirm, not approval

  // ── Drafts ────────────────────────────────────────────────────
  draftMode?: 'provider' | 'local' | 'both' | 'off'; // 'provider'
  draftAutosaveMs?: number;             // 5000

  // ── Attachments ───────────────────────────────────────────────
  attachmentsEnabled?: boolean;         // true
  maxAttachmentMb?: number;             // 25
  allowedAttachmentTypes?: readonly string[] | 'any'; // 'any'
  attachmentDelivery?: 'download' | 'hostStore' | 'both'; // 'both'

  // ── Fetch behaviour ───────────────────────────────────────────
  fetchTimeoutMs?: number;              // 20000
  retryAttempts?: number;               // 2
  cacheRenderedEmail?: boolean;         // true
  connectorDownBehaviour?: 'cached' | 'fail'; // 'cached'
}
```

### No approvals — switches only

There is **no approval or sign-off mechanism** in this engine. Nothing waits
for a second party. Reply, reply all and forward simply go out; the user is
already the trusted human in a HITL step, and the mail leaves from the
connector's own mailbox.

Composing a **brand-new mail** is the one action treated separately, because
it is not a response to anything in the task. It is still not an approval —
just its own switch, `newMailEnabled`, which the host sets.

### Roles are the host's business, not the engine's

The engine has no concept of roles, and never will. It reads resolved
booleans and does what they say.

The host decides, entirely on its side:

- which roles may reply, forward, compose new, attach, search
- which roles may *change* these settings at all
- how those role rules resolve into the switches handed over

By the time config reaches the engine it is already flat and final:
`newMailEnabled: false` — nothing about who decided that, or why.

This keeps role logic in one place across all engines instead of being
reimplemented, differently, in each one.

### Decision order

Two layers decide whether an action appears:

```
connector capability   →   MiniEmailOptions
   (can it?)                (does the host allow it?)
```

Both must say yes. Either saying no hides or disables the action, with a
reason the host can surface. Host role rules are already baked into the
second layer.

---

## 12. Open questions for v0.1

1. Attachment handling — does the engine hand bytes to the host document
   store, or only offer download?
2. Draft persistence — provider-side drafts only, or also a local recovery
   buffer if the user navigates away?
3. Offline / connector-down behaviour — is a cached read-only render
   acceptable, or should the panel fail loudly?

Closed since the first draft, all by the same answer — *make it a switch,
default sensible, host decides*:

- search exposure → `searchEnabled` (default on)
- acting on a searched email → `searchResultActionsEnabled` (default on)
- approval before send → **removed entirely.** No approvals anywhere. Reply
  and forward always go straight out; new mail is its own switch.

See §11.
