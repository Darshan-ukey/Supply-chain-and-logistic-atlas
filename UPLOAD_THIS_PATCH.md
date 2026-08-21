# Upload this patch to the GitHub repository root

This patch repairs the Vercel build failure from Git commit `f9fce15`.

Upload the contents of this folder to the repository root and commit to `main`.
It restores the v0.6.6 simulation engine and UI-action validator that were present in the release ZIP but absent from the GitHub commit, updates Node.js to 24.x, and adds a prebuild deployment-file/import verifier.

No frozen Atlas content or simulation semantics are changed.
