# Client Binding Resolution Principle V1 — FROZEN

Status: **FROZEN GOVERNING PRINCIPLE**  
Effective: 2026-09-02

## Core rule
`CLIENT_BINDING_REQUIRED` is not a bucket for missing operational research.

Before asking a client for a value, Atlas must determine as far as authoritative operational evidence permits:
- **what** information/configuration must exist;
- **when** it is required;
- **why** it is required;
- expected semantic/type/cardinality;
- validation/acceptable constraints;
- which decision/control/action consumes it;
- expected outcome/failure behavior;
- canonical authority/system/owner role;
- source basis/provenance.

The client then supplies only environment-specific values such as actual system/field names, organizational owners, thresholds, SLAs, route/team identifiers, local code crosswalks, contracts/policies, master/network configuration and transaction/master-data values.

## Required binding object fields
At minimum: requiredWhen, why, valueOrigin, validation, sourceRefs/basis, systemOfRecord contract, clientFieldMapping slot, authorityOwner contract, collectionQuestion, resolutionStatus.

## Governing distinction
**Required object/semantic requirement ≠ runtime value.** Atlas owns the former; the client/transaction/environment supplies the latter where appropriate.
