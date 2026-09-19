#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import tempfile
from pathlib import Path

try:
    import yaml
except Exception as exc:  # pragma: no cover - operator prerequisite
    raise SystemExit(f"PyYAML is required: {exc}")

PREPARED_BY = "chatgpt-preparer-ep0001-20260919"
EXPECTED_ROUTE_KEY = "SERIAL:EP-0001"
EXPECTED_EP_ID = "EP-0001"
EXPECTED_EP_PATH = "agents/relay/execution-packages/EP-0001.yaml"


def load_mapping(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path}: expected mapping")
    return data


def atomic_write_text(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except FileNotFoundError:
            pass
        raise


def dump_json_yaml_atomic(path: Path, value: dict) -> None:
    atomic_write_text(path, json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def load_common_validators(common_root: Path):
    scripts = common_root / "skills/engineering-pr-delivery-v2.5/scripts"
    require(scripts.is_dir(), f"Common V2.5 scripts directory does not exist: {scripts}")
    sys.path.insert(0, str(scripts))
    disc_mod = importlib.import_module("validate_discovery_receipt")
    tc_mod = importlib.import_module("validate_takeover_certification")
    return disc_mod.validate_file, tc_mod.validate_file


def format_errors(label: str, errors: list[str], warnings: list[str]) -> str:
    parts = [f"{label} rejected by Common validator:"]
    parts.extend(f"FAIL: {item}" for item in errors)
    parts.extend(f"WARN: {item}" for item in warnings)
    return "\n".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Assemble a deterministic TC/admission record for EP-0001 "
            "after a repository/provider-grounded candidate has produced a PASS DISC receipt. Canonical Common "
            "validators are invoked before repository admission is mutated."
        )
    )
    ap.add_argument("repo_root", nargs="?", default=".")
    ap.add_argument("--common-root", required=True)
    ap.add_argument("--candidate-id", required=True)
    ap.add_argument("--disc-path", required=True)
    ap.add_argument("--tc-id", default="TC-0001")
    args = ap.parse_args()

    root = Path(args.repo_root).resolve()
    common_root = Path(args.common_root).resolve()
    candidate = args.candidate_id.strip()
    require(candidate, "candidate id must be non-empty")
    require(args.tc_id.startswith("TC-"), "tc id must use TC-* namespace")

    validate_discovery_file, validate_takeover_file = load_common_validators(common_root)

    state_path = root / "agents/relay/REPO_STATE.yaml"
    state = load_mapping(state_path)
    active_ep = state.get("active_ep") or {}
    require(state.get("relay_state") == "ACTIVE", "REPO_STATE must be ACTIVE")
    require((state.get("execution_policy") or {}).get("mode") == "SERIAL", "EP-0001 helper requires SERIAL execution")
    require(active_ep.get("id") == EXPECTED_EP_ID, "active EP must be EP-0001")
    require(active_ep.get("path") == EXPECTED_EP_PATH, "active EP path mismatch")
    require((state.get("status_planes") or {}).get("execution", {}).get("material_authority") == "WRITE", "material_authority must be WRITE prerequisite")
    require((state.get("status_planes") or {}).get("execution", {}).get("can_continue") is True, "execution.can_continue must be true")
    require((state.get("status_planes") or {}).get("stop", {}).get("active") is False, "hard stop is active")

    ep = load_mapping(root / EXPECTED_EP_PATH)
    require((ep.get("identity") or {}).get("ep_id") == EXPECTED_EP_ID, "EP identity mismatch")
    require(not bool((ep.get("qualification_boundary") or {}).get("required")), "EP-0001 helper refuses qualification-required routes")

    disc_path = (root / args.disc_path).resolve()
    require(root == disc_path or root in disc_path.parents, "DISC path must remain inside repository")
    require(disc_path.exists(), f"DISC path does not exist: {args.disc_path}")
    disc = load_mapping(disc_path)
    require(disc.get("schema_version") == "relay-v2.5-discovery", "DISC schema mismatch")
    require(str(disc.get("id") or "").startswith("DISC-"), "DISC id must use DISC-* namespace")
    require((disc.get("candidate") or {}).get("agent_instance_id") == candidate, "DISC candidate mismatch")
    require(disc.get("result") == "PASS", "DISC result must be PASS")
    require(disc.get("conversation_context_used") is False, "DISC must record conversation_context_used: false")

    route = disc.get("route") or {}
    require(route.get("route_key") == EXPECTED_ROUTE_KEY, "DISC route must be SERIAL:EP-0001")
    require(route.get("mode") == "SERIAL", "DISC route mode must be SERIAL")
    require(route.get("execution_ref") == EXPECTED_EP_ID, "DISC execution_ref mismatch")
    require(route.get("ep_id") == EXPECTED_EP_ID, "DISC ep_id mismatch")
    require(route.get("ep_path") == EXPECTED_EP_PATH, "DISC ep_path mismatch")
    require(route.get("plan_id") is None and route.get("plan_path") is None and route.get("lane_id") is None, "serial DISC must not carry parallel route fields")

    # Canonical Common validation happens before any TC/admission mutation.
    disc_errors, disc_warnings = validate_discovery_file(root, disc_path, state, None, candidate)
    require(not disc_errors, format_errors("DISC", disc_errors, disc_warnings))

    admissions = state.get("takeover_admissions") or []
    require(isinstance(admissions, list), "REPO_STATE.takeover_admissions must be a list")
    conflicting = [a for a in admissions if isinstance(a, dict) and a.get("route_key") == EXPECTED_ROUTE_KEY]
    require(not conflicting, "EP-0001 already has a takeover admission; reconcile it instead of overwriting")

    rel_disc = disc_path.relative_to(root).as_posix()
    tc_path_rel = f"agents/relay/certifications/takeover/{args.tc_id}.yaml"
    tc_path = root / tc_path_rel
    require(not tc_path.exists(), f"TC path already exists: {tc_path_rel}")

    tc = {
        "schema_version": "relay-v2.5-takeover-certification",
        "id": args.tc_id,
        "candidate": {"agent_instance_id": candidate},
        "prepared_by": {"agent_instance_id": candidate},
        "evaluated_by": {
            "type": "DETERMINISTIC_VALIDATOR",
            "identity": "validate_takeover_certification.py",
            "basis": [
                "Candidate-authored TC record; Common deterministic validator reopens current route, EP, DISC and basis. Document authorship is not certification authority."
            ],
        },
        "self_certification": {"allowed": False},
        "route": {
            "route_key": EXPECTED_ROUTE_KEY,
            "mode": "SERIAL",
            "execution_ref": EXPECTED_EP_ID,
            "ep_id": EXPECTED_EP_ID,
            "ep_path": EXPECTED_EP_PATH,
            "plan_id": None,
            "plan_path": None,
            "lane_id": None,
        },
        "basis": disc.get("basis"),
        "discovery_receipt": {"id": disc.get("id"), "path": rel_disc},
        "qualification": {
            "required": False,
            "status": "NOT_REQUIRED",
            "receipt_id": None,
            "receipt_path": None,
            "receipt_digest": None,
        },
        "checks": {
            "baton_semantics": "PASS",
            "repository_discovery": "PASS",
            "route_grounding": "PASS",
            "input_oracle_readiness": "PASS",
            "scope_understood": "PASS",
            "report_successor_contract": "PASS",
        },
        "result": "PASS",
        "conversation_context_used": False,
    }

    # Write the candidate TC first, validate it against current repository truth,
    # and only then mutate REPO_STATE.takeover_admissions.
    dump_json_yaml_atomic(tc_path, tc)
    tc_errors, tc_warnings = validate_takeover_file(root, tc_path, state, None, candidate)
    if tc_errors:
        tc_path.unlink(missing_ok=True)
        raise ValueError(format_errors("TC", tc_errors, tc_warnings))

    admission = {
        "route_key": EXPECTED_ROUTE_KEY,
        "candidate": {"agent_instance_id": candidate},
        "discovery_receipt": {"id": disc.get("id"), "path": rel_disc},
        "certification": {"id": args.tc_id, "path": tc_path_rel},
    }
    state["takeover_admissions"] = admissions + [admission]
    dump_json_yaml_atomic(state_path, state)

    print(json.dumps({
        "assembled": True,
        "prepared_by": PREPARED_BY,
        "candidate": candidate,
        "route_key": EXPECTED_ROUTE_KEY,
        "discovery_receipt": rel_disc,
        "takeover_certification": tc_path_rel,
        "common_root": str(common_root),
        "pre_admission_discovery_validation": "PASS",
        "pre_admission_takeover_validation": "PASS",
        "authority": "NOT_YET_MATERIAL_WRITE_READY_RUN_COMMON_AGGREGATE_VALIDATOR_AND_RUNTIME_GATE",
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
