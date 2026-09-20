# LTL-03 NMFTA eBOL Schema Recovery Status v0.1

Date: 2026-09-20
Workstream: ATL-35
Status: EVIDENCE RECOVERY CHECKPOINT

## Confirmed issuer artifact target

NMFTA Digital LTL eBOL 2.1.0 documentation explicitly references the OpenAPI artifact:

assets/ebol-apiv2.1.0.yaml

The documentation page confirms:
- OAS 3.0;
- eBOL version 2.1.0;
- BOL_Request schema;
- BOL_Response schema;
- controlled-code schema families;
- POST create;
- PUT update by PRO;
- DELETE by PRO.

## Current recovery status

The issuer documentation identifies the exact YAML asset path, but the research environment cannot currently retrieve the YAML body directly.

Therefore:
- schema location = VERIFIED;
- schema family existence = VERIFIED;
- lifecycle endpoints = VERIFIED;
- exact BOL_Request property names/cardinality = NOT YET VERIFIED;
- exact nested object structure = NOT YET VERIFIED.

## Governance consequence

Do not substitute:
- carrier implementation mirrors;
- cached third-party schemas;
- operational assumptions;
- inferred fields

for the issuer YAML as canonical property-level evidence.

Implementation mirrors may remain Evidence Class C completeness probes only.

## Recovery target

Preferred next evidence step:
recover issuer-maintained assets/ebol-apiv2.1.0.yaml through a directly verifiable route and freeze its checksum/version with the research evidence package.

Once recovered:
1. parse BOL_Request;
2. enumerate properties and nesting;
3. capture required arrays/cardinality;
4. map property -> semantic primitive;
5. map property -> reusable family composition;
6. compare against current independent universe;
7. record additions/conflicts;
8. update generator-instance catalogue.

## Track B implication

No normalization change is warranted merely because exact properties remain unavailable.

The normalization mechanism should ingest the recovered schema when available rather than pre-creating rules based on assumption.
