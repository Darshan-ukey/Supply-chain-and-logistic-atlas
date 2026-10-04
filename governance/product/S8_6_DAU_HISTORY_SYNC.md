# S8-6 — Bounded DAU-007 history-sync remediation (also closes the reopened DAU-006 deep-link/reload regression)

Status: IMPLEMENTED on the corrected successor lineage. PASS here means only the bounded governed-navigation capability below. It is not runtime readiness, UAT, ATL-181 PASS, sign-off, promotion or deployment.

Base: S8-5B final evidence head `97e3086daa7b1ca694d019f0f30bb2c3150e7a6d` (tree `33c820c5d5c347ca918f128492f9b6928ea07f64`).

## Root cause (confirmed)
The corrected successor root has no history registration for Road LTL -> commercial A3 -> semantic A4 -> LTL-01, so Back leaves Atlas. The state machinery (`stage11CaptureState` / `stage11ApplyState`) is valid and is reused unchanged. A second, pre-existing root defect (init order: `#view=` / last-session restore runs before the V1.5 layers exist and throws `stage15RenderContract is not defined`, leaving only the module applied) is the DAU-006 deep-link/reload root cause. The root stays byte-identical; the new module re-applies the canonical target after the root has settled.

## Implementation (additive only)
- `assets/atl-s8-history-sync.mjs` (new): observation-based controller. It reads the live governed view through `stage11CaptureState()` (rendered state, never wrapped navigation functions), and records an entry when module / selected A3 / semantic level / selected process changes. Restoration uses the existing `stage11ApplyState()`.
- `assets/atl-140-v15-journey.mjs`: three added lines (import + guarded `installHistorySync(globalThis)` in `bootJourney`). Nothing removed.
- Unchanged and pinned: `index.html`, `execution/ui/runtime-access-shell.js`, Canvas donor, Canvas->Daughter bridge, Universal Ask 2.0.1 donor, router/API, data, protected S8-3B/C/D/E artifacts.
- ATL-142's history controller is NOT a donor: no `stage11HistoryState/Write/Wrap` and no `atlasViewState`.

## Behavior
- Entry key = module, domain, A3, process, depth, level. A3, A4-without-process, A4+process, A5 focus, Universe and Road-LTL-fit are distinct states.
- Startup: `replaceState` on the current entry (adoption); every later governed change: `pushState`; idempotent renders do not push.
- Restoration guard: `popstate`, hash restore and reload restoration never push or replace; restores are serialized; verified after settle.
- Boundary: `history.state.atlasS8HistorySync = {schema, level, view}` with allow-listed navigation fields only. The read path rejects unknown keys and protected-looking values outright.
- Fail closed: unknown module/A3/process/domain, invalid depth/level, A3-process mismatch, incomplete state, stale registry/page-0/data-contract pin, protected values, malformed shapes. A refused entry/deep link is never repaired: the neutral Universe stands. No fabricated fallback.
- Non-Atlas surfaces (Malkom consumer page): no-op, no errors, status `inactive-non-root`.
- Status surface: `documentElement.dataset.atlasHistorySync`, `window.AtlasS8HistorySync`.

## Known residuals (carried forward, not fixed here)
- Root init-order defect stays in the root (identity-preserved); compensated post-init by this module.
- The existing share-link serialization has no A4-vs-A5 field: an A5 deep link opens at A4 with its process. History entries (not links) carry the exact level.
- Working-surface/context overlays (playback, trace, transform, compare, lens) are not recorded and reset on traversal.
- Pre-existing root LOAD-TIME RACE (intermittent, unrelated to this module, root unchanged): the Stage-8 `closeFutureDrawer` recursion is repaired only by a later script block of `index.html`; if any render task slips into the window before it, the page throws `Maximum call stack size exceeded` (observed ~1 in 4 loaded-machine full runs). Mechanism proven with the module absent (R02); steady state is clean (R03). Tests tolerate exactly that message and only when raised before the history module set any status; every tolerated occurrence is counted in the evidence (`rootLoadRaceTolerated`). Not fixed here (would require a root change).
- Module-level (module sha) staleness is delegated to the root's own version gate; history validation pins registry schema, page-0 and data-contract versions.

## Tests
- `tests/s8-6-dau-history-sync.test.mjs`: unit, identity, DAU-007 sequence (repeated), DAU-006 matrix (generated deep links, refresh, direct load, restoration, Back/Forward), 18 injected-state negatives (history entry + reload), deep-link negatives, consumer-page no-op.
- `tests/s8-6-dau-mutations.test.mjs`: 21 mutations in isolated detached worktrees; all must be detected.
