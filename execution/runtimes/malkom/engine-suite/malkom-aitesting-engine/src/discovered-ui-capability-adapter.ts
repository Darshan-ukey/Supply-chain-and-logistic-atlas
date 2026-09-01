import type { CapabilityAdapter, EvidenceGraph, EvidenceOperation } from './compiler-types.js';
import { createEvidenceGraph } from './semantic-compiler.js';
import type { ScenarioPlan } from './types.js';

interface UiRouteBinding {
  readonly kind: 'discovered-ui-route';
  readonly route: string;
}

/** Turns pages already found by repository/runtime discovery into safe,
 * read-only UI capabilities. It does not invent selectors or form actions;
 * interactive actions remain grounded from the live page later. */
export class DiscoveredUiCapabilityAdapter implements CapabilityAdapter {
  readonly id = 'discovered-ui';
  readonly capabilities = ['web.ui'] as const;

  collect(context: Parameters<NonNullable<CapabilityAdapter['collect']>>[0]): EvidenceGraph {
    const routes = [...new Map(context.discovery.uiRoutes.map((route) => [canonicalRoute(route.path), route])).entries()]
      .map(([path, route]) => ({ ...route, path }));
    const operations = routes.map((route): EvidenceOperation => ({
      id: `ui.open.${safeRouteId(route.path)}`,
      adapterId: this.id,
      capability: 'web.ui',
      name: `Open ${routeName(route.path)}`,
      action: 'open',
      resource: routeName(route.path),
      sideEffect: 'read',
      inputs: [],
      outputs: [],
      outcomes: [{
        id: 'page.loaded',
        meaning: `${routeName(route.path)} loads and exposes a controlled page state`,
        successful: true,
      }],
      provenance: [{
        authority: route.source === 'runtime' ? 'observed' : 'source',
        source: `UI route discovery (${route.source}): ${route.path}`,
        confidence: route.source === 'runtime' ? 1 : 0.9,
      }],
      binding: { kind: 'discovered-ui-route', route: route.path } satisfies UiRouteBinding,
    }));
    return createEvidenceGraph(operations);
  }

  validateBinding(operation: EvidenceOperation): readonly string[] {
    const binding = operation.binding;
    if (!isUiRouteBinding(binding)) return ['binding must identify a discovered UI route'];
    return binding.route.startsWith('/') ? [] : ['UI route must begin with /'];
  }

  lower(params: Parameters<CapabilityAdapter['lower']>[0]): readonly Omit<ScenarioPlan, 'id'>[] {
    const binding = params.operation.binding;
    if (!isUiRouteBinding(binding)) throw new Error(`Operation ${params.operation.id} has an invalid discovered UI route binding.`);
    return [{
      name: params.operation.name,
      type: 'ui',
      objective: `${params.operation.resource} loads for the configured test session.`,
      target: { route: binding.route, sourceOfTruth: 'observed' },
      assertions: params.step.expectedOutcomeIds.map((id) => params.operation.outcomes.find((outcome) => outcome.id === id)?.meaning ?? id),
      evidenceRequired: ['ui', 'repo'],
      metadata: {
        evidenceSource: params.operation.provenance[0]?.source,
        operationId: params.operation.id,
      },
    }];
  }
}

function isUiRouteBinding(value: unknown): value is UiRouteBinding {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as Record<string, unknown>).kind === 'discovered-ui-route'
    && typeof (value as Record<string, unknown>).route === 'string';
}

function routeName(path: string): string {
  if (path.split('/').some((part) => part.startsWith(':'))) return `${path} page`;
  const parts = path.split('/').filter(Boolean).filter((part) => !part.startsWith(':'));
  if (parts.length === 0) return 'application page';
  // The full path names the page, not just its last word: "/settings/playground"
  // and "/playground" are different doors and must never share one name.
  return `${parts.join(' ').replace(/[-_]+/g, ' ')} page`;
}

function safeRouteId(path: string): string {
  const value = path.replace(/[^A-Za-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return value.length > 0 ? value : 'root';
}

function canonicalRoute(path: string): string {
  const normalized = path.trim().replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : '/';
}
