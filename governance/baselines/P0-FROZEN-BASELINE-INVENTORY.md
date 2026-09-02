# P0 Frozen Baseline Inventory

**Phase:** P0 — Freeze, inventory and regression baseline  
**Status:** COMPLETE  
**Baseline branch:** `atlas-governance-registry-v2.1`  
**P0 branch:** `atlas-presentation-architecture-v1-p0`  
**Baseline head at branch creation:** `95d431297892f7e06a9db652221490ad83b9e6e0`

## 1. Frozen target semantic assets

The governance registry distinguishes production baselines from frozen candidates. P0 records both and does not promote any candidate.

| Asset | Version | Governance status | SHA-256 / identity |
|---|---:|---|---|
| Supply Chain Universe | 7.3 | FROZEN_PRODUCTION_BASELINE | metadata-governed |
| Road LTL | 1.4 | FROZEN_EXECUTION_REFERENCE_CANDIDATE | `c8a0af378ac114d684e79a0640871c73bfaa4493e96e3f5a4b413fa2f330b1d4` |
| Ocean FCL | 0.6 | FROZEN_EXECUTION_REFERENCE_CANDIDATE | `334d6a11595d33c46fa3b4675aa953f1fa6943906894f1cad7a8caf30cad034a` |
| Ocean LCL | 0.6 | FROZEN_EXECUTION_REFERENCE_CANDIDATE | `73d416683f43357cd0eabfe96009405fa22d74008e452f977fa489f0c395850f` |
| Operational Knowledge Contract | 1 | FROZEN_SCHEMA_CANDIDATE | `75cefb11bfabfcb77c7cdab8b17d2cbdb2f4cc3a684150a4da3d94be045f6846` |
| Client Binding Requirement Contract | 1 | FROZEN_SCHEMA_CANDIDATE | `d67786bb7c8f5749fc77fd20d15b2ac4d449874a5ff22a87212ddeef861856df` |
| Canvas | 2.0.0 | FROZEN_PRODUCTION_BASELINE | `bc340946d703ef25297ffd67e6de2e5879958c132722e71d95be058c5ba2c1cb` |
| Universal Ask | 2.0.1 | CERTIFIED_IN_BASELINE_PACKAGE | registry identity |
| Atlas Warehouse | 1 | FROZEN_PRODUCTION_BASELINE | registry identity |

The existing canonical Work Decomposition and WorkDefinition contracts are registered as implementation/compilation pending; P0 does not compile them.

## 2. Current runtime/materialized content

P0 found an important separation that must remain explicit:

- The **frozen semantic target** includes Universe V7.3 and candidate Daughter versions Road LTL V1.4 / Ocean FCL V0.6 / Ocean LCL V0.6.
- The current repository runtime/materialization is not equivalent to promotion of those candidates.
- Candidate release package materialization is explicitly governed as pending/not active until promotion gates pass.

This is not a defect. It is a release-control invariant.

## 3. Platform/runtime regression anchors

The following implementation surfaces are protected regression anchors for later phases:

- root `index.html`
- `admin.html`
- `preview-standalone.html`
- `canvas-v2/`
- `runtime/`
- `execution/`
- `schemas/`
- `tests/`
- `.vercelignore`
- `vercel.json`
- current Ask Atlas API/runtime surface
- current Atlas Warehouse/execution fabric
- governance frozen-asset pointer and integration lock

P0 makes no functional change to these surfaces.

## 4. Candidate execution-depth metrics

| Module | A5 | Required info | Decision gates | Branches | Client bindings | Provenance claims |
|---|---:|---:|---:|---:|---:|---:|
| Road LTL V1.4 | 22 | 152 | 75 | 150 | 128 | 132 |
| Ocean FCL V0.6 | 30 | 113 | 34 | 68 | 99 | 90 |
| Ocean LCL V0.6 | 30 | 127 | 34 | 68 | 99 | 90 |

These metrics are regression expectations for the frozen candidate inputs; they are not an assertion that the candidates have been promoted or independently executor-proven.

## 5. P0 semantic invariants

Later phases must prove:
- no mutation of frozen semantic candidates;
- no accidental promotion through rendering;
- no renderer-authored business semantics;
- no runtime becoming a second source of truth;
- no public delivery of protected Work Decomposition or WorkDefinition;
- presentation-only updates do not change Daughter semantic versions.

## Exit gate

**PASS:** P0 establishes immutable identities, current implementation boundaries, candidate-vs-production separation, payload/security baseline and regression fixtures sufficient to detect unintended mutation in later phases.
