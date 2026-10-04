import fs from 'node:fs';
import path from 'node:path';
import {generateEvidence} from './evidence.mjs';
const root = process.cwd();
const {files} = await generateEvidence(root);
for (const [p, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, p)), {recursive: true}); fs.writeFileSync(path.join(root, p), c); console.log('WROTE', p); }
