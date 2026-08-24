# Dependency Lock Status

Stage 22 pins all direct production dependencies to exact versions:
- `jszip` 3.10.1
- `pdf-parse` 1.1.1
- `xlsx` 0.18.5

A `package-lock.json` could not be generated in this execution environment because npm registry access timed out and the packages were not present in the local npm cache.

This does not change application behavior in the current artifact, but a committed lockfile is still recommended before Stable production promotion so the complete transitive dependency graph is reproducible. The first connected Vercel/Git build should generate and commit the lockfile rather than allowing Stable and Lab to resolve different transitive trees.
