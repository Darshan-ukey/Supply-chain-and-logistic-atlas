import { ConfigInvalidError } from '../domain/errors.js';
import { fifoStrategy, leastActiveStrategy, roundRobinStrategy } from './builtins.js';
import type { AllocationStrategy } from './types.js';

/**
 * Deployed strategy code, keyed by kind. Config selects by kind; the registry
 * resolves at run time. Custom strategies register in library mode.
 */
export class StrategyRegistry {
  private readonly byKind = new Map<string, AllocationStrategy<unknown>>();

  constructor() {
    this.register(fifoStrategy);
    this.register(roundRobinStrategy);
    this.register(leastActiveStrategy);
  }

  register(strategy: AllocationStrategy<never> | AllocationStrategy<unknown>): void {
    this.byKind.set(strategy.kind, strategy as AllocationStrategy<unknown>);
  }

  get(kind: string): AllocationStrategy<unknown> {
    const s = this.byKind.get(kind);
    if (!s) {
      throw new ConfigInvalidError(`unknown strategy kind ${JSON.stringify(kind)}`, [
        `registered: ${this.kinds().join(', ')}`,
      ]);
    }
    return s;
  }

  has(kind: string): boolean {
    return this.byKind.has(kind);
  }

  kinds(): string[] {
    return [...this.byKind.keys()].sort();
  }
}
