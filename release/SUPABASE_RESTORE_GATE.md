# Supabase restore gate

An isolated full restore/PITR rehearsal is a production-confidence gate before storing persistent real-client confidential evidence at scale. It is deliberately not simulated inside this package because a true rehearsal needs an isolated database target.
