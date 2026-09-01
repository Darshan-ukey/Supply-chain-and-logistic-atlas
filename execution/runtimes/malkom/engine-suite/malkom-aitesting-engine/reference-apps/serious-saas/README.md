# serious-saas reference app

This reference app exists to prove `brisk-aitesting` against a realistic SaaS slice, not a hello-world page.

It includes:

- login UI
- dashboard UI
- users UI
- role-aware APIs
- admin and viewer tokens
- positive API scenarios
- negative API scenarios
- OpenAPI contract
- in-memory state changes
- audit events

Built-in test users:

| Email | Password | Role | Token |
| --- | --- | --- | --- |
| `admin@example.com` | `admin-password` | `admin` | `admin-token` |
| `viewer@example.com` | `viewer-password` | `viewer` | `viewer-token` |

Run through the package smoke:

```bash
npm run smoke:reference-serious-saas
```
