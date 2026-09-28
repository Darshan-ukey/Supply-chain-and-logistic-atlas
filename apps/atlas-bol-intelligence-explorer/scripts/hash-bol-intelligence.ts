import { createHash } from "node:crypto";
import { bolIntelligencePackage } from "../src/data/bol-intelligence";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([k,v]) => [k, canonicalize(v)])
    );
  }
  return value;
}

const hashInput = structuredClone(bolIntelligencePackage);
hashInput.package_hash = "";
const canonicalJson = JSON.stringify(canonicalize(hashInput));
const digest = createHash("sha256").update(canonicalJson, "utf8").digest("hex");

console.log(`sha256:${digest}`);
