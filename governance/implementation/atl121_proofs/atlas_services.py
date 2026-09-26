"""
ATL-121 executable proof harness — real local HTTP services.

These are genuine `http.server.HTTPServer` instances bound to 127.0.0.1 on
an ephemeral port, run in a background thread within the test process, and
actually called over real TCP/HTTP by runtime_executor.py (urllib, not a
stub function call). This is what makes DYNAMIC_LOOKUP / CLIENT_SYSTEM_LOOKUP
/ EXTERNAL_AUTHORITY proofs genuine network round trips rather than narrated
assertions.

Honesty labeling (required by ChatGPT QA finding #4 — "mark mocks/
simulations explicitly; do not present authored examples as observed
external/runtime calls"):

  - AtlasRuleService represents Atlas's own governed rule/knowledge API.
    It is real (a real server, real HTTP), but it is a same-process stand-in
    for what would be a networked Atlas backend/Supabase-backed endpoint in
    production. It is labeled ATLAS_INTERNAL_SERVICE, not external.

  - MockExternalAuthorityService explicitly represents a THIRD PARTY
    (e.g. NMFTA). This sandboxed environment has no authorized outbound
    network path to a real external regulatory API (network egress here is
    allowlisted to package registries only), so this is a local mock. Every
    response it returns carries "source": "MOCK_EXTERNAL_AUTHORITY" so no
    downstream evidence document can misrepresent it as an observed real
    external call.
"""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse


class _ServiceBase(BaseHTTPRequestHandler):
    routes: dict = {}

    def log_message(self, fmt, *args):  # silence default stderr access logging
        pass

    def do_GET(self):  # noqa: N802 (http.server API name)
        parsed = urlparse(self.path)
        handler = self.routes.get(parsed.path.split("?")[0])
        if handler is None:
            # also try prefix match for path-parameterized routes
            for prefix, fn in self.routes.items():
                if parsed.path.startswith(prefix):
                    handler = fn
                    break
        if handler is None:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"{}")
            return
        status, body = handler(parsed.path)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))


class BackgroundHTTPService:
    """Wraps HTTPServer + serve_forever in a daemon thread with real
    start/stop lifecycle, so Outage Resilience / Fail-Closed proofs can
    genuinely take the service down mid-test and observe real connection
    failures, not a simulated exception."""

    def __init__(self, routes: dict):
        self._routes = routes
        handler_cls = type("Handler", (_ServiceBase,), {"routes": routes})
        self._server = HTTPServer(("127.0.0.1", 0), handler_cls)
        self._thread: threading.Thread | None = None

    @property
    def base_url(self) -> str:
        host, port = self._server.server_address
        return f"http://{host}:{port}"

    def start(self):
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    def stop(self):
        self._server.shutdown()
        self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)


# ---------------------------------------------------------------------------
# Atlas internal rule service (DYNAMIC_LOOKUP + CLIENT_SYSTEM_LOOKUP)
# ---------------------------------------------------------------------------

_STATE = {
    "fuel_surcharge_pct": 18.5,  # mutated in Proof 6 to prove freshness
    "client_bindings": {
        "CLIENT_A": {"accessorial_code": "ACC-LIFTGATE-STD", "bound_to_master_rule": "BOL-R06", "version": "1.0"},
        "CLIENT_B": {"accessorial_code": "ACC-LIFTGATE-PREMIUM-B", "bound_to_master_rule": "BOL-R06", "version": "1.0"},
    },
}


def _dynamic_lookup_handler(path: str):
    return 200, {
        "rule_id": "BOL-R07",
        "field": "fuel_surcharge_pct",
        "value": _STATE["fuel_surcharge_pct"],
        "source": "ATLAS_INTERNAL_SERVICE",
        "version": "live",
    }


def _client_binding_handler(path: str):
    # path like /client-binding/CLIENT_A
    client_id = path.rsplit("/", 1)[-1]
    binding = _STATE["client_bindings"].get(client_id)
    if binding is None:
        return 404, {"error": "unknown_client", "client_id": client_id}
    return 200, {"client_id": client_id, **binding, "source": "ATLAS_INTERNAL_SERVICE"}


def make_atlas_rule_service() -> BackgroundHTTPService:
    return BackgroundHTTPService(
        routes={
            "/dynamic-lookup/BOL-R07": _dynamic_lookup_handler,
            "/client-binding/": _client_binding_handler,
        }
    )


def set_fuel_surcharge(new_value: float) -> None:
    """Simulates an upstream governed rate update (e.g. Owner/ops publishes
    a new fuel surcharge). Used by Proof 6 to prove DYNAMIC_LOOKUP freshness."""
    _STATE["fuel_surcharge_pct"] = new_value


# ---------------------------------------------------------------------------
# Mock external authority (EXTERNAL_AUTHORITY) — explicitly labeled
# ---------------------------------------------------------------------------

_NMFC_TABLE = {
    "LCD_TV_PALLETIZED": {"nmfc_code": "61340", "freight_class": "92.5"},
    "STEEL_COIL": {"nmfc_code": "35480", "freight_class": "50"},
}


def _nmfc_lookup_handler(path: str):
    commodity = path.rsplit("/", 1)[-1]
    entry = _NMFC_TABLE.get(commodity)
    if entry is None:
        return 404, {
            "error": "unknown_commodity",
            "source": "MOCK_EXTERNAL_AUTHORITY",
            "disclosure": "Local mock standing in for NMFTA; sandboxed environment has no "
            "authorized outbound path to the real NMFTA API.",
        }
    return 200, {
        "commodity": commodity,
        **entry,
        "source": "MOCK_EXTERNAL_AUTHORITY",
        "disclosure": "Local mock standing in for NMFTA; sandboxed environment has no "
        "authorized outbound path to the real NMFTA API. This value/format is illustrative, "
        "not an observed real NMFTA response.",
    }


def make_mock_external_authority_service() -> BackgroundHTTPService:
    return BackgroundHTTPService(routes={"/nmfc-class/": _nmfc_lookup_handler})
