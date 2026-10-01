# Atlas V2 Product Boundary — Supply Chain Atlas vs Malkom Domain Warehouse

**Status:** GOVERNING PRODUCT-BOUNDARY DECISION  
**Effective:** 2026-10-01  
**Scope:** Atlas V2 and post-V2 domain expansion, Daughter generation, downstream generators, and Malkom Domain Warehouse integration

## Decision

Supply Chain Atlas and Malkom Domain Warehouse are separate products.

They may use a common generation mechanism and may derive knowledge from a common governed universe/source foundation, but they must not be treated as one product, one roadmap, or one canonical product knowledge store.

### Supply Chain Atlas

Supply Chain Atlas is the broader supply-chain product.

Its architecture is intentionally capable of supporting the wider supply-chain world, including planning, procurement/sourcing, order management, manufacturing/transform, inventory/warehousing, transportation/distribution, trade/compliance, delivery, returns, finance/settlement, exception control, claims, customer operations, assets and master/reference data.

Atlas V2 does **not** require execution-depth coverage across every supply-chain domain before release.

The deliberate V2 strategy is:

> prove the architecture and execution-readiness machinery deeply in the current freight/logistics domain first; make Daughter and downstream generation reliable; then expand supply-chain domain depth after V2.

Road LTL / freight-logistics depth is therefore a proof domain and first executable implementation, not a boundary on the future scope of Supply Chain Atlas.

### Malkom Domain Warehouse

Malkom Domain Warehouse is a separate WNS product capability focused on shipping and distribution.

It may consume selected outputs produced through the common generation architecture, but its product scope, operational content, client-specific knowledge, configurations, bindings, and Malkom-oriented runtime assets remain separate from Supply Chain Atlas.

Malkom requirements must not redefine the canonical Atlas architecture or constrain Atlas to shipping/distribution.

Likewise, later Atlas expansion into procurement, planning, manufacturing, warehousing or other supply-chain domains does not require Malkom Domain Warehouse to absorb those domains unless separately authorized by the Malkom product roadmap.

## Shared generation does not mean shared product identity

The governing relationship is:

```
Common governed universe / research foundation
                  |
                  v
      Common generation architecture
                  |
          +-------+--------+
          |                |
          v                v
 Supply Chain Atlas   Malkom Domain Warehouse
 broad SCM product    shipping/distribution product
 independent roadmap  WNS product roadmap
```

The generation mechanism may be reusable. Product identity, governed releases, ownership boundaries, domain scope, client-specific assets and downstream runtime packages remain distinct.

## Layer model

### Layer 1 — Common generation foundation

Reusable technical machinery and semantic contracts, including where applicable:

- domain-neutral enterprise core ontology;
- generation contracts;
- provenance/evidence rules;
- knowledge-resolution mechanics;
- Operational Knowledge structures;
- recursive Work Decomposition machinery;
- canonical WorkDefinition machinery;
- Client Binding pattern;
- runtime/downstream projection contracts.

This layer must remain sufficiently domain-neutral that freight-specific concepts are not mandatory universal primitives.

### Layer 2 — Product domain assets

Supply Chain Atlas governed domain assets and Daughters.

These are reusable supply-chain execution-reference assets governed as Atlas product knowledge.

V2 may be deep primarily in freight/logistics while the broader supply-chain territories remain reference-level or planned.

### Layer 3 — Consumer/product-specific outputs

Destination-specific projections and product packages, including Malkom Domain Warehouse.

Examples include:

- Malkom shipping/distribution domain assets;
- Malkom-specific forms, mappings or runtime schemas;
- client-specific operational rules and bindings;
- ERP/BPM/agent/runtime projections;
- other implementation-specific packages.

Layer 3 artifacts must not silently become canonical Atlas truth.

## Knowledge-flow rule

Atlas-derived knowledge may be projected into Malkom through governed downstream generation.

Malkom-specific, WNS-specific or client-specific knowledge may flow back toward Atlas only through an explicit evidence, provenance and promotion process. It must not automatically overwrite or extend canonical Atlas knowledge.

This prevents a downstream product from becoming an accidental source of truth for the upstream product.

## V2 sequencing rule

Before Atlas V2 release, success is **not** defined as equivalent execution depth across the entire supply-chain universe.

The V2 proof is:

1. the domain-neutral architecture holds;
2. the freight/logistics proof domain can be represented to required execution depth;
3. Daughter generation works from governed source knowledge;
4. downstream generation can produce implementation-ready artifacts without corrupting canonical truth;
5. Atlas remains extensible to additional supply-chain domains without redesigning its core around freight assumptions.

## Post-V2 roadmap

After V2 is live, Atlas may progressively deepen additional supply-chain territories such as:

- procurement and strategic sourcing;
- demand and supply planning;
- inventory and warehousing;
- manufacturing / transform;
- order management;
- returns and reverse supply chain;
- cross-cutting orchestration capabilities such as risk/resilience, performance/economics, sustainability/circularity, people/capability, and broader technology/data governance.

These are roadmap expansions, not V2 release blockers unless separately promoted into the V2 gate.

## Non-negotiable architectural protections

1. **Atlas core remains domain-neutral.** Freight-specific objects such as shipment, carrier, BOL, pickup or delivery belong in domain extensions/modules, not as mandatory enterprise-core concepts.
2. **Separate product registries/releases.** Atlas and Malkom Domain Warehouse must have distinguishable release identities and governed artifacts.
3. **No automatic bidirectional promotion.** Downstream Malkom/client knowledge cannot silently mutate Atlas canonical truth.
4. **No roadmap coupling.** Atlas supply-chain expansion and Malkom product scope evolve independently unless an explicit decision links them.
5. **No product-identity collapse.** Shared generators, schemas or source knowledge do not make Supply Chain Atlas and Malkom Domain Warehouse the same product.

## Product statement

> **Supply Chain Atlas is a broad, independently extensible supply-chain execution-readiness product. Malkom Domain Warehouse is a separate WNS shipping-and-distribution product capability. They may share governed generation mechanisms and source foundations, but their product boundaries, roadmaps, governed assets and downstream releases remain separate.**

## Governance note

This record establishes the intended product and architecture boundary for Atlas governance. It does not by itself determine legal title, employment-related IP ownership, licensing rights, confidentiality obligations, or contractual ownership; those remain subject to the applicable agreements and policies.
