import type { DestinationInput, Viewer } from '../src/index.js';

/**
 * Test principals. They are deliberately real rather than a rubber stamp: a
 * suite that hands every call an unrestricted viewer proves the engine works
 * for administrators and nobody else.
 */

export const DESKS: readonly DestinationInput[] = [
  { id: 'onshore.ap.USHOU', label: 'AP Houston', department: 'AP', office: 'USHOU', country: 'US', region: 'AMER' },
  { id: 'onshore.ap.USDAL', label: 'AP Dallas', department: 'AP', office: 'USDAL', country: 'US', region: 'AMER' },
  { id: 'onshore.ap.EMEA', label: 'AP EMEA', department: 'AP', office: 'NLRTM', country: 'NL', region: 'EMEA' },
  { id: 'onshore.ap.DEFRA', label: 'AP Frankfurt', department: 'AP', office: 'DEFRA', country: 'DE', region: 'EMEA' },
  { id: 'onshore.wh.USDAL', label: 'Warehouse Dallas', department: 'WAREHOUSE', office: 'USDAL', country: 'US', region: 'AMER' },
  { id: 'onshore.wh.USHOU', label: 'Warehouse Houston', department: 'WAREHOUSE', office: 'USHOU', country: 'US', region: 'AMER' },
  { id: 'onshore.ap.GLOBAL', label: 'AP Global', department: 'AP' },
  { id: 'first', label: 'First', department: 'AP' },
  { id: 'second', label: 'Second', department: 'AP' },
];

const ORIGINATOR_CAPS = ['read', 'raise', 'requery', 'accept', 'withdraw', 'reopen', 'comment', 'attach'] as const;
const RESOLVER_CAPS = ['read', 'answer', 'refer', 'reassign', 'reroute', 'comment', 'attach'] as const;

export const offshore = (id = 'usr_priya', name = 'Priya', where = {}): Viewer => ({
  id, name, unit: 'Offshore AP · Kolkata', system: false,
  grants: [{ capabilities: [...ORIGINATOR_CAPS], where, note: '' }],
});

export const onshore = (id = 'usr_dale', name = 'Dale', where = {}): Viewer => ({
  id, name, unit: 'AP Houston', system: false,
  grants: [{ capabilities: [...RESOLVER_CAPS], where, note: '' }],
});

/** Reads everything; acts nowhere. The auditor and the supervisor board. */
export const observer: Viewer = {
  id: 'usr_lead', name: 'Lead', unit: 'AP Global', system: false,
  grants: [{ capabilities: ['read'], where: {}, note: '' }],
};

/** Both sets of verbs everywhere — still cannot answer what they raised. */
export const admin: Viewer = {
  id: 'usr_admin', name: 'Admin', unit: 'Operations', system: false,
  grants: [{ capabilities: [...ORIGINATOR_CAPS, ...RESOLVER_CAPS, 'administer'], where: {}, note: '' }],
};

/** Maps a test command's advisory actor onto the viewer it stands for. */
export const asViewer = (actor: { id?: string; side?: string } | undefined): Viewer => {
  if (actor === undefined) return admin;
  if (actor.side === 'RESOLVER') return onshore(actor.id ?? 'usr_dale', 'Dale');
  if (actor.side === 'NONE') return { ...admin, system: true };
  return offshore(actor.id ?? 'usr_priya', 'Priya');
};

/** Register every desk a test might route to. A raise to an unknown desk is
 *  refused now, because a handover nobody's grant can reach is a black hole. */
export const registerDesks = (engine: { putDestination: (d: DestinationInput) => unknown }): void => {
  for (const desk of DESKS) engine.putDestination(desk);
};

/** Run a command as the viewer its advisory actor stands for. */
export const run = (
  engine: { handle: (command: never, viewer: Viewer) => unknown },
  command: { actor?: { id?: string; side?: string } },
): never => engine.handle(command as never, asViewer(command.actor)) as never;
