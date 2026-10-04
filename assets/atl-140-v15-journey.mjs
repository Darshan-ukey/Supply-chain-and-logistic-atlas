// S8-4: ATL-140 additive Product UX behaviour (the Road LTL -> governed work intelligence -> Malkom output
// journey), REBOUND onto the certified Canvas V2.0 shell without modifying it.
// Behavioural source: ATL-140 @ e0c17bbb85bda27ebb9189be7cc845e3c48979dd (index.html #atlas-v15-malkom-journey).
// The certified root index.html and Canvas assets stay byte-identical; this module is bootstrapped additively
// (like the certified P4 bridge) from execution/ui/runtime-access-shell.js and only renders a fixed launcher.
// The work-detail link is resolved through the certified Canvas->Daughter bridge V2.0.1 and its governed target
// registry; if the registry cannot be resolved the link is disabled (fail closed). No target is guessed.
import {buildDaughterHref, resolveDaughterTarget, TARGET_REGISTRY_PATH} from './canvas-daughter-bridge-v2.0.1.mjs';
// S8-5B successor interaction identity: bounded ATL-167 Deepen/Inspect control for road-ltl@1.5 / LTL-04 (additive; not a retroactive S8-4 change).
import {deepenControlMarkup, wireDeepen} from './atl-167-v15-deepen-inspect.mjs';

export const JOURNEY_SECTION_ID = 'atlas-v15-malkom-journey';
export const JOURNEY_SCOPE = Object.freeze({moduleId: 'road-ltl', taskId: 'LTL-04'});
export const CONSUMER_VIEW_PATH = '/atl-140-malkom-consumer.html';
export const FLOW_ANCHOR_PATH = `${CONSUMER_VIEW_PATH}#generated-flow`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// Resolves the Daughter href through the governed bridge; null when the governed registry does not resolve the module.
export function resolveWorkDetailHref(registry, scope = JOURNEY_SCOPE) {
  const target = resolveDaughterTarget(registry, scope.moduleId);
  if (!target) return null;
  return buildDaughterHref({moduleId: target.moduleId, moduleVersion: target.daughterModuleVersion, taskId: scope.taskId});
}

export function journeyMarkup(workDetailHref) {
  const detail = workDetailHref
    ? `<a href="${esc(workDetailHref)}" data-journey-link="work-detail">Open Road LTL / LTL-04 journey</a>`
    : '<span data-journey-link="work-detail" aria-disabled="true">Road LTL / LTL-04 journey unavailable (governed target not resolved)</span>';
  return `<section id="${JOURNEY_SECTION_ID}" aria-labelledby="v15JourneyTitle"><p><strong>Atlas v1.5 Domain Warehouse demo/live</strong></p><h2 id="v15JourneyTitle">Road LTL → governed work intelligence → Malkom output</h2><p>Atlas remains the reusable domain/work intelligence layer. Malkom is a bounded consumer projection, not Atlas itself.</p><nav aria-label="Atlas v1.5 Malkom journey">${detail} · <a href="${FLOW_ANCHOR_PATH}" data-journey-link="trace-flow">Trace generated flow</a> · <a href="${CONSUMER_VIEW_PATH}" data-journey-link="consumer-output">Inspect Malkom consumer output</a></nav><p><small>Public domain knowledge is separated from protected/admin execution semantics; unresolved client binding remains fail-closed.</small></p>${deepenControlMarkup(workDetailHref)}</section>`;
}

const STYLE = `#${JOURNEY_SECTION_ID}-host{position:fixed;left:12px;bottom:12px;z-index:2147483000;max-width:min(420px,calc(100vw - 24px));font:13px/1.4 system-ui,sans-serif}#${JOURNEY_SECTION_ID}-host summary{cursor:pointer;background:#fff;border:1px solid #d7d7d7;border-radius:999px;padding:6px 12px;box-shadow:0 2px 8px rgba(0,0,0,.15);color:#111}#${JOURNEY_SECTION_ID}-host section{margin-top:6px;padding:10px 12px;background:#fff;border:1px solid #d7d7d7;border-radius:12px;color:#111;box-shadow:0 2px 8px rgba(0,0,0,.15)}#${JOURNEY_SECTION_ID}-host h2{font-size:15px;margin:4px 0}#${JOURNEY_SECTION_ID}-host p{margin:4px 0}`;

export async function loadRegistry(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch unavailable for governed target registry.');
  const r = await fetchImpl(TARGET_REGISTRY_PATH, {credentials: 'same-origin', cache: 'no-store', headers: {Accept: 'application/json'}});
  if (!r.ok) throw new Error(`Governed target registry unavailable (${r.status}).`);
  const d = await r.json();
  if (d?.status !== 'ACTIVE_P4_INTEGRATION_CONTRACT') throw new Error('Governed target registry is not active.');
  return d;
}

export function install(doc, workDetailHref, {fetchImpl = globalThis.fetch} = {}) {
  if (!doc || doc.getElementById(`${JOURNEY_SECTION_ID}-host`)) return null;
  const style = doc.createElement('style');
  style.id = `${JOURNEY_SECTION_ID}-style`;
  style.textContent = STYLE;
  doc.head.appendChild(style);
  const host = doc.createElement('details');
  host.id = `${JOURNEY_SECTION_ID}-host`;
  host.innerHTML = `<summary>Atlas v1.5 · Malkom journey</summary>${journeyMarkup(workDetailHref)}`;
  doc.body.appendChild(host);
  wireDeepen(host, {fetchImpl});
  return host;
}

export async function bootJourney({doc = globalThis.document, fetchImpl = globalThis.fetch} = {}) {
  if (!doc) return null;
  let href = null;
  try { href = resolveWorkDetailHref(await loadRegistry(fetchImpl)); } catch { href = null; }
  const run = () => install(doc, href, {fetchImpl});
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', run, {once: true}); else run();
  return href;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') bootJourney().catch((e) => console.warn('Atlas ATL-140 v1.5 Malkom journey', e));
