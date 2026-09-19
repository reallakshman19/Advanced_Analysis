#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
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


def dump_json_yaml_atomic(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
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


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Assemble the outgoing-preparer-owned deterministic TC/admission for EP-0001 "
            "after a zero-context candidate has produced a PASS DISC receipt. This tool does "
            "not validate or authorize takeover; Common validators remain authoritative."
        )
    )
    ap.add_argument("repo_root", nargs="?", default=".")
    ap.add_argument("--candidate-id", required=True)
    ap.add_argument("--disc-path", required=True)
    ap.add_argument("--tc-id", default="TC-0001")
    args = ap.parse_args()

    root = Path(args.repo_root).resolve()
    candidate = args.candidate_id.strip()
    require(candidate, "candidate id must be non-empty")
    require(candidate != PREPARED_BY, "candidate must not equal frozen outgoing preparer identity")
    require(args.tc_id.startswith("TC-"), "tc id must use TC-* namespace")

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
        "prepared_by": {"agent_instance_id": PREPARED_BY},
        "evaluated_by": {
            "type": "DETERMINISTIC_VALIDATOR",
            "identity": "validate_takeover_certification.py",
            "basis": [
                "Frozen outgoing-preparer EP-0001 assembler; Common validator reopens current route, EP, DISC and basis before admitting takeover."
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

    dump_json_yaml_atomic(tc_path, tc)
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
        "authority": "NOT_YET_AUTHORIZED_RUN_COMMON_VALIDATORS_AND_MATERIAL_WRITE_READY",
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
