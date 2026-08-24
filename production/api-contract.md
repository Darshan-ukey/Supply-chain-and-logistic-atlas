# Stage 17 API Contract

All authenticated endpoints use same-origin Secure HttpOnly cookies. Supabase RLS remains the final authorization boundary.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | production-boundary health |
| `/api/auth-signup` | POST | create account |
| `/api/auth-login` | POST | authenticate and set cookies |
| `/api/auth-session` | GET | resolve/refresh session |
| `/api/auth-logout` | POST | revoke/clear session |
| `/api/workspaces` | GET | list authorized workspaces |
| `/api/workspaces` | POST | create workspace; owner membership is database-triggered |
| `/api/client-state?workspaceId=` | GET | restore tenant-scoped Client Twin state |
| `/api/client-state` | PUT | persist tenant-scoped Client Twin state |
| `/api/saved-views?workspaceId=` | GET | list workspace views |
| `/api/saved-views` | POST | synchronize saved configurations/version pins |
| `/api/evidence-upload` | POST | private small-file evidence upload + SHA-256 metadata |
| `/api/audit?workspaceId=` | GET | read mutation audit trail |

### Client-state write body
```json
{
  "workspaceId": "uuid",
  "schemaVersion": "client-as-is-mapping-v0.4",
  "moduleId": "road-ltl",
  "moduleVersion": "1.2",
  "state": {}
}
```

### Guardrails
- No endpoint accepts a client-supplied `user_id` as authority.
- Workspace membership is evaluated in RLS.
- No service-role credential is required by the reference API.
- Canonical Atlas assets are not writable through Stage-17 APIs.
