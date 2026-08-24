# Pilot V1.0 architecture

```text
Browser / Operational Canvas
  Explore · Execute · Compare · Transform · Ask Atlas
             |
             v
Vercel same-origin APIs
  retrieval · command validation · ephemeral document structure · exports
             |
     +-------+--------+
     |                |
     v                v
Governed Atlas      Supabase
read-only data      Auth / RLS / work state / collaboration
     |
     v
Optional server-side LLM gateway
Gemini / OpenAI / Anthropic
```

## Authority boundaries

- **LLM:** interpret language, structure messy input, explain retrieved evidence.
- **Atlas engine:** determine what exists, applicability, relationships, sequence and coverage depth.
- **Database/RLS:** determine who can access client work state.
- **Admin governance:** determine whether proposed knowledge can enter the canonical foundation.

The LLM is neither the security boundary nor the canonical process authority.
