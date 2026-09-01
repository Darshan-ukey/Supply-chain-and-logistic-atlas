import type { Ending, Start } from "@malkom/agenticai-contract";

/**
 * An adapter — how a framework connects to the contract.
 *
 * The adapter passes the goal in and the endings out. It never controls the
 * agent's steps: in every framework, the agent inside is autonomous. A new
 * framework is a new adapter; the contract does not change. A framework that
 * does not exist yet will cost one adapter when it appears — days of work,
 * not a rewrite.
 */
export interface Adapter {
  readonly name: string;
  /** Start the agent. The goal goes in; one of the four endings comes out. */
  start(start: Start): Promise<Ending>;
}

/**
 * The adapters a runtime has installed. A manifest naming an adapter the
 * runtime does not have is refused before anything runs, plainly, rather than
 * failing halfway through with something confusing.
 */
export class AdapterRegistry {
  private readonly byName = new Map<string, Adapter>();

  register(adapter: Adapter): this {
    this.byName.set(adapter.name, adapter);
    return this;
  }

  get(name: string): Adapter | undefined {
    return this.byName.get(name);
  }

  names(): string[] {
    return [...this.byName.keys()];
  }
}
