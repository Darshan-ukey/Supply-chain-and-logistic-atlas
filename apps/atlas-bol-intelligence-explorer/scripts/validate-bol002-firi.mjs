import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../src/data/bol-intelligence.ts", import.meta.url), "utf8");

const required = [
  "FIRI-BOL002-R01",
  "FIRI-BOL002-R08",
  "REL-BOL002-HU-COMMODITY",
  "VAL-BOL002-04",
  "OBSERVED_DESCRIPTION",
  "CLASSIFICATION_SUFFICIENT_DESCRIPTION",
  "Malkom",
  "VLM/agent/document-digitization",
  "Handling Unit Line No = Commodity Item Number",
  "PENDING_INDEPENDENT_QA_REHASH",
];

for (const token of required) assert.ok(source.includes(token), `missing required BOL-002 FIRI token: ${token}`);

assert.ok(source.includes('if (n === 2) return "PARTIALLY_SUFFICIENT";'), "BOL-002 must remain PARTIALLY_SUFFICIENT before independent QA");
assert.ok(!source.includes('if (n === 2) return "EXECUTION_SUFFICIENT";'), "BOL-002 must not self-promote to EXECUTION_SUFFICIENT");
assert.ok(source.includes("Do not equate with Commodity Item identifier without source/client evidence."), "Handling Unit Line No ambiguity must remain fail-closed");
assert.ok(source.includes("Do not invent universal continuation/attachment precedence."), "Continuation/attachment precedence must remain fail-closed");

const vectors = [
  "1 pallet / 1 commodity",
  "1 pallet / multiple commodities",
  "multiple pallets / same commodity",
  "multiple commodities / multiple handling units",
  "description + NMFC",
  "vague description",
  "abbreviated description",
  "general vs specific NMFC candidate",
  "hazmat commodity",
  "compound commodity line",
  "missing association",
  "conflicting evidence",
  "incomplete external ClassIT+ response",
];

const validation = fs.readFileSync(new URL("../../../../governance/operational-knowledge/firi/ATL_134_BOL_002_FIRI_V1_VALIDATION.md", import.meta.url), "utf8");
for (const vector of vectors) assert.ok(validation.includes(vector), `missing adversarial vector: ${vector}`);

console.log("ATL-134 BOL-002 FIRI regression guard: PASS");
