import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { loadOpenApiSummary, openApiOperationsToDiscoveryRoutes } from './openapi.js';
import type {
  Discoverer,
  DiscovererContext,
  ContractDriftReport,
  ContractDriftRoute,
  DiscoveryApiRoute,
  DiscoveryContract,
  DiscoveryResult,
  DiscoveryRoute,
} from './types.js';

type MatchedDriftRoute = ContractDriftReport['matchedRoutes'][number];

export class BuiltinDiscoverer implements Discoverer {
  readonly name = 'builtin-discoverer';

  async discover(context: DiscovererContext): Promise<DiscoveryResult> {
    const warnings: string[] = [];
    const uiRoutes = new Map<string, DiscoveryRoute>();
    const apiRoutes = new Map<string, DiscoveryApiRoute>();
    const repoSignals: DiscoveryResult['repoSignals'][number][] = [];

    if (context.config.discovery.includeUi) {
      for (const path of context.config.discovery.uiRoutes) {
        uiRoutes.set(path, { path, source: 'config', confidence: 1 });
      }
    }

    if (context.config.discovery.includeApi) {
      for (const route of context.config.discovery.apiRoutes) {
        apiRoutes.set(`${route.method.toUpperCase()} ${route.path}`, { method: route.method.toUpperCase(), path: route.path, source: 'config', confidence: 1 });
      }
    }

    const repoPath = context.config.app.repoPath;
    if (repoPath !== undefined && context.config.discovery.includeRepo) {
      await discoverRepo(repoPath, { uiRoutes, apiRoutes, repoSignals, warnings }, context.config.discovery.maxSourceFiles);
    }

    const implementedApiRoutes = implementationRoutesFrom(apiRoutes);
    const contractApiRoutes = new Map<string, DiscoveryApiRoute>();
    const contracts = await discoverContracts(context, { apiRoutes, contractApiRoutes, warnings });
    const contractDrift = buildContractDriftReport({
      implementedRoutes: implementedApiRoutes,
      documentedRoutes: contractApiRoutes,
      contracts,
    });

    return {
      schemaVersion: 'brisk-aitesting.discovery.v1',
      app: {
        name: context.config.app.name,
        baseUrl: context.config.app.baseUrl,
        ...(context.config.app.repoPath !== undefined ? { repoPath: context.config.app.repoPath } : {}),
      },
      uiRoutes: [...uiRoutes.values()].sort((left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path)),
      apiRoutes: [...apiRoutes.values()].sort((left, right) => right.confidence - left.confidence || `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`)),
      contracts,
      ...(contractDrift !== undefined ? { contractDrift } : {}),
      repoSignals,
      warnings,
      createdAt: new Date().toISOString(),
    };
  }
}

async function discoverRepo(repoPath: string, state: {
  readonly uiRoutes: Map<string, DiscoveryRoute>;
  readonly apiRoutes: Map<string, DiscoveryApiRoute>;
  readonly repoSignals: DiscoveryResult['repoSignals'][number][];
  readonly warnings: string[];
}, maxSourceFiles: number): Promise<void> {
  try {
    const packageJsonPath = join(repoPath, 'package.json');
    const rawPackage = await readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(rawPackage) as {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    };
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const name of Object.keys(deps)) {
      if (['next', 'react-router-dom', '@remix-run/react', 'express', 'fastify', '@playwright/test', 'vitest'].includes(name)) {
        state.repoSignals.push({
          kind: name === '@playwright/test' || name === 'vitest' ? 'test-runner' : name === 'express' || name === 'fastify' ? 'framework' : 'package',
          value: name,
          source: 'package.json',
        });
      }
    }
  } catch (error) {
    state.warnings.push(`Could not inspect package.json: ${error instanceof Error ? error.message : String(error)}`);
  }

  await discoverRouteFiles(repoPath, state, maxSourceFiles);
}

async function discoverRouteFiles(repoPath: string, state: {
  readonly uiRoutes: Map<string, DiscoveryRoute>;
  readonly apiRoutes: Map<string, DiscoveryApiRoute>;
  readonly repoSignals: DiscoveryResult['repoSignals'][number][];
  readonly warnings: string[];
}, maxSourceFiles: number): Promise<void> {
  const inventory = await listSourceFiles(repoPath, maxSourceFiles);
  const files = inventory.files;
  if (inventory.truncated) {
    state.warnings.push(`Source discovery reached discovery.maxSourceFiles=${maxSourceFiles}. Results are incomplete; raise the limit or narrow app.repoPath.`);
  }
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    state.repoSignals.push({ kind: 'source-file', value: normalized, source: 'repo' });
    for (const route of routeHintsFromPath(normalized)) {
      state.uiRoutes.set(route, { path: route, source: 'repo', confidence: 0.7 });
    }
    try {
      const content = await readFile(join(repoPath, file), 'utf8');
      for (const route of apiRouteHintsFromContent(content)) {
        state.apiRoutes.set(`${route.method} ${route.path}`, { ...route, source: 'repo', confidence: 0.7 });
      }
    } catch {
      // Ignore unreadable source files; route discovery is opportunistic.
    }
  }
}

async function listSourceFiles(root: string, limit: number): Promise<{ readonly files: readonly string[]; readonly truncated: boolean }> {
  const result: string[] = [];
  const state = { truncated: false };
  await walk(root, '', result, limit, state);
  return { files: result, truncated: state.truncated };
}

async function walk(root: string, relativeDir: string, result: string[], limit: number, state: { truncated: boolean }): Promise<void> {
  if (result.length >= limit) {
    state.truncated = true;
    return;
  }
  const absoluteDir = join(root, relativeDir);
  let entries;
  try {
    entries = (await readdir(absoluteDir, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return;
  }
  for (const entry of entries) {
    if (result.length >= limit) {
      state.truncated = true;
      return;
    }
    if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'coverage'].includes(entry.name)) continue;
    const relativePath = join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, relativePath, result, limit, state);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      result.push(relativePath);
    }
  }
}

function routeHintsFromPath(path: string): readonly string[] {
  const routes: string[] = [];
  const pageMatch = path.match(/(?:pages|routes|app)\/(.+?)\.(?:tsx?|jsx?|mjs|cjs)$/);
  if (pageMatch?.[1] !== undefined) {
    const route = `/${pageMatch[1]}`
      .replace(/\/index$/, '/')
      .replace(/\/page$/, '')
      .replace(/\[(.+?)\]/g, ':$1')
      .replace(/\/+/g, '/');
    routes.push(route === '' ? '/' : route);
  }
  return routes;
}

function apiRouteHintsFromContent(content: string): readonly Pick<DiscoveryApiRoute, 'method' | 'path'>[] {
  return [...new Map(discoverJavaScriptApiRoutes(content).map((route) => [`${route.method} ${route.path}`, route])).values()];
}

type JavaScriptRoute = Pick<DiscoveryApiRoute, 'method' | 'path'>;

type RouteDeclaration = {
  readonly owner: string;
  readonly method: string;
  readonly path: string;
};

type RouterMount = {
  readonly parent: string;
  readonly child: string;
  readonly path: string;
};

function discoverJavaScriptApiRoutes(content: string): readonly JavaScriptRoute[] {
  const sourceFile = ts.createSourceFile('brisk-route-discovery.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routerNames = new Set<string>(['app', 'router']);
  const declarations: RouteDeclaration[] = [];
  const mounts: RouterMount[] = [];
  const nestRoutes: JavaScriptRoute[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && isRouterFactoryCall(node.initializer)) {
      routerNames.add(node.name.text);
    }

    if (ts.isCallExpression(node)) {
      const mount = expressMountFromCall(node);
      if (mount !== undefined) {
        mounts.push(mount);
        routerNames.add(mount.child);
      }

      const directRoute = routeDeclarationFromCall(node, routerNames);
      if (directRoute !== undefined) declarations.push(directRoute);

      const chainedRoute = chainedRouteDeclarationFromCall(node, routerNames);
      if (chainedRoute !== undefined) declarations.push(chainedRoute);
    }

    if (ts.isClassDeclaration(node)) {
      nestRoutes.push(...nestRoutesFromClass(node));
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const routes: JavaScriptRoute[] = [...nestRoutes];
  const ownerPrefixes = ownerPrefixMap(mounts);
  for (const declaration of declarations) {
    if (declaration.path.startsWith('/api/')) {
      routes.push({ method: declaration.method, path: normalizeRoutePath(declaration.path) });
      continue;
    }

    const prefixes = ownerPrefixes.get(declaration.owner) ?? [];
    for (const prefix of prefixes) {
      const path = joinRoutePaths(prefix, declaration.path);
      if (path.startsWith('/api/')) routes.push({ method: declaration.method, path });
    }
  }
  return routes;
}

function isRouterFactoryCall(node: ts.Expression): boolean {
  if (!ts.isCallExpression(node)) return false;
  const expression = node.expression;
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === 'Router';
  }
  return ts.isIdentifier(expression) && expression.text === 'Router';
}

function expressMountFromCall(node: ts.CallExpression): RouterMount | undefined {
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'use') return undefined;
  const parent = expressionName(node.expression.expression);
  const path = stringLiteralText(node.arguments[0]);
  const child = expressionName(node.arguments[1]);
  if (parent === undefined || path === undefined || child === undefined) return undefined;
  return { parent, child, path };
}

function routeDeclarationFromCall(node: ts.CallExpression, routerNames: ReadonlySet<string>): RouteDeclaration | undefined {
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  const method = httpMethodFromName(node.expression.name.text);
  if (method === undefined) return undefined;
  const owner = expressionName(node.expression.expression);
  const path = stringLiteralText(node.arguments[0]);
  if (owner === undefined || path === undefined || !routerNames.has(owner)) return undefined;
  return { owner, method, path };
}

function chainedRouteDeclarationFromCall(node: ts.CallExpression, routerNames: ReadonlySet<string>): RouteDeclaration | undefined {
  if (!ts.isPropertyAccessExpression(node.expression)) return undefined;
  const method = httpMethodFromName(node.expression.name.text);
  if (method === undefined) return undefined;
  const routeCall = node.expression.expression;
  if (!ts.isCallExpression(routeCall) || !ts.isPropertyAccessExpression(routeCall.expression) || routeCall.expression.name.text !== 'route') return undefined;
  const owner = expressionName(routeCall.expression.expression);
  const path = stringLiteralText(routeCall.arguments[0]);
  if (owner === undefined || path === undefined || !routerNames.has(owner)) return undefined;
  return { owner, method, path };
}

function nestRoutesFromClass(node: ts.ClassDeclaration): readonly JavaScriptRoute[] {
  const controllerPath = decoratorPath(node, ['Controller']);
  if (controllerPath === undefined) return [];

  const routes: JavaScriptRoute[] = [];
  for (const member of node.members) {
    const methodDecorator = firstHttpDecorator(member);
    if (methodDecorator === undefined) continue;
    const path = joinRoutePaths(controllerPath, methodDecorator.path ?? '/');
    if (path.startsWith('/api/')) routes.push({ method: methodDecorator.method, path });
  }
  return routes;
}

function firstHttpDecorator(node: ts.Node): { readonly method: string; readonly path?: string } | undefined {
  const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
  for (const decorator of decorators) {
    const name = decoratorName(decorator);
    const method = name === undefined ? undefined : httpMethodFromNestDecorator(name);
    if (method !== undefined) {
      const path = decoratorCallPath(decorator);
      return path === undefined ? { method } : { method, path };
    }
  }
  return undefined;
}

function decoratorPath(node: ts.Node, names: readonly string[]): string | undefined {
  const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
  for (const decorator of decorators) {
    const name = decoratorName(decorator);
    if (name !== undefined && names.includes(name)) return decoratorCallPath(decorator) ?? '/';
  }
  return undefined;
}

function decoratorName(decorator: ts.Decorator): string | undefined {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression)) return expressionName(expression.expression);
  return expressionName(expression);
}

function decoratorCallPath(decorator: ts.Decorator): string | undefined {
  const expression = decorator.expression;
  if (!ts.isCallExpression(expression)) return undefined;
  return stringLiteralText(expression.arguments[0]);
}

function httpMethodFromName(name: string): string | undefined {
  return ['get', 'post', 'put', 'patch', 'delete'].includes(name.toLowerCase()) ? name.toUpperCase() : undefined;
}

function httpMethodFromNestDecorator(name: string): string | undefined {
  const map: Record<string, string> = {
    Get: 'GET',
    Post: 'POST',
    Put: 'PUT',
    Patch: 'PATCH',
    Delete: 'DELETE',
  };
  return map[name];
}

function ownerPrefixMap(mounts: readonly RouterMount[]): Map<string, readonly string[]> {
  const direct = new Map<string, RouterMount[]>();
  for (const mount of mounts) {
    direct.set(mount.child, [...direct.get(mount.child) ?? [], mount]);
  }

  const memo = new Map<string, readonly string[]>();
  const prefixesFor = (owner: string, stack: readonly string[] = []): readonly string[] => {
    if (owner === 'app') return [''];
    const cached = memo.get(owner);
    if (cached !== undefined) return cached;
    if (stack.includes(owner)) return [];

    const prefixes: string[] = [];
    for (const mount of direct.get(owner) ?? []) {
      for (const parentPrefix of prefixesFor(mount.parent, [...stack, owner])) {
        prefixes.push(joinRoutePaths(parentPrefix, mount.path));
      }
    }
    const unique = [...new Set(prefixes)];
    memo.set(owner, unique);
    return unique;
  };

  const result = new Map<string, readonly string[]>();
  for (const mount of mounts) {
    result.set(mount.child, prefixesFor(mount.child));
  }
  return result;
}

function expressionName(expression: ts.Expression | undefined): string | undefined {
  if (expression === undefined) return undefined;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function stringLiteralText(node: ts.Node | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function joinRoutePaths(prefix: string, path: string): string {
  const left = normalizeRoutePath(prefix);
  const right = normalizeRoutePath(path);
  if (left === '/') return right;
  if (right === '/') return left;
  return normalizeRoutePath(`${left}/${right}`);
}

async function discoverContracts(context: DiscovererContext, state: {
  readonly apiRoutes: Map<string, DiscoveryApiRoute>;
  readonly contractApiRoutes: Map<string, DiscoveryApiRoute>;
  readonly warnings: string[];
}): Promise<readonly DiscoveryContract[]> {
  if (!context.config.discovery.includeContracts) return [];
  const configured: DiscoveryContract[] = [];
  if (context.config.contracts?.openApiPath !== undefined) {
    const existsOnDisk = await exists(context.config.contracts.openApiPath);
    if (existsOnDisk) {
      try {
        const summary = await loadOpenApiSummary(context.config.contracts.openApiPath);
        for (const route of openApiOperationsToDiscoveryRoutes(summary)) {
          const key = routeKey(route.method, route.path);
          state.contractApiRoutes.set(key, route);
          state.apiRoutes.set(key, route);
        }
        configured.push({
          kind: 'openapi',
          path: context.config.contracts.openApiPath,
          exists: true,
          operations: summary.operations.length,
          ...(summary.diagnostics.length > 0 ? { errors: summary.diagnostics } : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        state.warnings.push(`Could not parse OpenAPI contract ${context.config.contracts.openApiPath}: ${message}`);
        configured.push({
          kind: 'openapi',
          path: context.config.contracts.openApiPath,
          exists: true,
          operations: 0,
          errors: [message],
        });
      }
    } else {
      state.warnings.push(`Configured OpenAPI contract does not exist: ${context.config.contracts.openApiPath}`);
      configured.push({
        kind: 'openapi',
        path: context.config.contracts.openApiPath,
        exists: false,
      });
    }
  }
  if (context.config.contracts?.asyncApiPath !== undefined) {
    configured.push({
      kind: 'asyncapi',
      path: context.config.contracts.asyncApiPath,
      exists: await exists(context.config.contracts.asyncApiPath),
    });
  }
  return configured;
}

function implementationRoutesFrom(routes: Map<string, DiscoveryApiRoute>): Map<string, DiscoveryApiRoute> {
  const result = new Map<string, DiscoveryApiRoute>();
  for (const route of routes.values()) {
    if (route.source === 'repo' || route.source === 'runtime') {
      result.set(routeKey(route.method, route.path), route);
    }
  }
  return result;
}

function buildContractDriftReport(params: {
  readonly implementedRoutes: Map<string, DiscoveryApiRoute>;
  readonly documentedRoutes: Map<string, DiscoveryApiRoute>;
  readonly contracts: readonly DiscoveryContract[];
}): ContractDriftReport | undefined {
  if (params.documentedRoutes.size === 0 && !params.contracts.some((contract) => contract.kind === 'openapi' && contract.exists)) {
    return undefined;
  }

  const matchedRoutes: MatchedDriftRoute[] = [];
  const implementedButUndocumented: ContractDriftRoute[] = [];
  const documentedButNotImplemented: ContractDriftRoute[] = [];

  for (const [key, implementation] of params.implementedRoutes) {
    const contract = params.documentedRoutes.get(key);
    if (contract === undefined) {
      implementedButUndocumented.push(toDriftRoute(implementation));
    } else {
      matchedRoutes.push({
        method: implementation.method.toUpperCase(),
        path: normalizeRoutePath(implementation.path),
        implementation: toDriftRoute(implementation),
        contract: toDriftRoute(contract),
      });
    }
  }

  for (const [key, contract] of params.documentedRoutes) {
    if (!params.implementedRoutes.has(key)) {
      documentedButNotImplemented.push(toDriftRoute(contract));
    }
  }

  const diagnostics: string[] = [
    `Compared ${params.implementedRoutes.size} implemented route(s) discovered from repo/runtime evidence with ${params.documentedRoutes.size} OpenAPI operation(s).`,
  ];
  if (params.implementedRoutes.size === 0) {
    diagnostics.push('No repo/runtime API routes were discovered; config default API route candidates are not treated as implementation evidence.');
  }
  if (implementedButUndocumented.length === 0 && documentedButNotImplemented.length === 0 && params.documentedRoutes.size > 0) {
    diagnostics.push('No implementation-contract drift detected for discovered route keys.');
  }

  const openApiContract = params.contracts.find((contract) => contract.kind === 'openapi' && contract.exists);
  return {
    schemaVersion: 'brisk-aitesting.contract-drift.v1',
    kind: 'openapi',
    ...(openApiContract?.path !== undefined ? { contractPath: openApiContract.path } : {}),
    implementedRoutes: [...params.implementedRoutes.values()].map(toDriftRoute).sort(compareDriftRoutes),
    documentedRoutes: [...params.documentedRoutes.values()].map(toDriftRoute).sort(compareDriftRoutes),
    matchedRoutes: matchedRoutes.sort((left, right) => compareRouteParts(left.method, left.path, right.method, right.path)),
    implementedButUndocumented: implementedButUndocumented.sort(compareDriftRoutes),
    documentedButNotImplemented: documentedButNotImplemented.sort(compareDriftRoutes),
    diagnostics,
  };
}

function toDriftRoute(route: DiscoveryApiRoute): ContractDriftRoute {
  return {
    method: route.method.toUpperCase(),
    path: normalizeRoutePath(route.path),
    source: route.source,
    confidence: route.confidence,
    ...(route.operationId !== undefined ? { operationId: route.operationId } : {}),
    ...(route.contractPath !== undefined ? { contractPath: route.contractPath } : {}),
  };
}

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizeRouteMatchPath(path)}`;
}

function normalizeRoutePath(path: string): string {
  if (path === '') return '/';
  const normalized = path.replace(/\/+/g, '/');
  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
}

function normalizeRouteMatchPath(path: string): string {
  return normalizeRoutePath(path)
    .replace(/\/:[^/]+/g, '/:param')
    .replace(/\/\{[^/{}]+\}/g, '/:param');
}

function compareDriftRoutes(left: ContractDriftRoute, right: ContractDriftRoute): number {
  return compareRouteParts(left.method, left.path, right.method, right.path);
}

function compareRouteParts(leftMethod: string, leftPath: string, rightMethod: string, rightPath: string): number {
  return leftPath.localeCompare(rightPath) || leftMethod.localeCompare(rightMethod);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
