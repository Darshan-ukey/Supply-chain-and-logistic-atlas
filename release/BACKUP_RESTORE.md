# Backup / restore

Pilot source documents are session-ephemeral and therefore intentionally absent from database backup. Persistent workspace tables should use Supabase backup/recovery controls. Before production retention of real confidential client work, rehearse restore to an isolated target and document RTO/RPO expectations.
