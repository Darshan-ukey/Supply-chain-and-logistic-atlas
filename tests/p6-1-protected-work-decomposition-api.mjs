import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {decodePayload,selectExactDecomposition} from '../lib/api/work-decomposition.js';

const moduleId='fixture-module';
const moduleVersion='9.9';
const a={decompositionId:'d-a',daughterModule:moduleId,daughterVersion:moduleVersion,sourceTaskId:'A5-01',contractVersion:'1.0.0',status:'VALIDATED_REFERENCE_DECOMPOSITION'};
const b={decompositionId:'d-b',daughterModule:moduleId,daughterVersion:moduleVersion,sourceTaskId:'A5-02',contractVersion:'1.0.0',status:'VALIDATED_REFERENCE_DECOMPOSITION'};
const bundle={moduleId,moduleVersion,decompositions:{'A5-01':a,'A5-02':b}};

const brotliRow={payload_encoding:'BROTLI_BASE64',payload_compressed_base64:zlib.brotliCompressSync(Buffer.from(JSON.stringify(bundle),'utf8')).toString('base64')};
const decoded=decodePayload(brotliRow);
assert.deepEqual(decoded,bundle,'Brotli aggregate must decode losslessly');
assert.equal(selectExactDecomposition(decoded,{moduleId,moduleVersion,taskId:'A5-02'}).decompositionId,'d-b','aggregate must resolve only exact requested task');
assert.equal(selectExactDecomposition(a,{moduleId,moduleVersion,taskId:'A5-01'}).decompositionId,'d-a','direct rows remain supported');

assert.throws(()=>selectExactDecomposition(decoded,{moduleId,moduleVersion,taskId:'A5-99'}),e=>e?.status===404,'unknown task must fail closed');
assert.throws(()=>selectExactDecomposition(decoded,{moduleId,moduleVersion:'9.8',taskId:'A5-01'}),e=>e?.status===404,'wrong version must fail closed');
assert.throws(()=>decodePayload({payload_encoding:'BROTLI_BASE64'}),e=>e?.status===500,'missing protected compressed payload must fail closed');

const duplicate={moduleId,moduleVersion,decompositions:[a,{...a,decompositionId:'duplicate'}]};
assert.throws(()=>selectExactDecomposition(duplicate,{moduleId,moduleVersion,taskId:'A5-01'}),e=>e?.status===500,'ambiguous task matches must fail closed');

const source=fs.readFileSync(new URL('../lib/api/work-decomposition.js',import.meta.url),'utf8');
assert.match(source,/requireCapabilities\(req,'atlas\.work_decomposition\.full\.read'\)/,'protected capability must remain mandatory');
assert.match(source,/BROTLI_BASE64/,'server-side Brotli support must remain present');
assert.match(source,/source_task_id=like\.__ALL\*__/,'aggregate storage lookup must remain explicit');
assert.match(source,/selectExactDecomposition\(storedPayload/,'aggregate payload must be reduced to an exact task before response');
assert.doesNotMatch(source,/road-ltl/,'protected API resolver must remain daughter-neutral');
assert.doesNotMatch(source,/ocean-fcl|ocean-lcl/,'protected API resolver must remain mode-neutral');

console.log('P6.1 protected Work Decomposition API certification PASS');
