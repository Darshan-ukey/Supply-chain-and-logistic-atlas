import { z } from 'zod';

/**
 * The engine's vocabulary. Zod is the single source of truth here as in every
 * sibling engine: runtime validation, TypeScript types and exported JSON
 * Schema all come from these definitions.
 *
 * The displayed noun is NOT in this file, deliberately. An AP client says
 * "query", a bank running reconciliation says "break", an insurer says
 * "referral" and a service desk says "ticket". The protocol says handover and
 * the host renders whichever word its people use.
 */

const iso = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), { message: 'not an ISO timestamp' });

const code = z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/, 'codes are SCREAMING_SNAKE');

export const sideSchema = z.enum(['ORIGINATOR', 'RESOLVER', 'EXTERNAL', 'PAUSED', 'NONE']);

/**
 * Where a definition applies. An unset field means "any", so `{}` is
 * everywhere and `{ country: 'DE' }` is German work — the same convention the
 * MALKOM runtime already uses for routing overrides, deliberately, so an
 * administrator learns one rule rather than two.
 *
 * This is the scope of the WORK, never of the person looking at it. A
 * processor in Kolkata handling a Houston invoice must see the Houston list;
 * scoping the catalogue by the viewer would show them the wrong questions and
 * hide the right ones. Who may raise what is authorization, and lives in the
 * host's `Authorizer` instead.
 */
export const scopeSchema = z.object({
  region: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
  office: z.string().max(60).optional(),
  department: z.string().max(80).optional(),
  subDepartment: z.string().max(80).optional(),
  queue: z.string().max(80).optional(),
  subQueue: z.string().max(80).optional(),
  /**
   * What KIND of thing the work is — the queue's own work type, already
   * stamped on every task and transaction by the runtime. It belongs in the
   * scope rather than beside it because catalogues genuinely differ by it:
   * a repair invoice and a terminal invoice at the same office do not offer
   * the same reasons, and pretending otherwise is how a picker ends up four
   * hundred rows long.
   */
  workType: z.string().max(60).optional(),
});
export type Scope = z.infer<typeof scopeSchema>;

/**
 * Ordered broad-to-narrow. The order is not decoration: it is how a scope
 * prints, and it is the order a person reads a grant in.
 */
export const SCOPE_FIELDS = [
  'region', 'country', 'office', 'department', 'subDepartment', 'queue', 'subQueue', 'workType',
] as const;

/** How many fields a predicate pins down — the more, the more specific. */
export const specificityOf = (scope: Scope): number =>
  SCOPE_FIELDS.filter((field) => (scope[field] ?? '') !== '').length;

/** An unset field is "any"; comparison is case-insensitive, as in the host. */
export const scopeMatches = (predicate: Scope, actual: Scope): boolean =>
  SCOPE_FIELDS.every((field) => {
    const wanted = predicate[field] ?? '';
    if (wanted === '') return true;
    return wanted.toUpperCase() === (actual[field] ?? '').toUpperCase();
  });

/**
 * A budget may be absent, and an absent budget is NOT an absent measurement.
 * Trade finance budgets the bank's five banking days and nothing after it; a
 * consumer service desk budgets neither return. Both legs still accrue — that
 * is the difference between this and the industry's "pause the clock".
 */
export const budgetSchema = z.object({
  minutes: z.number().int().positive().max(1_000_000),
  calendarId: z.string().min(1).max(80),
});

export const budgetsSchema = z.object({
  respond: budgetSchema.nullable().default(null),
  act: budgetSchema.nullable().default(null),
  referralMaxMinutes: z.number().int().positive().max(1_000_000).nullable().default(null),
  /** Working minutes of originator silence after which the engine accepts. */
  autoAcceptMinutes: z.number().int().min(0).max(1_000_000).nullable().default(null),
});
export type Budgets = z.infer<typeof budgetsSchema>;

/** A pause must name a reason from the catalogue and must be bounded. */
export const pauseReasonSchema = z.object({
  code,
  label: z.string().min(1).max(120),
  maxMinutes: z.number().int().positive().max(1_000_000),
});

/**
 * One rung of an escalation ladder.
 *
 * A rung names a ROLE, never a person. A ladder that names an individual
 * breaks the week they take leave, which is reliably the week you need it —
 * so the host's directory resolves the role at fire time, against the desk
 * the handover is sitting on.
 */
export const escalationRungSchema = z.object({
  /** Percent of the CURRENT holder's budget spent. 100 = the deadline itself. */
  atPercent: z.number().int().min(1).max(1000),
  /** Resolved by the host's directory when it fires. */
  role: z.string().min(1).max(80),
  /** Where to look for somebody in that role, relative to the holding desk. */
  at: z.enum(['DESK', 'OFFICE', 'COUNTRY', 'REGION', 'GLOBAL']).default('DESK'),
  label: z.string().min(1).max(160),
});
export type EscalationRung = z.infer<typeof escalationRungSchema>;

/**
 * An escalation ladder, settable once and scoped like everything else — which
 * is the point. Ladders written per reason are copied per reason, and the
 * copies drift until nobody can say what the escalation policy is.
 *
 * Escalation never moves the baton. It adds attention; only a transfer moves
 * work, and conflating the two is why escalation ladders stop meaning
 * anything in most systems.
 */
export const escalationLadderSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  /** Empty = wherever nothing narrower applies. Most specific ladder wins. */
  where: scopeSchema.default({}),
  /** Empty = every reason in scope. */
  reasonCodes: z.array(code).max(200).default([]),
  /** Which side's overrun this ladder watches. Both, by default. */
  sides: z.array(z.enum(['RESOLVER', 'ORIGINATOR'])).min(1).default(['RESOLVER', 'ORIGINATOR']),
  rungs: z.array(escalationRungSchema).min(1).max(10),
  enabled: z.boolean().default(true),
});
export type EscalationLadder = z.infer<typeof escalationLadderSchema>;
export type EscalationLadderInput = z.input<typeof escalationLadderSchema>;

/**
 * How often a reason may fire before the engine stops treating each one as
 * news. A reason firing at four times its usual rate is telling you something
 * upstream broke — a master-data feed, a supplier's format, a rule that went
 * live on Tuesday — and working a thousand of them individually is the
 * expensive way to find that out.
 *
 * Counted in a rolling window from the engine's own store, so it needs no
 * denominator from the host and cannot be wrong about its own history.
 */
export const rateLimitSchema = z.object({
  maxPerWindow: z.number().int().positive().max(1_000_000),
  windowMinutes: z.number().int().positive().max(525_600),
  /** WARN surfaces it; SUPPRESS refuses further raises and points at the problem. */
  action: z.enum(['WARN', 'SUPPRESS']).default('WARN'),
});
export type RateLimit = z.infer<typeof rateLimitSchema>;

/**
 * What one scope may change about a reason. Not everything: a variant that
 * could rewrite `code`, `version` or `subjectTypes` would be a different
 * reason wearing the same name, and history would stop meaning anything.
 */
export const reasonVariantSchema = z.object({
  where: scopeSchema,
  note: z.string().max(300).default(''),
  label: z.string().min(1).max(160).optional(),
  asks: z.array(z.string().min(1).max(60)).max(40).optional(),
  answerShape: z.array(z.string().min(1).max(60)).max(40).optional(),
  applyOnAccept: z.record(z.string().min(1).max(60), z.string().min(1).max(120)).optional(),
  budgets: budgetsSchema.optional(),
  blocking: z.boolean().optional(),
  clusterBy: z.string().min(1).max(60).nullable().optional(),
  deflectOn: z.array(z.string().min(1).max(60)).max(8).optional(),
  deflectWithinMinutes: z.number().int().positive().max(5_256_000).optional(),
  defaultDestination: z.string().min(1).max(120).nullable().optional(),
  pauseReasons: z.array(pauseReasonSchema).max(40).optional(),
  rateLimit: rateLimitSchema.nullable().optional(),
  /** false withdraws the reason in this scope only. */
  enabled: z.boolean().optional(),
});
export type ReasonVariant = z.infer<typeof reasonVariantSchema>;

/**
 * A CATEGORY — the rung between "where is this work" and "what exactly is
 * wrong". Written on screen as "Finance : Tax", and that colon is doing one of
 * two completely different jobs.
 *
 * SUB_FAMILY is a narrower name. It groups; nothing routes differently.
 *
 * SCOPE is a condition — the category only exists where the work carries that
 * property, so it is offered INSTEAD of the plain family, not beside it.
 *
 * Stored as one string, neither of those can be asked about, validated, or
 * re-pointed. Stored as fields, both can.
 */
export const categoryDefinitionSchema = z.object({
  key: code,
  family: z.string().min(1).max(120),
  qualifier: z.string().max(120).default(''),
  qualifierKind: z.enum(['SUB_FAMILY', 'SCOPE']).default('SUB_FAMILY'),
  /**
   * For a SCOPE variant: the plain category it stands in for.
   *
   * This matters more than it looks. A scope variant is the SAME category
   * under a condition — in real catalogues it carries exactly the reasons its
   * plain form carries, and exists only so that one site can differ in where
   * they route or how long they get. So when the variant wins, it inherits
   * its base's reasons; without this link it would replace the family and
   * silently take every one of those reasons off the picker at that site,
   * which is a catalogue that looks fine and is missing most of itself.
   */
  variantOf: code.nullable().default(null),
  where: scopeSchema.default({}),
  sequence: z.number().int().min(0).max(10_000).default(0),
  enabled: z.boolean().default(true),
});
export type CategoryDefinitionInput = z.input<typeof categoryDefinitionSchema>;

/**
 * A reason is a contract for an answerable question: what it asks, what a
 * valid answer looks like, and what happens to that answer. Free-text
 * questions are why round-trips happen.
 */
export const reasonDefinitionSchema = z.object({
  code,
  version: z.number().int().positive().default(1),
  label: z.string().min(1).max(160),
  /**
   * The category this reason lives under. Never overridable by a variant: a
   * reason that changed category by scope would be two different reasons
   * sharing a name, and every count grouped by category would quietly be
   * wrong.
   *
   * It defaults rather than refusing, and the default is a real bucket with a
   * name. Making it hard-required would reject every catalogue written before
   * categories existed — which is not strictness, it is a migration nobody
   * asked for. Instead the loose ones land in UNCATEGORISED, are offered under
   * that heading, and are counted by `reasonHealth` so somebody can see how
   * many there are and finish the job.
   */
  categoryKey: code.default('UNCATEGORISED'),
  subjectTypes: z.array(z.string().min(1).max(60)).min(1).max(40),
  /** Field names the raiser must supply. */
  asks: z.array(z.string().min(1).max(60)).max(40).default([]),
  /** Field names a valid answer must carry. This is what makes one round enough. */
  answerShape: z.array(z.string().min(1).max(60)).max(40).default([]),
  /** answer field -> subject path, applied when the originator accepts. */
  applyOnAccept: z.record(z.string().min(1).max(60), z.string().min(1).max(120)).default({}),
  budgets: budgetsSchema.default({ respond: null, act: null, referralMaxMinutes: null, autoAcceptMinutes: null }),
  /** Does the subject stop, or may work continue until the answer is needed? */
  blocking: z.boolean().default(true),
  /** Subject field whose value groups handovers one answer can settle together. */
  clusterBy: z.string().min(1).max(60).nullable().default(null),
  /**
   * Raise fields that identify a repeat of the same question — the known-answer
   * key. It must come from what the raiser KNOWS (supplier, cost centre,
   * office), never from `clusterBy`, which is derived from the answer: keying
   * deflection on the answer means needing the answer to find the answer.
   */
  deflectOn: z.array(z.string().min(1).max(60)).max(8).default([]),
  /** How far back an accepted answer still counts as current. */
  deflectWithinMinutes: z.number().int().positive().max(5_256_000).default(43_200),
  defaultDestination: z.string().min(1).max(120).nullable().default(null),
  pauseReasons: z.array(pauseReasonSchema).max(40).default([]),
  /** Null = no ceiling. A reason with no ceiling can never be suppressed. */
  rateLimit: rateLimitSchema.nullable().default(null),
  enabled: z.boolean().default(true),

  /**
   * Where the BASE definition applies. Empty means every country, region,
   * office and queue — the right default, because most reasons are global and
   * only a few are local. A catalogue that forces every reason to name its
   * scope turns forty offices into forty maintained copies.
   */
  where: scopeSchema.default({}),

  /**
   * Narrower scopes that CHANGE this reason rather than replace it. Applied
   * most-general first, so an office variant lands on top of a region variant
   * on top of the base. `enabled: false` in a variant withdraws the reason in
   * that scope without deleting it anywhere else.
   */
  variants: z.array(reasonVariantSchema).max(200).default([]),
});
export type ReasonDefinition = z.infer<typeof reasonDefinitionSchema>;
export type ReasonDefinitionInput = z.input<typeof reasonDefinitionSchema>;

/**
 * A desk that answers questions. It is configuration rather than a string
 * because everything above it needs to know where a desk SITS: a grant saying
 * "everything under EMEA" can only reach a destination that knows its region,
 * and a metric sliced by department can only exist if a fact row carries one.
 *
 * Membership is deliberately absent. Who works this desk is the host's
 * directory, and copying it here would make the engine wrong the first time
 * somebody changes teams.
 */
export const destinationSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  department: z.string().min(1).max(80),
  subDepartment: z.string().max(80).default(''),
  office: z.string().max(60).default(''),
  country: z.string().max(60).default(''),
  region: z.string().max(60).default(''),
  /** Which side of the handover this desk sits on, for the noun a UI shows. */
  side: z.enum(['RESOLVER', 'ORIGINATOR', 'EXTERNAL']).default('RESOLVER'),
  enabled: z.boolean().default(true),
});
export type Destination = z.infer<typeof destinationSchema>;
export type DestinationInput = z.input<typeof destinationSchema>;

/** The scope a destination occupies — what a grant is matched against. */
export const scopeOfDestination = (destination: Destination): Scope => ({
  ...(destination.region === '' ? {} : { region: destination.region }),
  ...(destination.country === '' ? {} : { country: destination.country }),
  ...(destination.office === '' ? {} : { office: destination.office }),
  department: destination.department,
  ...(destination.subDepartment === '' ? {} : { subDepartment: destination.subDepartment }),
});

// ---------------------------------------------------------------------------
// Access: role is what you may do, grant is what you may do it to
// ---------------------------------------------------------------------------

/**
 * Capabilities, not roles. A role is a bundle of these that a host names —
 * "AP Resolver", "Regional Lead" — and the bundle belongs to the host's own
 * RBAC, which already exists and already has a vocabulary. What the engine
 * needs is the verb, so that every read and every command asks the same
 * question in the same way.
 */
export const CAPABILITIES = [
  'read',            // see that it exists, and its timeline
  'read.internal',   // see comments marked internal to one side
  'raise',
  'comment',
  'attach',
  'answer',          // resolver-side: substantive reply
  'refer',           // resolver-side: hand to a party outside the system
  'reassign',        // resolver-side: move inside the holding desk
  'reroute',         // resolver-side: correct the destination
  'requery',         // originator-side: push back
  'accept',          // originator-side: terminal
  'withdraw',        // originator-side: terminal
  'reopen',
  'administer',      // change the catalogue and destinations
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * What a person may do, and over which work. Grants are ADDITIVE: reach is
 * the union of them, so narrowing someone means giving fewer grants, never
 * writing an exclusion. That is the runtime's own rule — access only ever
 * narrows a built-in role and never lifts it — and an exclusion list is how
 * a permission model becomes impossible to reason about.
 *
 *   { capabilities: ['read','answer'], where: { office: 'USHOU' } }
 *   { capabilities: ['read','answer'], where: { office: 'USDAL' } }
 *      → answers for exactly two offices
 *
 *   { capabilities: ['read','answer'], where: { region: 'EMEA' } }
 *      → answers for everything under a region
 *
 *   { capabilities: ['read'], where: {} }
 *      → reads everywhere, answers nowhere
 */
export const scopeGrantSchema = z.object({
  capabilities: z.array(z.enum(CAPABILITIES)).min(1),
  where: scopeSchema.default({}),
  note: z.string().max(200).default(''),
});
export type ScopeGrant = z.infer<typeof scopeGrantSchema>;

/**
 * The caller, as the host describes them. The engine never looks anyone up:
 * the host owns identity and owns which grants a person holds. What the engine
 * owns is applying them the same way on every path, so a list and a command
 * can never disagree about what somebody may see.
 */
export const viewerSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(160).default(''),
  /** Unit snapshot, stamped onto events so "which desk said this" survives. */
  unit: z.string().max(160).default(''),
  grants: z.array(scopeGrantSchema).max(200).default([]),
  /**
   * The engine acting on its own behalf — auto-accept, pause expiry. Never
   * settable from a request body; the host constructs it or it does not exist.
   */
  system: z.boolean().default(false),
});
export type Viewer = z.infer<typeof viewerSchema>;
export type ViewerInput = z.input<typeof viewerSchema>;

/** The engine itself. Explicit and greppable, so a bypass is never accidental. */
export const SYSTEM_VIEWER: Viewer = { id: 'system', name: 'engine', unit: '', grants: [], system: true };

export const attachmentRefSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  kind: z.string().max(80).default(''),
  addedBy: z.string().max(120).default(''),
  addedAt: iso,
  /** SUBJECT came with the work; EVIDENCE was added to argue the query. */
  origin: z.enum(['SUBJECT', 'EVIDENCE']).default('EVIDENCE'),
});
export type AttachmentRef = z.infer<typeof attachmentRefSchema>;

export const subjectSchema = z.object({
  type: z.string().min(1).max(60),
  id: z.string().min(1).max(200),
  /** Which field on the subject is unworkable, when the raise came from one. */
  path: z.string().min(1).max(120).nullable().default(null),
  display: z.string().max(200).nullable().default(null),
  /**
   * The queue's own data, frozen at the moment of raising. Opaque here on
   * purpose — the engine stores it, lays it out from the host's declaration
   * and never learns what any of it means. That is the difference between an
   * engine that moves to the next queue and one that has to be rewritten.
   */
  values: z.record(z.string().max(80), z.unknown()).default({}),
  attachments: z.array(attachmentRefSchema).max(200).default([]),
  /**
   * The instant the DOCUMENT's own age counts from — the invoice date, the
   * booking date. It started long before the query existed, it never pauses,
   * and it is what the client is actually counting. Taken from the host,
   * shown, never owned.
   */
  ageAnchor: iso.nullable().default(null),
});

/**
 * Advisory only. The authoritative identity is the Viewer passed alongside the
 * command; this exists so a host can record an on-behalf-of without the engine
 * ever trusting a caller for anything that matters — least of all which side
 * they stand on.
 */
export const actorSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(160).default(''),
});
export type Actor = z.infer<typeof actorSchema>;

/**
 * Who a comment is for. A remark aimed at one desk and one aimed at everybody
 * are different acts, and a trail that cannot tell them apart cannot answer
 * "who was this said to" — which is half of what a history is for.
 */
export const commentAudienceSchema = z.object({
  /** Destination ids this is addressed to. Empty = everyone on the handover. */
  to: z.array(z.string().min(1).max(120)).max(20).default([]),
  /**
   * BOTH is the default because a handover is a conversation between two
   * parties. The one-sided values exist for a desk working out its own answer,
   * and they are gated by the read.internal capability — never by obscurity.
   */
  visibility: z.enum(['BOTH', 'RESOLVER_ONLY', 'ORIGINATOR_ONLY']).default('BOTH'),
});
export type CommentAudience = z.infer<typeof commentAudienceSchema>;

export const commentDataSchema = z.object({
  body: z.string().min(1).max(10_000),
  audience: commentAudienceSchema.default({ to: [], visibility: 'BOTH' }),
  /** Threading, so a reply is attached to what it replies to. */
  parentId: z.string().max(120).nullable().default(null),
});

/** Bringing a desk in without handing the handover to it. */
export const participantDataSchema = z.object({
  destinationId: z.string().min(1).max(120),
  /** A watcher reads; a contributor may comment. Neither owes the answer. */
  role: z.enum(['WATCHER', 'CONTRIBUTOR']).default('WATCHER'),
  note: z.string().max(300).default(''),
});

export const COMMAND_TYPES = [
  'raise',
  'escalate',
  'comment',
  'add-participant',
  'remove-participant',
  'answer',
  /**
   * One answer, many items. The single highest-leverage act on the resolver's
   * side: the same problem repeats across dozens of items for one counterparty
   * and one office, and settling them one at a time is most of a day.
   * Fans out to one properly written entry per item — the record must never
   * look like forty people did forty things.
   */
  'answer-many',
  /**
   * A file added AFTER the raise, by either side. The raiser attaches what was
   * asked for; the resolver attaches the agreement they checked. Without this,
   * evidence exists only at the moment of raising — which is the one moment
   * nobody yet knows what will be needed.
   */
  'add-evidence',
  'requery',
  'accept',
  'withdraw',
  'auto-accept',
  'reassign',
  'reroute',
  'refer',
  'external-response',
  'pause',
  'resume',
  'reopen',
] as const;
export type CommandType = (typeof COMMAND_TYPES)[number];

/** Terminal states belong to the originating side, plus the engine's timeout. */
export const TERMINAL_COMMANDS: readonly CommandType[] = ['accept', 'withdraw', 'auto-accept'];

export const commandSchema = z.object({
  type: z.enum(COMMAND_TYPES),
  handoverId: z.string().min(1).max(120).nullable().default(null),
  /** Required on every write; a replay returns the first result unchanged. */
  idempotencyKey: z.string().min(1).max(240),
  /** Optimistic concurrency. Omit only on raise. */
  expectedVersion: z.number().int().min(0).nullable().default(null),
  at: iso,
  actor: actorSchema.optional(),
  reason: z.string().max(500).default(''),
  data: z.record(z.string(), z.unknown()).default({}),
});
export type Command = z.infer<typeof commandSchema>;
export type CommandInput = z.input<typeof commandSchema>;

export const raiseDataSchema = z.object({
  reasonCode: code,
  subject: subjectSchema,
  /** The WORK's scope, derived by the host from the transaction, not sent by a client. */
  scope: scopeSchema.default({}),
  destination: z.string().min(1).max(120).nullable().default(null),
  question: z.string().min(1).max(5000),
  fields: z.record(z.string(), z.unknown()).default({}),
  clusterKey: z.string().max(200).nullable().default(null),
});

export const answerDataSchema = z.object({
  body: z.string().min(1).max(10_000),
  fields: z.record(z.string(), z.unknown()).default({}),
  /**
   * Set only by the engine when fanning a bulk answer out. Counting these is
   * how you tell real throughput apart from the leverage one bulk act gave
   * you — without it, forty settled items read as forty answers given.
   */
  settledWith: z.string().max(120).nullable().default(null),
});

/**
 * The bulk answer. `alsoHandoverIds` are the others this same answer settles.
 *
 * `perItemNote` exists because thirty-nine get the standard line and one needs
 * a sentence of its own — bulk with an escape hatch beats bulk that forces
 * everything to be identical, and without the hatch people stop using it.
 *
 * The batch is all-or-nothing. If any item in the selection sits outside the
 * actor's reach the whole act is refused by name: a bulk action is exactly
 * where a permission hole would go unnoticed for months.
 */
export const answerManyDataSchema = z.object({
  body: z.string().min(1).max(10_000),
  fields: z.record(z.string(), z.unknown()).default({}),
  alsoHandoverIds: z.array(z.string().min(1).max(120)).min(1).max(500),
  perItemNote: z.record(z.string().max(120), z.string().max(2_000)).default({}),
  /** The bulk answer ADDS; it never stamps over what an item already said. */
  keepIndividualNotes: z.boolean().default(true),
});

export const evidenceDataSchema = z.object({
  attachments: z.array(attachmentRefSchema).min(1).max(50),
  note: z.string().max(2_000).default(''),
});

export const configBundleSchema = z.object({
  /** The rung between "where" and "what" — see categoryDefinitionSchema. */
  categories: z.array(categoryDefinitionSchema).max(256).default([]),
  reasons: z.array(reasonDefinitionSchema).max(512).default([]),
  ladders: z.array(escalationLadderSchema).max(128).default([]),
  /** The words this deployment shows. The protocol never hardcodes them. */
  nouns: z
    .object({
      caseOne: z.string().min(1).max(40).default('handover'),
      caseMany: z.string().min(1).max(40).default('handovers'),
      originator: z.string().min(1).max(40).default('originator'),
      resolver: z.string().min(1).max(40).default('resolver'),
    })
    .default({ caseOne: 'handover', caseMany: 'handovers', originator: 'originator', resolver: 'resolver' }),
});
export type ConfigBundle = z.infer<typeof configBundleSchema>;
