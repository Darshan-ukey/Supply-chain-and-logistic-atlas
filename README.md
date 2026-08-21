# Supply Chain & Logistics Process Atlas V6.2.3 + Atlas Intelligence v0.6.5

This is the complete Vercel replacement folder.

## What changed
V6.2.3 is an **additive interpretability/governance release** over the frozen foundation:
- Page 0 V6.2.2 remains byte-for-byte unchanged.
- Road LTL V1.2 remains byte-for-byte unchanged.
- A new **How to Read the Atlas** page/overlay explains the framework, construction methodology, taxonomy, source architecture, hierarchy, ontology, process-flow vocabulary, selectors, provenance classes, runtime/source states, Page-0 walkthrough, Road-LTL walkthrough and client-evidence states.
- `data/atlas-constitution-v6.2.3.json` is the shared governed knowledge pack used by both the guide and Atlas Intelligence.

Atlas Intelligence v0.6.5 adds:
- provenance-first / namespace-aware classification;
- clarification before guessing ambiguous terms;
- explicit runtime-state handling such as `OTHER_LTL_KNOWLEDGE`;
- methodology/how-built/how-to-read knowledge available to chat;
- process provenance and source relationship in the evidence packet;
- Gemini/OpenAI/Anthropic explanation instructions: simple real-world meaning first, governance detail second;
- all prior trace, compare, scenario/client twin, RFP/RFI/SOP intake, research, Supabase, admin and Human Review functionality retained.

## Strict frozen-foundation proof
`/api/integrity` validates the following:
1. frozen Page 0 V6.2.2 hash;
2. frozen integrated V6.2.2 + Road LTL V1.2 hash;
3. public frozen V6.2.2 copy hash;
4. Road LTL model hash;
5. V6.2.3 constitution hash;
6. deployed V6.2.3 file hash;
7. **remove the V6.2.3 additive guide block and the remaining bytes equal the original integrated V6.2.2 file exactly.**

## Vercel
This folder is clean-rooted. `package.json`, `app/`, `public/`, `lib/`, `data/`, `frozen/`, `tests/`, `docs/`, `supabase/` and `vercel.json` belong at the GitHub/Vercel repository root.

Existing Gemini environment variables continue to work:
```text
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEY=<server-side secret>
```

## Validation
Run:
```bash
npm test
npm run build
```

See `docs/V6.2.3_POSTBUILD_AUDIT.md` and `docs/V6.2.3_GUARDRAILS.md`.
