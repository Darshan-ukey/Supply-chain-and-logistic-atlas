import { z } from "zod";
import { labelSchema, nameSchema } from "@malkom/agenticai-contract";
import type { GatewayTool } from "./gateway.js";

/**
 * Where the gateway's tools come from: generated from what the org already
 * has — its queues and fields, its deployed engines (rules, validation,
 * integration, extraction), its configured Integrations.
 *
 * Add a new Integration to the org, and the gateway gets a new tool. No code
 * written. The MCP servers are not written one by one, ever — this generator
 * IS the gateway's tool list.
 */

/** One field of the org's own field schemas, as the gateway needs it. */
export const orgFieldSchema = z.object({
  key: z.string().min(1),
  label: labelSchema,
  type: z.enum(["text", "number", "select", "date"]).default("text"),
  options: z.array(z.string()).default([]),
});
export type OrgField = z.infer<typeof orgFieldSchema>;

/** A configured Integration, as the gateway needs it: name, label, whether it writes. */
export const orgIntegrationSchema = z.object({
  name: nameSchema,
  label: labelSchema,
  describe: z.string().max(300).default(""),
  writes: z.boolean().default(false),
  /** JSON Schema for the Integration's arguments, from its configuration. */
  args: z.record(z.string(), z.unknown()).default({}),
});
export type OrgIntegration = z.infer<typeof orgIntegrationSchema>;

/** What the org already has, from its config. The generator reads only this. */
export const orgToolConfigSchema = z.object({
  org: z.string().min(1),
  queue: nameSchema,
  /** The queue's fields, from the org's existing field schemas. */
  fields: z.array(orgFieldSchema).default([]),
  /** The engines this org has deployed. Absent engine = no tool for it. */
  engines: z
    .object({
      rules: z.boolean().default(false),
      validation: z.boolean().default(false),
      extraction: z.boolean().default(false),
      integration: z.boolean().default(false),
    })
    .default({}),
  integrations: z.array(orgIntegrationSchema).default([]),
});
export type OrgToolConfig = z.infer<typeof orgToolConfigSchema>;

/**
 * What the host actually does when a generated tool is called. The gateway
 * generates the doors; the host owns what is behind them. Every callback is
 * optional — a tool whose callback is missing is simply not generated, so a
 * degraded deployment loses tools, never correctness.
 */
export interface GatewayHost {
  /** Read the case record — the case's fields as they stand right now. */
  readCase?(): Promise<unknown>;
  /** Write fields onto the case record, with confidence numbers. */
  writeFields?(args: { fields: Record<string, unknown>; confidence: Record<string, number> }): Promise<unknown>;
  /** Check the org's rule sets — the same rulebook people use. */
  checkRules?(args: { ruleSet: string; fields: Record<string, unknown> }): Promise<unknown>;
  /** Check the org's validation sets. */
  checkValidation?(args: { fields: Record<string, unknown> }): Promise<unknown>;
  /** Ask the org's extraction engine to read a text for fields. */
  extractFields?(args: { text: string }): Promise<unknown>;
  /** Call one of the org's configured Integrations by name. */
  callIntegration?(name: string, args: Record<string, unknown>): Promise<unknown>;
}

const fieldProperties = (fields: readonly OrgField[]): Record<string, unknown> => {
  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    properties[field.key] = {
      type: field.type === "number" ? "number" : "string",
      description:
        field.options.length > 0 ? `${field.label} — one of: ${field.options.join(", ")}` : field.label,
    };
  }
  return properties;
};

/**
 * Generate the gateway's tools from org config. Every tool carries a
 * plain-language label — the org's own words, not framework terms.
 */
export const toolsFromOrgConfig = (config: OrgToolConfig, host: GatewayHost): GatewayTool[] => {
  const tools: GatewayTool[] = [];

  if (host.readCase !== undefined) {
    const readCase = host.readCase.bind(host);
    tools.push({
      name: "read-case",
      label: "Read the case",
      describe: "The case's fields, confidence numbers and notes as they stand right now.",
      writes: false,
      args: { type: "object", properties: {}, additionalProperties: false },
      run: () => readCase(),
    });
  }

  if (host.writeFields !== undefined) {
    const writeFields = host.writeFields.bind(host);
    tools.push({
      name: "write-fields",
      label: "Write fields onto the case",
      describe: `Fill in case fields with your confidence in each. Fields: ${config.fields
        .map((field) => `${field.key} (${field.label})`)
        .join(", ")}`,
      writes: true,
      args: {
        type: "object",
        properties: {
          fields: {
            type: "object",
            description: "The fields to fill, by field key.",
            properties: fieldProperties(config.fields),
          },
          confidence: {
            type: "object",
            description: "Your confidence per filled field, 0 to 1.",
            additionalProperties: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        required: ["fields", "confidence"],
      },
      run: (args) =>
        writeFields({
          fields: (args["fields"] ?? {}) as Record<string, unknown>,
          confidence: (args["confidence"] ?? {}) as Record<string, number>,
        }),
    });
  }

  if (config.engines.rules && host.checkRules !== undefined) {
    const checkRules = host.checkRules.bind(host);
    tools.push({
      name: "check-rules",
      label: "Check the rules",
      describe: "Run the org's rule sets over fields. One rulebook, used by agents and people alike.",
      writes: false,
      args: {
        type: "object",
        properties: {
          ruleSet: { type: "string", description: "Which rule set to check against." },
          fields: { type: "object", description: "The fields to check." },
        },
        required: ["fields"],
      },
      run: (args) =>
        checkRules({
          ruleSet: typeof args["ruleSet"] === "string" ? args["ruleSet"] : "",
          fields: (args["fields"] ?? {}) as Record<string, unknown>,
        }),
    });
  }

  if (config.engines.validation && host.checkValidation !== undefined) {
    const checkValidation = host.checkValidation.bind(host);
    tools.push({
      name: "check-validation",
      label: "Check the fields are valid",
      describe: "Run the org's validation sets over fields — the same checks the HITL screen runs.",
      writes: false,
      args: {
        type: "object",
        properties: {
          fields: { type: "object", description: "The fields to validate." },
        },
        required: ["fields"],
      },
      run: (args) => checkValidation({ fields: (args["fields"] ?? {}) as Record<string, unknown> }),
    });
  }

  if (config.engines.extraction && host.extractFields !== undefined) {
    const extractFields = host.extractFields.bind(host);
    tools.push({
      name: "extract-fields",
      label: "Read a text for fields",
      describe: "Ask the org's extraction engine to pull field values out of a text.",
      writes: false,
      args: {
        type: "object",
        properties: {
          text: { type: "string", description: "The text to read." },
        },
        required: ["text"],
      },
      run: (args) => extractFields({ text: typeof args["text"] === "string" ? args["text"] : "" }),
    });
  }

  if (host.callIntegration !== undefined) {
    const callIntegration = host.callIntegration.bind(host);
    for (const integration of config.integrations) {
      tools.push({
        name: integration.name,
        label: integration.label,
        describe: integration.describe,
        writes: integration.writes,
        args:
          Object.keys(integration.args).length > 0
            ? integration.args
            : { type: "object", properties: {}, additionalProperties: true },
        run: (args) => callIntegration(integration.name, args),
      });
    }
  }

  return tools;
};
