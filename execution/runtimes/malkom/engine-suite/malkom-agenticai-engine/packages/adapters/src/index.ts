/**
 * @malkom/agenticai-adapters — one adapter per framework.
 *
 * On day one we ship the TypeScript adapter; the LangGraph (Python) adapter
 * follows with the adapter stage. Any other framework that follows the
 * contract also works: a new framework is a new adapter, not a new engine.
 */

export { AdapterRegistry, type Adapter } from "./adapter.js";
export { typescriptAdapter, manifestAgent, goalIn, type TypescriptAgent } from "./typescript.js";
export { langgraphAdapter, type LanggraphOptions } from "./langgraph.js";
export { endArgsSchema, toEnding, type EndArgs } from "./ending.js";

/**
 * The sandbox stand-in model — a careful clerk that runs an agent end to end
 * with no AI key. It lives here, beside the TypeScript adapter, because it is
 * framework-shaped (a Vercel-SDK mock) and belongs with the framework binding
 * that can use it, not in the framework-free studio. Its home is what keeps
 * "clone it, run it, watch an agent work" a battery the engine ships, without
 * putting a model inside the definition centre.
 */
export { sandboxModel } from "./sandboxmodel.js";
