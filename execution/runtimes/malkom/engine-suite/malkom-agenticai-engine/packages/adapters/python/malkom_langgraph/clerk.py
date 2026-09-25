"""The sandbox clerk — the LangGraph adapter's stand-in model.

A LangGraph agent must be able to run on a machine with no AI key: a draft
still runs on sample cases, end to end, over the real runner, gateway, pass
and event log. This deterministic clerk is that stand-in, and it is a direct
port of the TypeScript sandbox clerk so the two adapters read the same case
the same way and reach the same one of four endings.

It is a stand-in for a model, not for the engine — everything around it is the
production path. With a real provider configured (see agent.py), the same
graph runs against a real LangChain chat model with nothing else changed.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any


def _text_of(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _required_from(output: list[dict[str, Any]]) -> list[tuple[str, float]]:
    """The fields the goal requires, as (field, confidence floor)."""
    required: list[tuple[str, float]] = []
    for out in output:
        field = out.get("field")
        floor = out.get("minConfidence")
        if isinstance(field, str) and isinstance(floor, (int, float)):
            required.append((field, float(floor)))
    return required


def _extract(text: str, required: list[tuple[str, float]]) -> tuple[dict[str, Any], dict[str, float]]:
    """The clerk's reading: 'field: value' settles a field; a reference-code
    pattern settles fields whose names say they hold one."""
    fields: dict[str, Any] = {}
    confidence: dict[str, float] = {}
    for field, _floor in required:
        labelled = re.search(rf"{re.escape(field)}\s*[:=]\s*([^\n,;]+)", text, re.IGNORECASE)
        if labelled is not None:
            raw = labelled.group(1).strip()
            if raw != "" and re.fullmatch(r"\d+(\.\d+)?", raw):
                fields[field] = float(raw) if "." in raw else int(raw)
            else:
                fields[field] = raw
            confidence[field] = 0.98
            continue
        if re.search(r"ref|number", field, re.IGNORECASE):
            code = re.search(r"\b([A-Z]{2,4}-?\d{3,7})\b", text)
            if code is not None:
                fields[field] = code.group(1)
                confidence[field] = 0.9
    return fields, confidence


def decide(
    output: list[dict[str, Any]],
    case: dict[str, Any],
    tool_names: list[str],
) -> list[dict[str, Any]]:
    """Return the clerk's moves: zero or more tool calls, then exactly one end.

    Each move is either {"tool": name, "input": {...}} or {"end": {...}}.
    A direct port of the TypeScript clerk's decide()."""
    required = _required_from(output)
    fields = case.get("fields", {}) or {}
    confidence = case.get("confidence", {}) or {}
    notes = case.get("notes", []) or []

    text = "\n".join(part for part in (_text_of(v) for v in fields.values()) if part != "")
    has = lambda tool: tool in tool_names  # noqa: E731
    woken = any(str(n.get("note", "")).startswith("The case woke:") for n in notes)
    moves: list[dict[str, Any]] = []

    if has("read-case"):
        moves.append({"tool": "read-case", "input": {}})

    if re.search(r"cannot be read|no text layer|scanned image|illegible", text, re.IGNORECASE):
        pf, pc = _extract(text, required)
        moves.append(
            {
                "end": {
                    "ending": "handover",
                    "whyStopped": "The attached document cannot be read, and inventing its contents would be worse than stopping.",
                    "fields": pf,
                    "confidence": pc,
                    "tried": ["Read the message", "Looked for a text layer in the attachment"],
                    "notes": ["Ask the sender to resend the document as text or a readable PDF."],
                }
            }
        )
        return moves

    if not woken and re.search(r"will follow|to follow shortly|awaiting documents", text, re.IGNORECASE):
        soon = re.search(r"shortly|within the hour|in a moment", text, re.IGNORECASE) is not None
        wake_date = datetime.now(timezone.utc) + timedelta(seconds=15 if soon else 86_400)
        moves.append(
            {
                "end": {
                    "ending": "parked",
                    "because": "The message says the documents are still on their way.",
                    "wakeOn": "date",
                    "wakeDate": wake_date.isoformat(),
                    "tried": ["Read the message"],
                    "notes": ["Parked until the promised documents arrive."],
                }
            }
        )
        return moves

    read_fields, read_confidence = _extract(text, required)
    merged = {**read_fields, **fields}
    merged_confidence = {**read_confidence, **confidence}
    person_answered = any((confidence.get(f, 0) or 0) >= 0.999 for f, _ in required)

    asked = re.search(r"([^.?!]*\bor\b[^.?!]*)\?", text)
    if asked is not None and not person_answered:
        clause = asked.group(1).strip()
        sentence = (clause[:1].upper() + clause[1:] + "?")[:200]
        halves = [h.strip() for h in re.split(r",?\s+or\s+", clause, flags=re.IGNORECASE) if h.strip() != ""]
        choices = halves[:5] if len(halves) >= 2 else ["Yes", "No"]
        fills = next(
            (f for f, floor in required if (merged_confidence.get(f, 0) or 0) < floor),
            required[0][0] if required else "answer",
        )
        moves.append(
            {
                "end": {
                    "ending": "question",
                    "sentence": sentence,
                    "choices": [re.sub(r"^do (?:you|we) want\s+", "", c, flags=re.IGNORECASE)[:120] for c in choices],
                    "fills": fills,
                    "fields": read_fields,
                    "confidence": read_confidence,
                    "tried": ["Read the message", "Worked out every field the message settles"],
                    "notes": ["One answer completes this case."],
                }
            }
        )
        return moves

    answered: dict[str, Any] = {}
    answered_confidence: dict[str, float] = {}
    missing: list[str] = []
    for field, floor in required:
        value = merged.get(field)
        sure = merged_confidence.get(field, 0) or 0
        if value not in (None, "") and sure >= floor:
            answered[field] = value
            answered_confidence[field] = sure
        else:
            missing.append(field)

    if missing:
        moves.append(
            {
                "end": {
                    "ending": "handover",
                    "whyStopped": f"The message does not settle {', '.join(missing)}, and guessing would cost a person more than asking.",
                    "fields": answered,
                    "confidence": answered_confidence,
                    "tried": ["Read the message", "Worked out every field the message settles"],
                    "notes": [f"Still needed: {', '.join(missing)}."],
                }
            }
        )
        return moves

    if has("write-fields"):
        moves.append({"tool": "write-fields", "input": {"fields": answered, "confidence": answered_confidence}})
    if has("check-validation"):
        moves.append({"tool": "check-validation", "input": {"fields": answered}})
    moves.append(
        {
            "end": {
                "ending": "done",
                "fields": answered,
                "confidence": answered_confidence,
                "tried": ["Read the message", "Worked out the fields", "Checked them"],
                "notes": [],
            }
        }
    )
    return moves
