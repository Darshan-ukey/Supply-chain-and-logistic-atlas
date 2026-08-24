# Environment / Secret Matrix

| Variable | Local | Lab | Stable | Secret? | Required |
|---|---|---|---|---|---|
| `ATLAS_RELEASE_CHANNEL` | `lab` | `lab` | `stable` | No | Yes |
| `SUPABASE_URL` | test/dev | approved project | production project | No | Yes |
| `SUPABASE_PUBLISHABLE_KEY` | test/dev | target publishable key | target publishable key | Treat as configuration | Yes |
| `ATLAS_LLM_PROVIDER` | `none` allowed | optional | optional unless policy requires | No | Yes (may be `none`) |
| `ATLAS_LLM_API_KEY` | optional | server-side | server-side | **Yes** | If provider enabled |
| `ATLAS_LLM_MODEL` | optional | provider model | approved model | No | If provider enabled |
| `ATLAS_LLM_BASE_URL` | optional | optional | optional | No | Provider dependent |
| `ATLAS_REQUIRE_LLM` | `false` | normally `false` | policy decision | No | Yes |
| `ATLAS_DEPENDENCY_TIMEOUT_MS` | 2500 | 2500 | 2500 | No | No |

## Rules

- LLM credentials never appear in `index.html`, client JS, telemetry or Saved Views.
- Vercel Preview/Lab and Production/Stable variables are audited separately.
- Stable must not inherit an experimental Lab LLM key by accident.
- Browser auth uses Secure HttpOnly cookies issued by the Atlas API; browser code never stores Supabase session tokens in localStorage.
- Client evidence remains in private Supabase Storage buckets protected by workspace RLS.
