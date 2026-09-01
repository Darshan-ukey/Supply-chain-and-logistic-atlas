import type { MiniEmailProvider } from '../types.js';
import { MiniEmailAdapterError, type AdapterContext, type MiniEmailAdapter } from './adapter.js';
import { GmailAdapter } from './gmail.js';
import { GraphAdapter } from './graph.js';

/**
 * Picks the adapter for a provider.
 *
 * The only place in the engine that knows which providers exist. Supporting a
 * new one means writing an adapter and adding a branch here — nothing above
 * this line changes.
 */
export function createAdapter(
  provider: MiniEmailProvider,
  context: AdapterContext
): MiniEmailAdapter {
  switch (provider) {
    case 'gmail':
      return new GmailAdapter(context);
    case 'outlook':
      return new GraphAdapter(context);
    default: {
      // Exhaustiveness: adding a provider to the union without an adapter
      // fails the build here rather than at runtime in a task.
      const unreachable: never = provider;
      throw new MiniEmailAdapterError({
        code: 'unknownProvider',
        message: `No adapter for provider "${String(unreachable)}".`,
        retryable: false
      });
    }
  }
}

export * from './adapter.js';
export * from './mime.js';
export { GmailAdapter, buildGmailQuery } from './gmail.js';
export { GraphAdapter, buildGraphFilter, buildGraphSearch } from './graph.js';
