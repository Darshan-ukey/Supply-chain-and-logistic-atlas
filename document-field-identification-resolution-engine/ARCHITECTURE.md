# Document Field Identification & Resolution Engine

## Boundary

This branch holds the reusable executable Field Identification & Resolution Engine (FIRI Engine).

It does not own document-domain truth.

Document/domain knowledge is supplied by governed Atlas domain-intelligence assets, for example:

- Atlas BOL Domain Intelligence
- future Atlas Commercial Invoice Domain Intelligence
- future Atlas Customs Domain Intelligence

The engine consumes applicable governed knowledge and evidence to perform identification, association, deterministic validation, bounded semantic resolution, provenance checks, abstention/conflict handling, and controlled final-record proposals.

## First specialization

Atlas BOL Domain Intelligence + FIRI Engine -> BOL Field Identification & Resolution -> downstream Malkom adapter/consumer.

Malkom is a downstream consumer, not the authority for BOL semantics.

## Experimental proof

A = Gemini alone.
B = Gemini + deterministic FIRI.
C = Gemini + deterministic + semantic FIRI.
D = Atlas-domain-guided Gemini extraction + FIRI resolution.

The four arms must use controlled inputs/settings and independent ground truth. Synthetic regression tests prove software behavior only, not extraction accuracy or Malkom readiness.

## Current recovery state

The supplied v0.21 package is the retained executable baseline (131 tests). The v0.22 observable checkpoint was 134/134. The original v0.22 byte-identical source was not retained. The bounded v0.22 integrity delta has therefore been reconstructed and is explicitly marked reconstructed. Five-BOL independent source-image-region verification remains pending.
