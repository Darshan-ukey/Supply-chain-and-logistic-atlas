import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import type { ArtifactRef, Engine, EngineContext, EngineRunResult, ScenarioPlan, ScenarioResult } from '../types.js';
import { scenarioEvidence, scenarioResult } from './shared.js';

export class BuiltinMessageContractEngine implements Engine {
  readonly name = 'builtin-message-contract-engine';
  readonly type = 'message' as const;

  canRun(scenario: ScenarioPlan): boolean {
    return scenario.type === 'message';
  }

  async run(context: EngineContext): Promise<EngineRunResult> {
    const started = Date.now();
    const dir = join(context.config.runtime.artifactsDir, context.runId, 'message-contracts');
    await mkdir(dir, { recursive: true });
    const artifactPath = join(dir, `${context.scenario.id}.asyncapi-summary.json`);
    const assertions: ScenarioResult['assertions'][number][] = [];
    const diagnostics: string[] = [];
    let status: ScenarioResult['status'] = 'passed';

    const schemaPath = context.scenario.target?.schema ?? context.config.contracts?.asyncApiPath;
    const requestedChannel = context.scenario.target?.channel;
    let summary: MessageContractEvidence;

    if (schemaPath === undefined) {
      status = 'failed';
      diagnostics.push('Message scenario did not provide target.schema and config.contracts.asyncApiPath is not set.');
      summary = emptyEvidence(context, requestedChannel);
    } else {
      try {
        summary = summarizeAsyncApi(context, schemaPath, await readFile(schemaPath, 'utf8'), requestedChannel);
        assertions.push({
          name: 'AsyncAPI contract parsed',
          status: summary.diagnostics.some((entry) => entry.includes('must be a JSON object')) ? 'failed' : 'passed',
        });
        assertions.push({
          name: requestedChannel === undefined ? 'AsyncAPI exposes at least one channel' : `AsyncAPI exposes channel ${requestedChannel}`,
          status: requestedChannel === undefined ? summary.channels.length > 0 ? 'passed' : 'failed' : summary.channels.some((channel) => channel.name === requestedChannel) ? 'passed' : 'failed',
        });
        assertions.push({
          name: 'AsyncAPI exposes message payload information',
          status: summary.channels.some((channel) => channel.messages.length > 0) ? 'passed' : 'failed',
        });
        if (assertions.some((assertion) => assertion.status === 'failed')) status = 'failed';
        diagnostics.push(...summary.diagnostics);
      } catch (error) {
        status = 'error';
        diagnostics.push(error instanceof Error ? error.message : String(error));
        summary = emptyEvidence(context, requestedChannel);
      }
    }

    await writeFile(artifactPath, `${JSON.stringify({ ...summary, assertions, diagnostics }, null, 2)}\n`, 'utf8');
    const artifact: ArtifactRef = {
      kind: 'json',
      path: artifactPath,
      label: 'AsyncAPI message contract evidence',
      metadata: {
        schemaVersion: 'brisk-aitesting.message-contract-evidence.v1',
        scenarioId: context.scenario.id,
        ...(schemaPath !== undefined ? { contractPath: schemaPath } : {}),
        ...(requestedChannel !== undefined ? { channel: requestedChannel } : {}),
      },
    };

    return {
      artifacts: [artifact],
      result: scenarioResult(context, {
        engine: this.name,
        status,
        durationMs: Date.now() - started,
        artifacts: [artifact],
        diagnostics,
        assertions,
      }),
    };
  }
}

interface MessageContractEvidence {
  readonly schemaVersion: 'brisk-aitesting.message-contract-evidence.v1';
  readonly scenario: Record<string, unknown>;
  readonly requestedChannel?: string;
  readonly title?: string;
  readonly version?: string;
  readonly channels: readonly {
    readonly name: string;
    readonly operations: readonly string[];
    readonly messages: readonly {
      readonly operation: string;
      readonly name?: string;
      readonly contentType?: string;
      readonly hasPayloadSchema: boolean;
    }[];
  }[];
  readonly diagnostics: readonly string[];
}

function summarizeAsyncApi(context: EngineContext, schemaPath: string, raw: string, requestedChannel: string | undefined): MessageContractEvidence {
  const document = parseSource(schemaPath, raw);
  if (!isRecord(document)) {
    return {
      schemaVersion: 'brisk-aitesting.message-contract-evidence.v1',
      scenario: scenarioEvidence(context),
      ...(requestedChannel !== undefined ? { requestedChannel } : {}),
      channels: [],
      diagnostics: ['AsyncAPI document must be a JSON object.'],
    };
  }
  const diagnostics: string[] = [];
  const channelsObject = isRecord(document.channels) ? document.channels : undefined;
  if (channelsObject === undefined) diagnostics.push('AsyncAPI document does not define a channels object.');
  const channels = Object.entries(channelsObject ?? {})
    .filter(([name]) => requestedChannel === undefined || name === requestedChannel)
    .map(([name, channel]) => summarizeChannel(name, channel));
  if (requestedChannel !== undefined && channels.length === 0) diagnostics.push(`AsyncAPI channel not found: ${requestedChannel}`);
  if (channels.length === 0) diagnostics.push('AsyncAPI document did not expose matching message channels.');
  return {
    schemaVersion: 'brisk-aitesting.message-contract-evidence.v1',
    scenario: scenarioEvidence(context),
    ...(requestedChannel !== undefined ? { requestedChannel } : {}),
    ...(isRecord(document.info) && typeof document.info.title === 'string' ? { title: document.info.title } : {}),
    ...(isRecord(document.info) && typeof document.info.version === 'string' ? { version: document.info.version } : {}),
    channels,
    diagnostics,
  };
}

function summarizeChannel(name: string, channel: unknown): MessageContractEvidence['channels'][number] {
  const record = isRecord(channel) ? channel : {};
  const operations = ['publish', 'subscribe'].filter((operation) => isRecord(record[operation]));
  const messages = operations.map((operation) => {
    const operationObject = record[operation];
    const message = isRecord(operationObject) && isRecord(operationObject.message) ? operationObject.message : {};
    return {
      operation,
      ...(typeof message.name === 'string' ? { name: message.name } : {}),
      ...(typeof message.contentType === 'string' ? { contentType: message.contentType } : {}),
      hasPayloadSchema: isRecord(message.payload),
    };
  });
  return { name, operations, messages };
}

function emptyEvidence(context: EngineContext, requestedChannel: string | undefined): MessageContractEvidence {
  return {
    schemaVersion: 'brisk-aitesting.message-contract-evidence.v1',
    scenario: scenarioEvidence(context),
    ...(requestedChannel !== undefined ? { requestedChannel } : {}),
    channels: [],
    diagnostics: [],
  };
}

function parseSource(path: string, raw: string): unknown {
  if (/\.ya?ml$/i.test(path)) return parseDocument(raw).toJSON();
  return JSON.parse(raw) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
