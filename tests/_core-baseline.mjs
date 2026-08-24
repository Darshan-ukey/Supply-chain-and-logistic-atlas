import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const baseline=JSON.parse(fs.readFileSync(path.join(root,'release/baselines/core-hashes-stage21.json'),'utf8')).hashes;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export {root,baseline,sha};
export function assertFrozen(check){for(const [rel,expected] of Object.entries(baseline))check(`frozen:${rel}`,sha(path.join(root,rel))===expected,sha(path.join(root,rel)))}
