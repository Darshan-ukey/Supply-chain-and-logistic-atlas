import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

const targets = [
  {
    id: 'directus',
    root: 'C:\\Users\\u306076\\Documents\\azure-pubsub\\directus',
    revision: 'b1d7a45a77661fd13928a53448c06649f36b56f5',
  },
  {
    id: 'medusa',
    root: 'C:\\Users\\u306076\\Documents\\azure-pubsub\\medusa',
    revision: 'efab588e9ce621f998be4ec4431f5b15486aaac0',
  },
  {
    id: 'n8n',
    root: 'C:\\Users\\u306076\\Documents\\azure-pubsub\\n8n',
    revision: '0839326a9ba41ecb85a72b71ffc15fe42a15364b',
  },
];

const sourceExtensions = new Set(['.cjs', '.css', '.graphql', '.html', '.js', '.json', '.jsx', '.mjs', '.scss', '.sql', '.ts', '.tsx', '.vue', '.yaml', '.yml']);

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 100 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${root}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function trackedFiles(root) {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 * 100 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ls-files failed in ${root}: ${result.stderr.trim()}`);
  return result.stdout.split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/'));
}

function readableSource(root, file) {
  try {
    return readFileSync(resolve(root, file), 'utf8');
  } catch {
    return '';
  }
}

function countMatches(root, files, pattern) {
  let count = 0;
  for (const file of files) count += [...readableSource(root, file).matchAll(pattern)].length;
  return count;
}

function baseMetrics(target) {
  const files = trackedFiles(target.root);
  const bytes = files.reduce((sum, file) => {
    try {
      return sum + statSync(resolve(target.root, file)).size;
    } catch {
      return sum;
    }
  }, 0);
  const sourceFiles = files.filter((file) => sourceExtensions.has(extname(file).toLowerCase()));
  return {
    files,
    common: {
      trackedFiles: files.length,
      trackedBytes: bytes,
      sourceLikeFiles: sourceFiles.length,
      packageManifests: files.filter((file) => basename(file) === 'package.json').length,
      testFiles: files.filter((file) => /(?:^|\/)(?:__tests__|test|tests|e2e)(?:\/|$)|\.(?:test|spec|e2e)\.[^.]+$/i.test(file)).length,
    },
  };
}

function directusMetrics(target, files) {
  const uiSourceFiles = files.filter((file) => file.startsWith('app/src/') && file.endsWith('.vue'));
  const routeFiles = files.filter((file) => file === 'app/src/router.ts' || (/^app\/src\/modules\/[^/]+\/index\.ts$/u.test(file) && readableSource(target.root, file).includes('routes:')));
  const apiSource = files.filter((file) => file.startsWith('api/src/') && /\.(?:ts|js)$/u.test(file) && !/\.(?:test|spec)\./u.test(file));
  return {
    uiSourceFiles: uiSourceFiles.length,
    uiRouteDefinitionFiles: routeFiles.length,
    uiRouteRecords: countMatches(target.root, routeFiles, /^\s*path\s*:/gmu),
    apiMountPaths: [...readableSource(target.root, 'api/src/app.ts').matchAll(/app\.use\(\s*['"]\//gu)].length,
    staticHttpHandlerRegistrations: countMatches(target.root, apiSource, /router\.(?:get|post|put|patch|delete)\s*\(/gu),
    contractSurfaces: ['REST/OpenAPI /server/specs/oas', 'GraphQL /graphql', 'GraphQL system /graphql/system'],
    architectureAreas: new Set(files.filter((file) => file.startsWith('api/src/')).map((file) => file.split('/')[2]).filter(Boolean)).size,
  };
}

function medusaMetrics(target, files) {
  const dashboardRoot = 'packages/admin/dashboard/src/';
  const dashboardFiles = files.filter((file) => file.startsWith(dashboardRoot) && /\.(?:ts|tsx)$/u.test(file));
  const pageFiles = files.filter((file) =>
    (file.startsWith('packages/admin/dashboard/src/routes/') || /\/src\/admin\/routes\//u.test(file)) && file.endsWith('/page.tsx'),
  );
  const routeDefinitionFiles = files.filter((file) => file.startsWith('packages/admin/dashboard/src/dashboard-app/routes/') && /\.(?:ts|tsx)$/u.test(file));
  const routeFiles = files.filter((file) => file.startsWith('packages/medusa/src/api/') && file.endsWith('/route.ts'));
  const apiSupportFiles = files.filter((file) => file.startsWith('packages/medusa/src/api/') && /(?:validators|query-config|middlewares)\.ts$/u.test(file));
  return {
    uiSourceFiles: dashboardFiles.length,
    uiPageRouteFiles: pageFiles.length,
    uiRouteDefinitionFiles: routeDefinitionFiles.length,
    uiRouteRecords: countMatches(target.root, routeDefinitionFiles, /^\s*path\s*:/gmu),
    apiRouteFiles: routeFiles.length,
    exportedHttpHandlers: countMatches(target.root, routeFiles, /export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE)\s*=/gu),
    apiValidationAndQueryFiles: apiSupportFiles.length,
    contractSurfaces: ['Admin REST route modules', 'Store REST route modules', 'Auth REST route modules', 'typed HTTP request/response definitions'],
    architectureAreas: new Set(files.filter((file) => file.startsWith('packages/')).map((file) => file.split('/')[1]).filter(Boolean)).size,
  };
}

function n8nMetrics(target, files) {
  const editorRoot = 'packages/frontend/editor-ui/src/';
  const uiSourceFiles = files.filter((file) => file.startsWith(editorRoot) && /\.(?:ts|vue)$/u.test(file));
  const routeFiles = files.filter((file) => file.startsWith(editorRoot) && /(?:^|\/)[^/]*(?:router|routes)[^/]*\.ts$/iu.test(file) && !/\.(?:test|spec)\.ts$/u.test(file));
  const controllerFiles = files.filter((file) => file.startsWith('packages/cli/src/') && /controller(?:\.ee)?\.ts$/u.test(file) && !/\/(?:__tests__|test|tests)\//u.test(file));
  return {
    uiSourceFiles: uiSourceFiles.length,
    uiRouteDefinitionFiles: routeFiles.length,
    uiRouteRecords: countMatches(target.root, routeFiles, /^\s*path\s*:/gmu),
    restControllerFiles: controllerFiles.length,
    decoratedHttpHandlers: countMatches(target.root, controllerFiles, /@(Get|Post|Put|Patch|Delete)\s*\(/gu),
    contractFiles: files.filter((file) => file.startsWith('packages/@n8n/api-types/') && /\.(?:ts|json)$/u.test(file)).length,
    contractSurfaces: ['decorated REST controllers', '@n8n/api-types request/response schemas', 'webhook and workflow execution endpoints'],
    architectureAreas: new Set(files.filter((file) => file.startsWith('packages/')).map((file) => file.split('/')[1]).filter(Boolean)).size,
  };
}

const applications = [];
const checks = [];
for (const target of targets) {
  const head = git(target.root, ['rev-parse', 'HEAD']);
  const dirtyPaths = git(target.root, ['status', '--porcelain']).split(/\r?\n/u).filter(Boolean).length;
  const { files, common } = baseMetrics(target);
  const depth = target.id === 'directus'
    ? directusMetrics(target, files)
    : target.id === 'medusa'
      ? medusaMetrics(target, files)
      : n8nMetrics(target, files);
  applications.push({ id: target.id, revision: head, clean: dirtyPaths === 0, ...common, ...depth });
  checks.push(
    { name: `${target.id} revision matches`, passed: head === target.revision, observed: head },
    { name: `${target.id} source is clean`, passed: dirtyPaths === 0, observed: dirtyPaths },
    { name: `${target.id} inventory is substantial`, passed: common.trackedFiles > 4_000, observed: common.trackedFiles },
  );
}

const byId = Object.fromEntries(applications.map((application) => [application.id, application]));
checks.push(
  { name: 'Directus exposes many UI route records', passed: byId.directus.uiRouteRecords >= 50, observed: byId.directus.uiRouteRecords },
  { name: 'Directus exposes many static HTTP handlers', passed: byId.directus.staticHttpHandlerRegistrations >= 200, observed: byId.directus.staticHttpHandlerRegistrations },
  { name: 'Medusa exposes many admin UI route records', passed: byId.medusa.uiRouteRecords >= 200, observed: byId.medusa.uiRouteRecords },
  { name: 'Medusa exposes many REST route files', passed: byId.medusa.apiRouteFiles >= 200, observed: byId.medusa.apiRouteFiles },
  { name: 'n8n exposes many UI route records', passed: byId.n8n.uiRouteRecords >= 50, observed: byId.n8n.uiRouteRecords },
  { name: 'n8n exposes many decorated HTTP handlers', passed: byId.n8n.decoratedHttpHandlers >= 100, observed: byId.n8n.decoratedHttpHandlers },
);

const failures = checks.filter(({ passed }) => !passed);
const report = {
  schemaVersion: 'brisk-aitesting.real-system-target-inventory.v1',
  proofClass: 'static-real-source-inventory',
  applications,
  currentBriskAiTestingUiProof: {
    seriousSaas: { totalScenarios: 13, uiScenarios: 3, uiDepth: 'route load and body visibility only' },
    referenceProofApps: { totalScenarios: 38, uiScenarios: 5, uiDepth: 'route load and body visibility only' },
    mainSmoke: { totalScenarios: 6, uiScenarios: 2, loginActions: 3 },
    realTargets: { directusBusinessUiScenarios: 0, medusaBusinessUiScenarios: 0, n8nBusinessUiScenarios: 0 },
  },
  counts: { checks: checks.length, passed: checks.length - failures.length, failures: failures.length, skips: 0 },
  failures,
  limits: [
    'Repository and route/handler counts measure target depth; they are not executed test counts.',
    'Static handler counts omit dynamically generated operations and can include edition-gated source.',
    'UI route records and page files do not prove that a browser can reach, use, or assert those screens.',
  ],
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
