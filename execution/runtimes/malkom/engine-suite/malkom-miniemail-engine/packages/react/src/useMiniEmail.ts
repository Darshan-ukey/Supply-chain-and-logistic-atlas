import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  MalkomMiniEmailEngine,
  type MiniEmailAvailability,
  type MiniEmailEngineDeps,
  type MiniEmailHostConnector,
  type MiniEmailState
} from '@malkom/miniemail-core';

/**
 * Mounts the core engine inside React's lifecycle.
 *
 * The engine is the source of truth; this hook only subscribes to it. State
 * is read through `useSyncExternalStore`, so a change that lands mid-render
 * cannot be torn or missed — the engine emits from provider callbacks, which
 * React does not otherwise know about.
 */

export interface UseMiniEmailOptions extends MiniEmailEngineDeps {
  /** Load the anchor on mount. Off when the host wants to control timing. */
  readonly autoLoad?: boolean;
}

export interface UseMiniEmailResult {
  readonly engine: MalkomMiniEmailEngine;
  readonly state: MiniEmailState;
  readonly availability: MiniEmailAvailability;
}

export function useMiniEmail(
  connector: MiniEmailHostConnector,
  options: UseMiniEmailOptions = {}
): UseMiniEmailResult {
  const { autoLoad = true, ...deps } = options;

  // The engine is rebuilt only when the identity of the mail changes. Rebuilding
  // on every render would throw away loaded state and re-hit the provider.
  const anchorKey = `${connector.input?.anchor?.conversationId ?? ''}:${
    connector.input?.anchor?.messageId ?? ''
  }`;

  const depsRef = useRef(deps);
  depsRef.current = deps;

  const engine = useMemo(
    () => new MalkomMiniEmailEngine(connector, depsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchorKey]
  );

  useEffect(() => {
    if (autoLoad) void engine.load();
    return () => engine.destroy();
  }, [engine, autoLoad]);

  const state = useSyncExternalStore(
    (onChange) => engine.subscribe(onChange),
    () => engine.state,
    () => engine.state
  );

  // Availability is derived, so it is recomputed whenever state moves rather
  // than tracked separately and risking a stale answer.
  const availability = useMemo(
    () => engine.availability,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, state]
  );

  return { engine, state, availability };
}
