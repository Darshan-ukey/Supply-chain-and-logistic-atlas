# Database migrations

The live Supabase project has three applied Stage-17 migrations:

1. `atlas_stage17_production_boundary`
2. `atlas_stage17_security_hardening`
3. `atlas_stage17_private_rls_helpers`
4. `atlas_stage17_performance_hardening`

The authoritative live definitions are represented by `production/architecture.md`, `production/security-model.md`, and the schema contract below. The project intentionally does not store credentials.
