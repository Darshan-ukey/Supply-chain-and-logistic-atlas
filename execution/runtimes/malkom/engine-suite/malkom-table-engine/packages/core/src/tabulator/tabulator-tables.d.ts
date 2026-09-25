/**
 * Minimal module declaration for the `tabulator-tables` peer dependency.
 * Tabulator 6.x ships no bundled TypeScript types; the engine types the
 * surface it uses itself (see `TabulatorGrid` in ../types.ts) and casts the
 * real constructor across that structural contract at a single seam.
 */
declare module 'tabulator-tables' {
  export const TabulatorFull: new (
    element: unknown,
    options?: unknown
  ) => unknown;
  export const Tabulator: new (element: unknown, options?: unknown) => unknown;
}
