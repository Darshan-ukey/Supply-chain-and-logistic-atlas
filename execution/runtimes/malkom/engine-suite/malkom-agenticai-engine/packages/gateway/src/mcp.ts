import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Gateway } from "./gateway.js";

/**
 * MCP over the gateway.
 *
 * MCP is how an agent written in any language reaches data safely. This is
 * the door an agent process reaches through when it is not running in-process
 * — a Python agent, a customer's own image, anything that speaks MCP. It adds
 * a transport and nothing else: whether a call is allowed is the access pass
 * check, exactly as it is for an in-process run, and the recording is the
 * same recording.
 *
 * One server per run, torn down with the run. A long-lived server shared
 * between runs would need the pass on every call, and a pass that travels
 * separately from its run is a pass waiting to be replayed.
 */

export interface McpGatewayOptions {
  readonly gateway: Gateway;
  readonly name: string;
  readonly version: string;
  /** Served as the `case` resource, so an agent reads its case without spending a tool call. */
  readonly caseRecord?: unknown;
}

export interface McpGateway {
  readonly server: McpServer;
  /** The tool names actually exposed on this server. */
  readonly exposed: readonly string[];
}

/**
 * Build an MCP server whose tools are this run's offered tools — the pass's
 * named list, writes hidden on shadow runs. The host attaches whatever
 * transport it wants; transport is a deployment decision.
 */
export const mcpGateway = (options: McpGatewayOptions): McpGateway => {
  const server = new McpServer({ name: options.name, version: options.version });
  const exposed: string[] = [];

  for (const tool of options.gateway.offered()) {
    exposed.push(tool.name);
    server.registerTool(
      tool.name.replace(/-/g, "_"),
      {
        title: tool.label,
        description: tool.describe === "" ? tool.label : `${tool.label} — ${tool.describe}`,
        inputSchema: {
          args: z.record(z.string(), z.unknown()).describe("Arguments for this tool"),
        },
      },
      async ({ args }: { args?: Record<string, unknown> }) => {
        const reply = await options.gateway.call(tool.name, args ?? {});
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(reply.ok ? reply.reply : { refused: reply.refused }),
            },
          ],
          isError: !reply.ok,
        };
      },
    );
  }

  if (options.caseRecord !== undefined) {
    const caseRecord = options.caseRecord;
    server.registerResource(
      "case",
      "malkom://case",
      { title: "The case you are working on", mimeType: "application/json" },
      async (uri) => ({
        contents: [{ uri: uri.href, text: JSON.stringify(caseRecord) }],
      }),
    );
  }

  return { server, exposed };
};
