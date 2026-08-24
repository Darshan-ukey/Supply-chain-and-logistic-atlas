# Dependency lock status

`package.json` pins direct dependency versions, but this package does not claim a generated `package-lock.json` because npm-registry installation was not available in the artifact assembly runtime. Generate and commit a lockfile in a connected environment before Stable promotion.
