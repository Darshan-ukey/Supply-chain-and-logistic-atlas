import type { WorkDefinition, ClientBinding, ClientExtension, KnowledgeNote } from '@malkom/domainwarehouse-contract';

export class DomainWarehouse {
  #definitions = new Map<string,WorkDefinition>();
  #bindings = new Map<string,ClientBinding>();
  #extensions = new Map<string,ClientExtension>();
  publish(definition:WorkDefinition){ this.#definitions.set(`${definition.id}@${definition.version}`, structuredClone(definition)); }
  get(id:string,version:string){ const v=this.#definitions.get(`${id}@${version}`); return v ? structuredClone(v) : undefined; }
  list(){ return [...this.#definitions.values()].map((v)=>structuredClone(v)); }
  bind(binding:ClientBinding){ this.#bindings.set(binding.id,structuredClone(binding)); }
  extend(extension:ClientExtension){ this.#extensions.set(extension.id,structuredClone(extension)); }
  knowledgeNotes(workDefinitionId?:string):KnowledgeNote[]{
    return this.list().filter((d)=>!workDefinitionId || d.id===workDefinitionId).flatMap((d)=>d.notes.map((n)=>structuredClone(n)));
  }
  snapshot(){
    return {
      definitions:this.list(),
      bindings:[...this.#bindings.values()].map((value)=>structuredClone(value)),
      extensions:[...this.#extensions.values()].map((value)=>structuredClone(value))
    };
  }
}
