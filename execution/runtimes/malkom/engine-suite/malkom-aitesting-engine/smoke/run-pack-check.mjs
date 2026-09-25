import { exec } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const packDir = '.brisk-aitesting-pack-check';
const required = [
  'package/dist/index.js',
  'package/dist/index.d.ts',
  'package/dist/cli.js',
  'package/README.md',
  'package/CHANGELOG.md',
  'package/adapters/manifest.json',
  'package/docs/GETTING_STARTED.md',
  'package/docs/CONFIGURATION.md',
  'package/docs/HOST_INTEGRATION.md',
  'package/docs/API_REFERENCE.md',
  'package/docs/SECURITY.md',
  'package/docs/COMPATIBILITY.md',
  'package/docs/TROUBLESHOOTING.md',
  'package/docs/UNIVERSAL_COMPILER.md',
  'package/docs/EVIDENCE_PROVIDERS.md',
  'package/docs/EVIDENCE_AUTHORITY.md',
  'package/docs/INCREMENTAL_RECOMPILATION.md',
  'package/docs/TYPED_VALUE_FLOW.md',
  'package/docs/OPERATION_LIFECYCLE.md',
  'package/docs/CLEANUP_AND_RECOVERY.md',
  'package/docs/SYSTEM_COMPATIBILITY_FOUNDATIONS.md',
  'package/docs/CROSS_ARCHITECTURE_PROOF.md',
  'package/docs/engineering/REAL_SYSTEM_PROOF_LOG.md',
  'package/docs/engineering/REAL_SYSTEM_CHANGE_GATE.md',
  'package/docs/engineering/REAL_SYSTEM_TARGET_DEPTH.md',
  'package/docs/engineering/REAL_SYSTEM_AI_PIPELINE.md',
  'package/docs/engineering/WORLD_CLASS_REAL_VALIDATION_GATE.md',
];
const forbiddenPatterns = [
  /^package\/\.env/i,
  /^package\/.*\.env/i,
  /^package\/node_modules\//,
  /^package\/src\//,
  /^package\/smoke\//,
  /^package\/\.git\//,
  /^package\/\.brisk-aitesting/i,
  /^package\/brisk-aitesting-playwright-work\//,
  /^package\/playwright-work\//,
  /^package\/test-results\//,
  /^package\/playwright-report\//,
  /^package\/.*\.log$/i,
  /^package\/dist\/keploy/i,
  /^package\/dist\/.*\.map$/i,
  /^package\/examples\//,
  /^package\/reference-apps\//,
  /^package\/fixtures\//,
  /^package\/assets\//,
];

await rm(packDir, { recursive: true, force: true });
await mkdir(packDir, { recursive: true });

const { stdout } = await execAsync(`npm pack --json --pack-destination ${JSON.stringify(packDir)}`, {
  maxBuffer: 1024 * 1024 * 10,
});
const pack = JSON.parse(stdout)[0];
const files = pack.files.map((entry) => `package/${entry.path.replace(/\\/g, '/')}`).sort();
const errors = [];

for (const path of required) {
  if (!files.includes(path)) errors.push(`missing required package file ${path}`);
}

for (const file of files) {
  if (forbiddenPatterns.some((pattern) => pattern.test(file))) {
    errors.push(`forbidden package file ${file}`);
  }
}

let internalMarkdownLinksChecked = 0;
for (const file of files.filter((entry) => entry.endsWith('.md'))) {
  const localPath = file.replace(/^package\//, '');
  const markdown = await readFile(localPath, 'utf8');
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:[a-z]+:|#)/i.test(rawTarget)) continue;
    const targetWithoutFragment = rawTarget.split('#', 1)[0].replace(/\\/g, '/');
    if (targetWithoutFragment.length === 0) continue;
    const packageTarget = posix.normalize(posix.join(posix.dirname(file), targetWithoutFragment));
    internalMarkdownLinksChecked += 1;
    if (!files.includes(packageTarget)) errors.push(`broken packaged Markdown link ${file} -> ${rawTarget}`);
  }
}

if (pack.entryCount !== files.length) errors.push(`entry count mismatch: ${pack.entryCount} vs ${files.length}`);
if (typeof pack.size !== 'number' || pack.size <= 0) errors.push('package size was not reported');
if (typeof pack.filename !== 'string' || !pack.filename.endsWith('.tgz')) errors.push('npm pack did not produce a tgz filename');
// TypeScript emits runtime, declaration, and source-map files for every public
// module. Keep enough headroom for the compiler modules while the byte-size gate
// remains the primary install-footprint constraint.
if (files.length > 150) errors.push(`package contains ${files.length} files; maximum is 150`);
if (typeof pack.unpackedSize !== 'number' || pack.unpackedSize > 1_300_000) errors.push(`unpacked package size ${pack.unpackedSize} exceeds 1300000 bytes`);

let cleanInstall = 'not-run';
let installedImport = 'not-run';
if (errors.length === 0) {
  const installDir = resolve(packDir, 'clean-install');
  const tarballPath = resolve(packDir, pack.filename);
  await mkdir(installDir, { recursive: true });
  try {
    await execAsync('npm init -y', { cwd: installDir, maxBuffer: 1024 * 1024 * 10 });
    await execAsync(`npm install --ignore-scripts --no-audit --no-fund ${JSON.stringify(tarballPath)}`, { cwd: installDir, maxBuffer: 1024 * 1024 * 10 });
    cleanInstall = 'passed';
    await execAsync(`node --input-type=module -e "const p=await import('brisk-aitesting');if(typeof p.createBriskAiTesting!=='function'||typeof p.defineHostConfig!=='function'||typeof p.validateRealValidationManifest!=='function'||typeof p.validateRealValidationBenchmarkSample!=='function')process.exit(1);const c=await p.defineHostConfig({app:{name:'packed-host',baseUrl:'http://localhost:3000'}},{environment:{}});if(c.runtime.dryRun!==true||c.security.strictMode!==true)process.exit(1)"`, { cwd: installDir, maxBuffer: 1024 * 1024 * 10 });
    installedImport = 'passed';
  } catch (error) {
    errors.push(`clean package consumption failed: ${error instanceof Error ? error.message : String(error)}`);
    cleanInstall = cleanInstall === 'passed' ? cleanInstall : 'failed';
    installedImport = 'failed';
  }
}

const report = {
  schemaVersion: 'brisk-aitesting.pack-check.v1',
  status: errors.length === 0 ? 'passed' : 'failed',
  tarball: join(packDir, pack.filename),
  files: files.length,
  unpackedSize: pack.unpackedSize,
  required,
  internalMarkdownLinksChecked,
  cleanInstall,
  installedImport,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
