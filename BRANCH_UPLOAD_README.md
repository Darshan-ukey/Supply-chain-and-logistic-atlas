# Supply Chain Atlas 2.0 — Branch Upload Package

This ZIP is rooted as a GitHub repository: extract it and copy the contents directly into an `atlas-v2-release` branch.

## Important release boundary

The runtime/integration layer is complete, including Universal Ask Atlas. The exact byte payloads for the latest frozen File Library assets were not mounted in the build container that created this package. Therefore the repository deliberately retains the final materialization gate instead of silently substituting older assets.

Required frozen assets before Lab certification:

- Universe V7.3
- Road LTL V1.3 — SHA-256 `0f855cc0b11991a0f58a76791d64def8b688f4349b0e5bd1105161241f7ad808`
- Ocean FCL V0.5 — SHA-256 `71526914c600cb10c47434a5b6dc064e851062776a336ae480f37e487e108ebc`
- Ocean LCL V0.5 — SHA-256 `9dbaadc129a6c8be30e9e77c7ff319af40a9f5c4226e82817c2389cde01d18e6`
- Canvas V2.0 frozen ZIP — SHA-256 `bc340946d703ef25297ffd67e6de2e5879958c132722e71d95be058c5ba2c1cb`
- Foundation V1.2 / Atlas Warehouse V1 assets associated with the frozen production-foundation release

## Branch sequence

1. Extract this ZIP into a clean local folder.
2. Commit the repository contents to `atlas-v2-release`.
3. Place the exact frozen asset payloads into the locations documented under `integration/` / `frozen-assets/inbox/`.
4. Run the final materializer and verifier defined by the package.
5. Deploy that branch to Vercel Lab.
6. Run live browser, Universal Ask, public/Admin boundary, and provider/E2E checks.
7. Promote only the exact tested commit.

Do not merge to `main` until the final verifier is green.
