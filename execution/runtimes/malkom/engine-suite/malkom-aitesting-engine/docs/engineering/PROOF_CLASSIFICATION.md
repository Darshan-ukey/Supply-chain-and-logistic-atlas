# Proof Classification

These labels are mutually informative and must not be substituted for one
another.

| Proof class | Meaning | Does not prove |
| --- | --- | --- |
| `static` | Types, schemas, exports, or source structure were inspected or compiled. | Runtime behavior or integration. |
| `synthetic` | Deterministic handcrafted fixtures exercised a code path. | Real subsystem or application integration. |
| `reference-app` | A versioned application in this repository executed through the shipping product path. | Arbitrary host or production behavior. |
| `host-integration` | A real embedding host exercised the packaged integration contract. | Other host architectures. |
| `cross-architecture` | The accepted language, protocol, runtime, platform, and package-manager proof matrix passed. | Environments outside the stated matrix. |
| `production` | A released artifact ran in an explicitly identified production-like or production environment with retained evidence. | Universal support beyond the tested scope. |

Every proof record must include the product version, environment, configuration,
command or procedure, sample count, pass/fail/skip/error counts, evidence path,
and exclusions.

