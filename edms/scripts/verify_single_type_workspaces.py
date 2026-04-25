import os
import tempfile
import time

import requests


BASE_URL = os.getenv("EDMS_BASE_URL", "http://127.0.0.1:8002")
TEXT_TYPES = {
    "adrs": "# ADR-SINGLE\n\nThis workspace contains only ADR records.\n",
    "rfcs": "# RFC-SINGLE\n\nThis workspace contains only RFC documents.\n",
    "meeting_notes": "# NOTES-SINGLE\n\nThis workspace contains only meeting notes.\n",
    "postmortems": "# POSTMORTEM-SINGLE\n\nThis workspace contains only postmortem records.\n",
    "tickets": "# TICKET-SINGLE\n\nThis workspace contains only ticket data.\n",
}


def create_admin_session(data_type: str) -> str:
    stamp = f"{data_type}-{int(time.time() * 1000)}"
    payload = {
        "email": f"{stamp}@example.com",
        "password": "secret123",
        "role": "admin",
        "organization_name": f"{data_type}-workspace-{stamp}",
    }
    response = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=20)
    response.raise_for_status()
    return response.json()["access_token"]


def upload_single_type(token: str, data_type: str, content: str) -> dict:
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as handle:
        handle.write(content)
        path = handle.name

    try:
        with open(path, "rb") as uploaded:
            response = requests.post(
                f"{BASE_URL}/admin/upload",
                headers={"Authorization": f"Bearer {token}"},
                data={"data_type": data_type},
                files={"file": (f"{data_type}.md", uploaded, "text/markdown")},
                timeout=60,
            )
        response.raise_for_status()
        return response.json()
    finally:
        os.unlink(path)


def fetch_json(token: str, path: str) -> dict:
    response = requests.get(
        f"{BASE_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()


def assert_single_type_workspace(data_type: str, token: str):
    stats = fetch_json(token, "/stats")
    evidence = fetch_json(token, f"/evidence?data_type={data_type}")
    evidence_all = fetch_json(token, "/evidence")

    assert stats["index_status"] == "ready", stats
    assert stats[data_type] == 1, stats

    for other_type in TEXT_TYPES:
        if other_type != data_type:
            assert stats[other_type] == 0, stats

    assert evidence["items"], evidence
    assert all(item["data_type"] == data_type for item in evidence["items"]), evidence
    assert evidence_all["items"], evidence_all
    assert {item["data_type"] for item in evidence_all["items"]} == {data_type}, evidence_all


def main():
    verified = []

    for data_type, content in TEXT_TYPES.items():
        token = create_admin_session(data_type)
        result = upload_single_type(token, data_type, content)
        assert result["index_status"] == "ready", result
        assert_single_type_workspace(data_type, token)
        verified.append(data_type)

    print({"verified_single_type_workspaces": verified, "base_url": BASE_URL})


if __name__ == "__main__":
    main()
