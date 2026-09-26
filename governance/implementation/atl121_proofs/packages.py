"""
ATL-121 executable proof harness — execution package builder.

An ExecutionPackage is the version-closed artifact that EMBEDs rule logic
and SNAPSHOTs reference tables at build time, and DECLARES (without baking
in a value) any DYNAMIC_LOOKUP / EXTERNAL_AUTHORITY / CLIENT_SYSTEM_LOOKUP
rules by reference only. Hashing uses real hashlib.sha256 over canonical
JSON bytes — the hash recorded in evidence docs is independently
recomputable with `sha256sum` on the emitted file, not a claimed/asserted
value.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from rule_ontology import DistributionMode, RuleDecl


def _canonical_bytes(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass
class ExecutionPackage:
    package_id: str
    version: str
    built_at: str
    embedded_rules: list  # list[dict] — full rule declarations for EMBED-mode rules
    snapshot_rules: list  # list[dict] — rule declarations for SNAPSHOT-mode rules
    snapshot_tables: dict  # table_name -> {"version": str, "data": dict}
    declared_dynamic_rules: list  # list[dict] — rule declarations only (no value) for DYNAMIC_LOOKUP/EXTERNAL_AUTHORITY/CLIENT_SYSTEM_LOOKUP
    consumer_scope: str
    source_evidence_ref: str
    canonical_promotion_status: str = "PENDING"
    package_hash: Optional[str] = None

    def to_dict(self) -> dict:
        d = {
            "package_id": self.package_id,
            "version": self.version,
            "built_at": self.built_at,
            "embedded_rules": self.embedded_rules,
            "snapshot_rules": self.snapshot_rules,
            "snapshot_tables": self.snapshot_tables,
            "declared_dynamic_rules": self.declared_dynamic_rules,
            "consumer_scope": self.consumer_scope,
            "source_evidence_ref": self.source_evidence_ref,
            "canonical_promotion_status": self.canonical_promotion_status,
        }
        return d

    def compute_hash(self) -> str:
        payload = self.to_dict()
        payload.pop("package_hash", None)
        return sha256_hex(_canonical_bytes(payload))

    def rule_by_id(self, rule_id: str) -> Optional[dict]:
        for bucket in (self.embedded_rules, self.snapshot_rules, self.declared_dynamic_rules):
            for r in bucket:
                if r["rule_id"] == rule_id:
                    return r
        return None


def build_package(
    package_id: str,
    version: str,
    rules: list[RuleDecl],
    snapshot_tables: dict,
    consumer_scope: str,
    source_evidence_ref: str,
    canonical_promotion_status: str = "PENDING",
) -> ExecutionPackage:
    embedded = [r.to_dict() for r in rules if r.distribution_mode == DistributionMode.EMBED]
    snapshot = [r.to_dict() for r in rules if r.distribution_mode == DistributionMode.SNAPSHOT]
    dynamic = [
        r.to_dict()
        for r in rules
        if r.distribution_mode
        in (
            DistributionMode.DYNAMIC_LOOKUP,
            DistributionMode.EXTERNAL_AUTHORITY,
            DistributionMode.CLIENT_SYSTEM_LOOKUP,
        )
    ]
    pkg = ExecutionPackage(
        package_id=package_id,
        version=version,
        built_at=datetime.now(timezone.utc).isoformat(),
        embedded_rules=embedded,
        snapshot_rules=snapshot,
        snapshot_tables=snapshot_tables,
        declared_dynamic_rules=dynamic,
        consumer_scope=consumer_scope,
        source_evidence_ref=source_evidence_ref,
        canonical_promotion_status=canonical_promotion_status,
    )
    pkg.package_hash = pkg.compute_hash()
    return pkg


def write_package(pkg: ExecutionPackage, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{pkg.package_id}.{pkg.version}.json")
    payload = pkg.to_dict()
    payload["package_hash"] = pkg.package_hash
    with open(path, "w") as f:
        json.dump(payload, f, sort_keys=True, indent=2)
    return path


def load_package(path: str) -> ExecutionPackage:
    with open(path) as f:
        payload = json.load(f)
    recorded_hash = payload.pop("package_hash", None)
    pkg = ExecutionPackage(**payload)
    recomputed = pkg.compute_hash()
    if recomputed != recorded_hash:
        raise ValueError(
            f"Package hash mismatch for {path}: recorded={recorded_hash} recomputed={recomputed}"
        )
    pkg.package_hash = recomputed
    return pkg
