# System Compatibility Foundations

Status: approved architecture and open implementation programme.

## Goal

Brisk should support many systems by understanding shared foundations, not by
growing a special compiler for every product. A platform connector may explain
what a system exposes. It may not decide what the universal compiler means.

For example, Hasura and Directus expose combinations of GraphQL, REST/OpenAPI,
roles, permissions, metadata, relationships, filtering, pagination, and
mutations. Brisk should understand those common facts. A small connector only
translates the platform's own metadata into attributed Evidence Graph facts.

## Current gap list

### Built or partly built

- protocol-neutral Intent IR, Evidence Graph, Workflow IR, typed value flow,
  lifecycle phases, decisions, authority, and cleanup;
- OpenAPI/HTTP evidence and lowering;
- fixture-level GraphQL, messaging, browser, and proprietary compiler proof;
- initial engine support for HTTP, browser, contracts, messaging, and replay.

### Missing shared foundations

- schema dialect and custom-scalar mapping;
- payload and codec profiles beyond ordinary JSON;
- common transport lifecycle for streaming, callbacks, and brokers;
- complete authentication and authorization evidence models;
- pagination/filter/search/relationship/bulk semantics;
- idempotency, concurrency, transaction, and partial-commit semantics;
- long-running operations, webhooks, subscriptions, and eventual consistency;
- common errors, partial success, rate limits, retries, deadlines, and flow
  control;
- versioning, deprecation, federation, disabled discovery, and traffic fallback.

### Missing protocol profiles

- production GraphQL and GraphQL-over-HTTP;
- federated/composite GraphQL gateways;
- OData;
- JSON:API and link-driven/hypermedia resource APIs;
- JSON-RPC 2.0;
- optional SOAP/WSDL for enterprise systems;
- complete gRPC streaming and operational behavior;
- CloudEvents and schema registries independent of broker vendors.

## Foundation layers

### 1. Capability and schema

Every connector describes operations, inputs, outputs, outcomes, side effects,
authority, phases, cleanup, and limits through one versioned capability profile.
Schema dialects remain explicit. An unknown custom scalar or format is missing
type evidence; it is not silently treated as a string.

### 2. Identity and permission

Authentication explains who or what proves identity. Authorization explains
what that identity may do. Brisk must preserve scopes, claims, roles,
attributes, relationships, row/record/field rules, tenant scope, consent, and
impersonation as sourced policy facts. A connector cannot grant permission.

### 3. Data and mutation behavior

Queryable systems commonly expose pagination, cursors, filters, sorting,
search, projections, relations, expansion, batching, and bulk operations.
Mutations additionally need idempotency, version/ETag checks, concurrency,
transactions, compensation, cleanup, and partial-commit evidence.

### 4. Time and transport

Some operations finish immediately; others return a job, emit a callback,
stream results, or become consistent later. Brisk needs explicit polling,
progress, webhook, subscription, deadline, cancellation, backpressure, retry,
and terminal-outcome facts rather than assuming a single request/response.

### 5. Error and evidence

HTTP, GraphQL, gRPC, JSON-RPC, SOAP, and brokers report failure differently.
The adapter preserves protocol details while producing common business outcome
and operational failure evidence. Partial data and per-item batch failures must
not be collapsed into a simple pass.

## Host-neutral proof rule

A foundation is accepted only when multiple system shapes use the same compiler
path. The test suite must fail if universal compiler source imports a vendor
connector or branches on a vendor name. At minimum, the generated-data-API
proof uses plain GraphQL, Hasura, Directus, and one additional anonymous shape.

This does not claim those adapters are currently built. The Phase 10 checklist
contains the implementation and proof gates.

## Standards reviewed

- GraphQL specification and GraphQL-over-HTTP draft;
- OpenAPI 3.1 for callbacks, webhooks, schemas, and security requirements;
- JSON Schema 2020-12 dialect/vocabulary model;
- OData 4.02;
- JSON:API 1.1;
- JSON-RPC 2.0;
- W3C SOAP 1.2 and WSDL 2.0;
- gRPC reflection, health, deadlines, status, flow control, and streaming;
- CloudEvents core/formats/bindings and registry work.

These standards guide adapters and evidence contracts. They do not become
special cases inside the semantic compiler.
