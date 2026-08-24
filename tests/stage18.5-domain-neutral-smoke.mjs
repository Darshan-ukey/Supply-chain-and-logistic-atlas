import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
await import(path.join(root,'engine/domain-neutral-core.js'));
await import(path.join(root,'engine/adapters/supply-chain-legacy-v1.js'));
await import(path.join(root,'engine/adapters/legacy-canvas-compat.js'));
const Core=globalThis.EnterpriseOpsCore;
const SCMAdapter=globalThis.SupplyChainLegacyAdapter18_5;
const CanvasCompat=globalThis.LegacyCanvasCompat18_5;
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const coreOntology=read('data/core/enterprise-core-ontology-v1.json');
const catalog=read('data/module-catalog.json');
const scmPack=read('data/domains/supply-chain-domain-pack-v1.json');
const apPack=read('data/domains/accounts-payable-fixture-domain-pack-v1.json');
const roadRaw=read('data/modules/road-ltl-v1.2.json');
const apRaw=read('data/fixtures/accounts-payable-module-v0.1.json');
const page0=read('data/page0/page0-v6.2.2.json');
const result={stage:'18.5',coreVersion:Core.version,tests:[],acceptance:{}};
const ok=(name,details={})=>result.tests.push({name,status:'PASS',...details});

assert.equal(coreOntology.concepts.length,15);ok('Core ontology exposes 15 requested domain-neutral concepts');
const coreText=fs.readFileSync(path.join(root,'engine/domain-neutral-core.js'),'utf8').toLowerCase();
for(const forbidden of ['road ltl','shipment','handling unit','carrier','bill of lading','awb','pod','movementpattern','carriageregime','page0domainid']) assert.equal(coreText.includes(forbidden),false,`core leaked ${forbidden}`);
ok('Core engine source contains no SCM vocabulary or legacy Page-0 field assumption');
assert.equal(Core.validateDomainPack(scmPack).ok,true);assert.equal(Core.validateDomainPack(apPack).ok,true);ok('Both Supply Chain and AP fixture domain packs satisfy the same extension contract shape');

const roadEnterprise=SCMAdapter.adapt(roadRaw);
const road=CanvasCompat.adapt(Core.normalizeModule(roadEnterprise,scmPack,{baseTerritories:page0.page0Domains}));
assert.equal(Core.validateModule(Core.normalizeModule(roadEnterprise,scmPack),scmPack).ok,true);assert.equal(road.processes.length,22);assert.equal(road.territories.length,15);ok('Existing Road LTL content adapts without modifying canonical SCM module',{processes:22,territories:15});
assert.equal(Core.signalRegistry(scmPack).physical.label,'Physical');assert.equal(scmPack.applicabilityDimensions.length,7);ok('SCM-specific signals and applicability live in Supply Chain pack');

const fixtureEntry=catalog.testFixtures.find(x=>x.id==='accounts-payable-fixture');assert.ok(fixtureEntry);assert.equal(fixtureEntry.mustNotPublish,true);ok('AP fixture is registered through module catalog as TEST_ONLY / must-not-publish');
const ap=CanvasCompat.adapt(Core.normalizeModule(apRaw,apPack));
const vm=Core.validateModule(Core.normalizeModule(apRaw,apPack),apPack);assert.equal(vm.ok,true,vm.errors.join('; '));ok('AP fixture validates under enterprise module contract');

const rules=Core.rules(ap,apPack);assert.equal(rules.relationshipRules.length,6);assert.equal(rules.applicabilityDimensions.length,3);ok('Same generic rules registry composes AP relationships and applicability',{relationships:6,dimensions:3});
const canvas0=Core.buildCanvasModel(ap,apPack,'domain');const canvasA3=Core.buildCanvasModel(ap,apPack,'a3');const canvasA4=Core.buildCanvasModel(ap,apPack,'a4');
assert.equal(canvas0.territories.length,7);assert.equal(canvasA3.a3.length,7);assert.equal(canvasA4.tasks.length,7);ok('Same generic canvas model + semantic zoom renders AP territories/A3/tasks',{territories:7,a3:7,tasks:7});

const seq=Core.buildPlaybackSequence(ap);assert.deepEqual(seq,['APF-01','APF-02','APF-03','APF-04','APF-05','APF-06','APF-07']);ok('Same generic playback engine executes AP fixture',{sequence:seq});
const ins=Core.inspectorModel(ap,apPack,'APF-03');assert.equal(ins.label,'Match');assert.ok(ins.execution.decision);assert.ok(ins.systems.authority);ok('Same generic inspector resolves AP task contract');
const trace=Core.buildTraceSteps(ap,'obj-ap-invoice');assert.equal(trace.length,7);ok('Same generic trace engine follows Invoice across AP fixture',{touchpoints:trace.length});
const findings=Core.deriveTransformationFindings(ap,apPack);assert.ok(findings.length>=3);assert.ok(findings.every(x=>['reconciliation','control','systems'].includes(x.category)));ok('Same generic transformation engine uses AP-pack heuristics',{findings:findings.length,categories:[...new Set(findings.map(x=>x.category))]});
const sig=Core.signalRegistry(apPack);assert.equal(Boolean(sig.physical),false);assert.ok(sig.document&&sig.financial&&sig.control);const snap=Core.signalSnapshot(ap.processes[0],apPack);assert.ok(snap.document);ok('Signal vocabulary is domain-registered: AP runs without a Physical signal',{signals:Object.keys(sig)});
const ctx=Core.contextStateForProcess(ap.processes[0],apPack,{entities:['entity-default'],invoiceTypes:['invoice-standard'],matchPolicies:['match-fixture']});assert.equal(ctx.state,'ACTIVE');ok('Applicability dimensions are domain-registered and evaluated generically',{state:ctx.state,dimensions:ctx.dimensions.map(x=>x.dimension)});

result.acceptance={
 moduleRegistry:'PASS',rules:'PASS',canvas:'PASS',semanticZoom:'PASS',playback:'PASS',inspector:'PASS',trace:'PASS',transformation:'PASS',engineChangesRequiredForAP:0,
 fixtureWarning:'Architecture fixture only; no Finance taxonomy or best-practice claim.'
};
fs.writeFileSync(path.join(here,'stage18.5-domain-neutral-smoke.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result.acceptance,null,2));
