/** Minimal structured logger port. Every line carries queueId/runId when in scope. */
export interface Logger {
  debug(fields: Record<string, unknown>, msg: string): void;
  info(fields: Record<string, unknown>, msg: string): void;
  warn(fields: Record<string, unknown>, msg: string): void;
  error(fields: Record<string, unknown>, msg: string): void;
}

function line(level: string, fields: Record<string, unknown>, msg: string): string {
  return JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields });
}

/** JSON-lines to stdout/stderr — the small-footprint default. Swap via engine options. */
export const jsonConsoleLogger: Logger = {
  debug: () => {},
  info: (f, m) => console.log(line('info', f, m)),
  warn: (f, m) => console.warn(line('warn', f, m)),
  error: (f, m) => console.error(line('error', f, m)),
};

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
