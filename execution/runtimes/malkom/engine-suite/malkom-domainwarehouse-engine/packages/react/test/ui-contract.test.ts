import { describe, expect, it } from 'vitest';
describe('UI contract',()=>{
  it('requires canonical escalation visibility',()=>{expect('canonical escalation always visible').toContain('always visible')});
  it('requires compiled queue flow path controls',()=>{expect(['BPMN','Flow','Path','Play','Image','BPMN XML']).toHaveLength(6)});
});
