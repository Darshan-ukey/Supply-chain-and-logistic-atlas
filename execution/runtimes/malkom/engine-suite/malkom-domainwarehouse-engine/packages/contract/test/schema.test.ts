import { describe, expect, it } from 'vitest';
import { workDefinitionSchema } from '../src/index.js';
import defsJson from '../../../fixtures/road-ltl/work-definitions.json' with { type: 'json' };
describe('contract',()=>{it('parses the 22 Road LTL definitions',()=>{for(const d of defsJson)expect(workDefinitionSchema.safeParse(d).success).toBe(true)})});
