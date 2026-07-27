"""Backend tests for calendar-based scheduled auto-publishing (Takvim)."""
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://studio-publish.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@egitim.today"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def _get_schedule(client):
    r = client.get(f"{BASE_URL}/api/schedule")
    assert r.status_code == 200, r.text
    return r.json()


# ---- 1. GET /api/schedule structure ----
def test_get_schedule_shape(client):
    d = _get_schedule(client)
    assert "unscheduled" in d and "timeline" in d
    assert isinstance(d["unscheduled"], list) and isinstance(d["timeline"], list)
    # every unscheduled item is approved, unpublished, no scheduled_at, on social platform
    for a in d["unscheduled"]:
        assert a["status"] == "approved"
        assert not a.get("published")
        assert a.get("scheduled_at") in (None, "")
        assert a["platform"] in ("Twitter/X", "LinkedIn")
        assert a.get("article_title") is not None


# ---- 2. Schedule LinkedIn atom in the FUTURE then unschedule (do NOT let LinkedIn fall in past) ----
def test_schedule_future_and_unschedule_linkedin(client):
    d = _get_schedule(client)
    li = next((a for a in d["unscheduled"] if a["platform"] == "LinkedIn"), None)
    if not li:
        pytest.skip("No unscheduled LinkedIn atom available")
    future = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r = client.post(f"{BASE_URL}/api/atoms/{li['id']}/schedule", json={"scheduled_at": future})
    assert r.status_code == 200, r.text
    # Should now appear in timeline
    d2 = _get_schedule(client)
    assert any(a["id"] == li["id"] for a in d2["timeline"])
    # Unschedule cleanup
    r = client.post(f"{BASE_URL}/api/atoms/{li['id']}/unschedule")
    assert r.status_code == 200
    d3 = _get_schedule(client)
    assert not any(a["id"] == li["id"] and a.get("scheduled_at") for a in d3["timeline"])


# ---- 3. Reject scheduling of non-approved / non-social ----
def test_schedule_rejects_non_approved(client):
    # Find any draft atom (not approved)
    r = client.get(f"{BASE_URL}/api/articles")
    for art in r.json():
        atoms = client.get(f"{BASE_URL}/api/articles/{art['id']}/atoms").json()
        draft = next((a for a in atoms if a["status"] == "draft"), None)
        if draft:
            future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
            resp = client.post(f"{BASE_URL}/api/atoms/{draft['id']}/schedule", json={"scheduled_at": future})
            assert resp.status_code == 400
            return
    pytest.skip("No draft atom available")


# ---- 4. Scheduler + retry: schedule Twitter/X atom in the PAST, expect worker to attempt & fail with 402 ----
@pytest.mark.timeout(200)
def test_scheduler_retry_dlq_twitter(client):
    d = _get_schedule(client)
    tw = next((a for a in d["unscheduled"] if a["platform"] == "Twitter/X"), None)
    if not tw:
        pytest.skip("No unscheduled Twitter/X atom available")
    aid = tw["id"]
    # schedule 1 minute in the past
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    r = client.post(f"{BASE_URL}/api/atoms/{aid}/schedule", json={"scheduled_at": past})
    assert r.status_code == 200, r.text

    attempts = 0
    last_error = None
    # Worker runs every 1 minute; wait up to ~140s for at least one attempt
    deadline = time.time() + 150
    while time.time() < deadline:
        time.sleep(15)
        got = client.get(f"{BASE_URL}/api/atoms/{aid}").json()
        attempts = got.get("publish_attempts", 0) or 0
        last_error = got.get("last_error")
        if attempts >= 1:
            break

    try:
        assert attempts >= 1, f"Publisher did not run within 150s (attempts={attempts})"
        assert last_error and ("402" in last_error or "credits" in last_error.lower() or "X API" in last_error), \
            f"Unexpected last_error: {last_error!r}"
    finally:
        # Cleanup: always unschedule to avoid future retries in past
        client.post(f"{BASE_URL}/api/atoms/{aid}/unschedule")


# ---- 5. Auto distribute ----
def test_auto_distribute(client):
    before = _get_schedule(client)
    unscheduled_count = len(before["unscheduled"])
    r = client.post(f"{BASE_URL}/api/schedule/auto")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "scheduled" in body
    assert body["scheduled"] == unscheduled_count

    after = _get_schedule(client)
    # all previously unscheduled now in timeline (with future scheduled_at)
    prev_ids = {a["id"] for a in before["unscheduled"]}
    tl_ids = {a["id"] for a in after["timeline"]}
    assert prev_ids.issubset(tl_ids)
    now = datetime.now(timezone.utc)
    for a in after["timeline"]:
        if a["id"] in prev_ids:
            dt = datetime.fromisoformat(a["scheduled_at"].replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            assert dt > now, f"auto-distributed slot is not in the future: {a['scheduled_at']}"

    # CLEANUP: unschedule all newly-scheduled atoms (critical: LinkedIn atoms must not stay scheduled)
    for aid in prev_ids:
        client.post(f"{BASE_URL}/api/atoms/{aid}/unschedule")
