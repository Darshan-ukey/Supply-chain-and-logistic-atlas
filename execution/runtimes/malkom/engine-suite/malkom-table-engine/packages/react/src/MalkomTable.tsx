/**
 * React bindings for the Malkom Table Engine.
 *
 * The engine owns everything inside its container; React owns the container.
 * Mount/destroy follow React's lifecycle; the engine instance is exposed via
 * ref and `onReady` for imperative work (refresh, export, prefilters, ...).
 */

import {
  forwardRef,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type Ref
} from 'react';
import { MalkomTableEngine } from '@malkom/table-core';
import type { MalkomTableConfig, RowData } from '@malkom/table-core';

export interface MalkomTableProps<TRow extends RowData = RowData> {
  /**
   * Engine configuration. Captured when the component mounts; changing its
   * identity re-creates the engine (pass a stable reference for normal use).
   */
  config: MalkomTableConfig<TRow>;
  /**
   * Optional data prop for React-driven data flows. When provided (and on
   * every identity change) it is pushed into the engine via `setData`.
   * Leave undefined when the engine pulls its own data via `config.loadData`.
   */
  data?: TRow[];
  className?: string;
  style?: CSSProperties;
  /** Called once per engine instance, after construction. */
  onReady?: (engine: MalkomTableEngine<TRow>) => void;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T): void {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
  } else {
    (ref as { current: T }).current = value;
  }
}

function MalkomTableInner<TRow extends RowData = RowData>(
  props: MalkomTableProps<TRow>,
  ref: Ref<MalkomTableEngine<TRow> | null>
): ReactElement {
  const { config, data, className, style, onReady } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MalkomTableEngine<TRow> | null>(null);
  // Always-current forwarded ref, so the engine effect (keyed on config
  // identity only) never assigns through a stale closure.
  const latestRef = useRef<Ref<MalkomTableEngine<TRow> | null>>(ref);

  useEffect(() => {
    latestRef.current = ref;
  });

  // Honor ref IDENTITY changes per React's contract: detach the previous
  // ref and attach the new one to the live engine.
  useEffect(() => {
    assignRef(ref, engineRef.current);
    return () => assignRef(ref, null);
  }, [ref]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const engine = new MalkomTableEngine<TRow>(container, config);
    engineRef.current = engine;
    assignRef(latestRef.current, engine);
    onReady?.(engine);
    return () => {
      assignRef(latestRef.current, null);
      engineRef.current = null;
      engine.destroy();
    };
    // The engine is intentionally rebuilt only when the config identity
    // changes — its internal state is not React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (data !== undefined) {
      engineRef.current?.setData(data);
    }
  }, [data, config]);

  return <div ref={containerRef} className={className} style={style} />;
}

/**
 * `<MalkomTable config={...} ref={engineRef} />`
 *
 * The ref resolves to the `MalkomTableEngine` instance (or null while
 * unmounted).
 */
export const MalkomTable = forwardRef(MalkomTableInner) as <
  TRow extends RowData = RowData
>(
  props: MalkomTableProps<TRow> & { ref?: Ref<MalkomTableEngine<TRow> | null> }
) => ReactElement;
