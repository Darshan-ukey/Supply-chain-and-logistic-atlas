# Deployment status

Package-side validation can be completed locally. Live deployment remains environment-specific and is not asserted by this ZIP.

Open external gates: connect Vercel target, configure environment variables, install dependencies / create lockfile, apply Supabase migrations, run deployed E2E, and run live provider certification if enabled.
