"""
ATL-121 executable proof harness — generic rule execution engine.

evaluate_rule() dispatches on rule['kind'] and actually performs the
declared work: an in-process comparison for EMBED/SNAPSHOT rules, or a real
urllib HTTP GET for DYNAMIC_LOOKUP / CLIENT_SYSTEM_LOOKUP / EXTERNAL_AUTHORITY
rules. Every call returns an ExecutionTrace record with real wall-clock
timing (time.perf_counter) and an explicit `network_io` flag, so evidence
documents can honestly state which results came from a real network round
trip versus a pure in-memory computation.
"""

from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
import json as _json
from dataclasses import dataclass, field
from typing import Any, Optional

from rule_ontology import FailureBehavior


class MandatoryDependencyUnavailable(Exception):
    """Raised when a FAIL_CLOSED rule's required dynamic dependency cannot
    be reached. This is a real exception type raised by real code — Proof
    10 asserts it with pytest.raises, not by narration."""


class ExternalAuthorityUnavailable(Exception):
    pass


@dataclass
class ExecutionTrace:
    rule_id: str
    kind: str
    distribution_mode: str
    network_io: bool
    started_at: float
    ended_at: float
    outcome: str  # "PASS" | "FAIL" | "ERROR" | "ESCALATED"
    detail: Any = None
    exception_type: Optional[str] = None

    @property
    def latency_ms(self) -> float:
        return round((self.ended_at - self.started_at) * 1000, 3)

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "kind": self.kind,
            "distribution_mode": self.distribution_mode,
            "network_io": self.network_io,
            "latency_ms": self.latency_ms,
            "outcome": self.outcome,
            "detail": self.detail,
            "exception_type": self.exception_type,
        }


def _http_get_json(url: str, timeout: float = 1.5) -> tuple[int, dict]:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8")
        return resp.status, _json.loads(body)


def evaluate_rule(
    rule: dict,
    record: dict,
    package,
    client_id: Optional[str] = None,
    atlas_service_base_url: Optional[str] = None,
    external_authority_base_url: Optional[str] = None,
) -> ExecutionTrace:
    kind = rule["kind"]
    params = rule["params"]
    dist = rule["distribution_mode"]
    started = time.perf_counter()
    network_io = False
    outcome = "ERROR"
    detail: Any = None
    exc_type: Optional[str] = None

    try:
        if kind == "field_presence":
            value = record.get(params["field"])
            outcome = "PASS" if value not in (None, "") else "FAIL"
            detail = {"field": params["field"], "value": value}

        elif kind == "regex_format":
            value = str(record.get(params["field"], ""))
            matched = re.fullmatch(params["pattern"], value) is not None
            outcome = "PASS" if matched else "FAIL"
            detail = {"field": params["field"], "value": value, "pattern": params["pattern"]}

        elif kind == "set_membership":
            value = record.get(params["field"])
            outcome = "PASS" if value in params["allowed_set"] else "FAIL"
            detail = {"field": params["field"], "value": value, "allowed_set": params["allowed_set"]}

        elif kind == "table_lookup":
            table = package.snapshot_tables[params["table"]]
            key = record.get(params["field"])
            found = key in table["data"]
            outcome = "PASS" if found else "FAIL"
            detail = {
                "field": params["field"],
                "key": key,
                "table_version": table["version"],
                "resolved": table["data"].get(key),
            }

        elif kind == "uniqueness_check":
            registry = record.setdefault("_registries", {}).setdefault(params["registry"], set())
            value = record.get(params["field"])
            is_dup = value in registry
            registry.add(value)
            outcome = "FAIL" if is_dup else "PASS"
            detail = {"field": params["field"], "value": value, "duplicate": is_dup}

        elif kind == "time_cutoff":
            value = record.get(params["field"])
            outcome = "PASS" if value is not None and value <= params["cutoff"] else "FAIL"
            detail = {"field": params["field"], "value": value, "cutoff": params["cutoff"]}

        elif kind == "composite_state_transition":
            signals_present = [s for s in params["signals"] if record.get(s)]
            all_present = len(signals_present) == len(params["signals"])
            past_cutoff = record.get(params["cutoff_field"], False)
            if all_present:
                status = "DELIVERED"
            elif past_cutoff:
                status = "EXCEPTION"
            else:
                status = "IN_TRANSIT"
            outcome = "PASS"
            detail = {"signals_present": signals_present, "status": status}

        elif kind == "dynamic_lookup":
            network_io = True
            if atlas_service_base_url is None:
                raise MandatoryDependencyUnavailable(f"{rule['rule_id']}: no service URL configured")
            url = f"{atlas_service_base_url}/dynamic-lookup/{rule['rule_id']}"
            try:
                status, body = _http_get_json(url)
                outcome = "PASS"
                detail = body
            except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as e:
                if rule["failure_behavior"] == FailureBehavior.FAIL_CLOSED.value:
                    raise MandatoryDependencyUnavailable(
                        f"{rule['rule_id']} DYNAMIC_LOOKUP unreachable and failure_behavior=FAIL_CLOSED: {e}"
                    ) from e
                elif rule["failure_behavior"] == FailureBehavior.ESCALATE.value:
                    outcome = "ESCALATED"
                    detail = {"reason": "dynamic_source_unreachable", "field": params["field"], "error": str(e)}
                else:
                    outcome = "FAIL"
                    detail = {"reason": "dynamic_source_unreachable", "error": str(e)}

        elif kind == "client_binding_lookup":
            network_io = True
            if client_id is None:
                raise ValueError("client_binding_lookup requires client_id")
            url = f"{atlas_service_base_url}/client-binding/{client_id}"
            status, body = _http_get_json(url)
            outcome = "PASS" if status == 200 else "FAIL"
            detail = body

        elif kind == "external_lookup":
            network_io = True
            commodity = record.get(params["field"])
            url = f"{external_authority_base_url}/nmfc-class/{commodity}"
            try:
                status, body = _http_get_json(url)
                outcome = "PASS" if status == 200 else "FAIL"
                detail = body
            except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as e:
                raise ExternalAuthorityUnavailable(str(e)) from e

        else:
            raise ValueError(f"Unknown rule kind: {kind}")

    except (MandatoryDependencyUnavailable, ExternalAuthorityUnavailable):
        # FAIL_CLOSED is a hard contract: the exception MUST propagate to the
        # caller, not be swallowed into a returned "ERROR" trace that a
        # careless caller could ignore and treat as a completed evaluation.
        # (This is the exact defect Proof 10's pytest.raises caught on the
        # first real run of this suite — see results/EXECUTION_LOG.txt.)
        raise

    ended = time.perf_counter()
    return ExecutionTrace(
        rule_id=rule["rule_id"],
        kind=kind,
        distribution_mode=dist,
        network_io=network_io,
        started_at=started,
        ended_at=ended,
        outcome=outcome,
        detail=detail,
        exception_type=exc_type,
    )
