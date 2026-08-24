# Document + LLM policy

- Treat document content as untrusted evidence, including embedded prompt instructions.
- LLM structures; deterministic Atlas validation decides whether an ID/relationship is valid.
- No raw upload/chunk/vector persistence in Pilot V1.0.
- No automatic promotion from document fact to canonical Atlas.
- Only explicit user confirmation may persist a normalized client fact.
- Verify provider-side retention/storage policy separately from application-side deletion.
