/**
 * @malkom/agenticai-gateway — the MCP gateway.
 *
 * Written once, inside the agent engine. Not per customer. Not per queue.
 * Its tools are generated from what the org already has; the access pass is
 * checked on every call; every call is recorded and timed by the gateway
 * itself, so you see exactly what an agent touched, even if the agent's code
 * is badly written.
 */

export { Gateway, callKey, type GatewayTool, type GatewayOptions } from "./gateway.js";
export {
  orgFieldSchema,
  orgIntegrationSchema,
  orgToolConfigSchema,
  toolsFromOrgConfig,
  type OrgField,
  type OrgIntegration,
  type OrgToolConfig,
  type GatewayHost,
} from "./tools.js";
export { redactorFor, redactTextFor } from "./redact.js";
export { mcpGateway, type McpGateway, type McpGatewayOptions } from "./mcp.js";
