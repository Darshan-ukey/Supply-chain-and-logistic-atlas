// Compiler scaling: 15 scenarios × 3 actions against evidence graphs of
// growing operation counts, plus incremental full-vs-affected recompile cost.
import {
  UniversalSemanticCompiler,
  createEvidenceGraph,
} from '../../dist/semantic-compiler.js';
import { compileIntentIncrementally } from '../../dist/incremental-compilation.js';

const slot = (id, semanticType, extra = {}) => ({ id, name: id, semanticType, required: true, ...extra });
const makeEvidence = (operationCount) => {
  const operations = [];
  for (let index = 0; index < operationCount / 3; index += 1) {
    const resource = `resource${index}`;
    operations.push(
      { id: `${resource}.list`, adapterId: 'fixture', capability: 'api.http', name: `List ${resource}`, action: 'list', resource, sideEffect: 'read', inputs: [], outputs: [slot(`${resource}Id`, `${resource}.id`, { required: false })], outcomes: [{ id: 'ok', meaning: `list ${resource} succeeds`, successful: true }], provenance: [{ authority: 'host', source: 'bench', confidence: 1 }], binding: { fixture: true } },
      { id: `${resource}.create`, adapterId: 'fixture', capability: 'api.http', name: `Create ${resource}`, action: 'create', resource, sideEffect: 'create', inputs: [slot('name', `${resource}.name`, { generation: { kind: 'unique-string' } })], outputs: [slot(`${resource}CreatedId`, `${resource}.id`, { required: false })], outcomes: [{ id: 'ok', meaning: `create ${resource} succeeds`, successful: true }], provenance: [{ authority: 'host', source: 'bench', confidence: 1 }], binding: { fixture: true }, cleanupOperationId: `${resource}.delete` },
      { id: `${resource}.delete`, adapterId: 'fixture', capability: 'api.http', name: `Delete ${resource}`, action: 'delete', resource, sideEffect: 'delete', inputs: [slot(`${resource}Id`, `${resource}.id`)], outputs: [], outcomes: [{ id: 'ok', meaning: `delete ${resource} succeeds`, successful: true }], provenance: [{ authority: 'host', source: 'bench', confidence: 1 }], binding: { fixture: true } },
    );
  }
  return createEvidenceGraph(operations);
};

const makeIntent = (scenarioCount, resourceCount) => ({
  schemaVersion: 'brisk-aitesting.intent.v1',
  goal: 'bench',
  warnings: [],
  scenarios: Array.from({ length: scenarioCount }, (_, index) => {
    const resource = `resource${index % resourceCount}`;
    return {
      id: `scenario_${index}`,
      name: `scenario ${index}`,
      objective: 'bench',
      actions: [
        { id: 'action_1', verb: 'create', resource, expectedOutcomes: [] },
        { id: 'action_2', verb: 'delete', resource, values: { [`${resource}Id`]: { semanticType: `${resource}.id`, fromActionId: 'action_1' } }, expectedOutcomes: [] },
        { id: 'action_3', verb: 'list', resource, expectedOutcomes: [] },
      ],
      invariants: [],
      cleanup: 'automatic',
    };
  }),
});

const compiler = new UniversalSemanticCompiler();
const bench = (label, work) => {
  work(); // warm
  const started = process.hrtime.bigint();
  const result = work();
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  console.log(`${label}: ${ms.toFixed(1)}ms${result !== undefined ? ` (${result})` : ''}`);
};

for (const operationCount of [12, 99, 300, 999, 3000]) {
  const evidence = makeEvidence(operationCount);
  const intent = makeIntent(15, Math.max(1, Math.floor(operationCount / 3)));
  bench(`compile 15 scenarios vs ${evidence.operations.length} ops`, () => {
    const result = compiler.compile(intent, evidence);
    return result.status;
  });
}

// Incremental: repair-loop style full recompile vs affected-only recompile.
const evidence = makeEvidence(300);
const intent = makeIntent(15, 100);
const first = compileIntentIncrementally({ intent, evidence, compiler });
bench('recompile ALL 15 scenarios (repair-loop style, no previous)', () => {
  const update = compileIntentIncrementally({ intent, evidence, compiler });
  return update.recompiledScenarioIds.length + ' recompiled';
});
bench('recompile 1 affected scenario (incremental with previous)', () => {
  const update = compileIntentIncrementally({ intent, evidence, compiler, previous: first.state, affectedScenarioIds: ['scenario_3'] });
  return update.recompiledScenarioIds.length + ' recompiled';
});
