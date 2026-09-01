/** Minimal typed event emitter for engine events. */

export class Emitter<
  TEvents extends { [K in keyof TEvents]: (...args: never[]) => void }
> {
  private readonly listeners = new Map<keyof TEvents, Set<TEvents[keyof TEvents]>>();

  on<K extends keyof TEvents>(event: K, listener: TEvents[K]): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof TEvents>(event: K, listener: TEvents[K]): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of Array.from(set)) {
      try {
        (listener as (...a: Parameters<TEvents[K]>) => void)(...args);
      } catch {
        /* listener errors must not break the engine */
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
