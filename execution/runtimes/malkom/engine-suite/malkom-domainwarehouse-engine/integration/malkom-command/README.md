# Malkom Command integration template

This folder is intentionally a **host integration template**, not a second Command implementation.

The Domain Warehouse engine remains pure TypeScript/Zod. The Malkom Command host owns persistence, RBAC (`C_ADMIN` or equivalent), audit, and materialization into existing Raw Materials.

## Suggested aggregates

- `dw_domain_packs`
- `dw_work_definitions`
- `dw_knowledge_notes`
- `dw_client_bindings`
- `dw_client_extensions`
- `dw_materializations`

## Suggested host endpoints

- `GET /api/domain-warehouse/domains`
- `GET /api/domain-warehouse/domains/:domainId`
- `GET /api/domain-warehouse/coverage`
- `POST /api/domain-warehouse/validate`
- `POST /api/domain-warehouse/materialize`
- `POST /api/domain-warehouse/publish`

## Materialization rule

`Reference WorkDefinition + Client Binding + Client Extension -> Malkom compiler -> Queue/Workflow/ValueList materials -> existing Raw Materials -> existing downstream pipeline.`

Current runtime capability blockers MUST prevent materialization; they must never be silently converted.
