import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const proofDir = resolve(projectDir, '.brisk-aitesting-packed-real-ai-directus');
const installDir = resolve(proofDir, 'clean-install');
const runnerPath = resolve(installDir, 'run-real-ai-directus.mjs');
const npmCli = process.env.npm_execpath;
if (typeof npmCli !== 'string' || npmCli.length === 0) {
  throw new Error('npm_execpath is required; run this proof through the package script.');
}

await rm(proofDir, { recursive: true, force: true });
await mkdir(installDir, { recursive: true });

const packResult = await execFileAsync(process.execPath, [npmCli, 'pack', '--json', '--pack-destination', proofDir], {
  cwd: projectDir,
  maxBuffer: 10 * 1024 * 1024,
});
const packJson = packResult.stdout.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/)?.[1];
if (packJson === undefined) throw new Error('npm pack returned no JSON package report.');
const pack = JSON.parse(packJson)[0];
const tarballPath = resolve(proofDir, pack.filename);

await execFileAsync(process.execPath, [npmCli, 'init', '-y'], { cwd: installDir, maxBuffer: 10 * 1024 * 1024 });
await execFileAsync(process.execPath, [npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund', tarballPath], {
  cwd: installDir,
  maxBuffer: 10 * 1024 * 1024,
});
await copyFile(resolve(projectDir, 'smoke/run-real-ai-directus.mjs'), runnerPath);

const installedPackage = JSON.parse(await readFile(resolve(installDir, 'node_modules/brisk-aitesting/package.json'), 'utf8'));
const runResult = await execFileAsync(process.execPath, [runnerPath], {
  cwd: installDir,
  env: {
    ...process.env,
    BRISK_AITESTING_INSTALLED_PACKAGE: '1',
    BRISK_AITESTING_SOURCE_PROJECT_DIR: projectDir,
  },
  maxBuffer: 20 * 1024 * 1024,
  timeout: 180_000,
});

console.log(JSON.stringify({
  schemaVersion: 'brisk-aitesting.packed-real-ai-directus.v1',
  status: 'passed',
  package: {
    filename: pack.filename,
    version: installedPackage.version,
    files: pack.entryCount,
    unpackedBytes: pack.unpackedSize,
    cleanInstall: true,
  },
  childProof: JSON.parse(runResult.stdout),
}, null, 2));
