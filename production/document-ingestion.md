# Session-ephemeral document intelligence

Pilot V1.0 uses a non-persistent source lifecycle:

`file bytes → in-memory extraction → transient structure/map → deterministic Atlas validation → current-session result → discard`

The application does not intentionally persist:
- original upload;
- parsed full text;
- chunks;
- embeddings/vector indexes;
- prompt-injection text;
- unconfirmed candidate facts;
- raw evidence quotes after a user chooses to persist a normalized confirmed fact.

An explicitly confirmed normalized client fact may be persisted to the authenticated client workspace. It remains CLIENT_CONFIRMED and never becomes canonical Atlas knowledge automatically.
