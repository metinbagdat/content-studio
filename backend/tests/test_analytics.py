"""Backend tests for /api/analytics and reschedule (drag-drop backend behavior)."""
import os
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


def test_analytics_shape(client):
    r = client.get(f"{BASE_URL}/api/analytics")
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("published_total", "scheduled_total", "failed_total",
              "by_platform", "by_type", "by_hour", "dlq", "feedback"):
        assert k in d, f"missing key {k}"
    assert isinstance(d["published_total"], int)
    assert isinstance(d["scheduled_total"], int)
    assert isinstance(d["failed_total"], int)
    assert isinstance(d["by_platform"], dict)
    assert isinstance(d["by_type"], dict)
    assert isinstance(d["by_hour"], dict)
    assert len(d["by_hour"]) == 24
    for k in d["by_hour"]:
        assert 0 <= int(k) <= 23
    assert isinstance(d["dlq"], list)
    assert isinstance(d["feedback"], list)
    # dlq items must expose id / platform / label / last_error
    for item in d["dlq"]:
        assert {"id", "platform", "label", "last_error"}.issubset(item.keys())


def test_analytics_unauthorized():
    r = requests.get(f"{BASE_URL}/api/analytics", timeout=10)
    assert r.status_code in (401, 403)


def test_reschedule_moves_atom_to_new_day(client):
    """Simulates the drag-drop backend behavior: POST /atoms/<id>/schedule with a new date
    moves an atom into the corresponding day bucket in /api/schedule."""
    sched = client.get(f"{BASE_URL}/api/schedule").json()
    pending = [a for a in sched["timeline"] if not a.get("published") and a.get("scheduled_at")]
    if not pending:
        pytest.skip("No pending scheduled atom to reschedule")
    atom = pending[0]
    aid = atom["id"]
    orig = datetime.fromisoformat(atom["scheduled_at"].replace("Z", "+00:00"))
    if orig.tzinfo is None:
        orig = orig.replace(tzinfo=timezone.utc)

    # Target: keep same time-of-day, move by +2 days (well within 14-day grid)
    new_dt = (orig + timedelta(days=2))
    r = client.post(f"{BASE_URL}/api/atoms/{aid}/schedule",
                    json={"scheduled_at": new_dt.isoformat()})
    assert r.status_code == 200, r.text

    after = client.get(f"{BASE_URL}/api/schedule").json()
    moved = next((a for a in after["timeline"] if a["id"] == aid), None)
    assert moved is not None, "Rescheduled atom missing from timeline"
    got = datetime.fromisoformat(moved["scheduled_at"].replace("Z", "+00:00"))
    if got.tzinfo is None:
        got = got.replace(tzinfo=timezone.utc)
    # Must be on the target day (allow small clock skew)
    assert got.date() == new_dt.date(), f"Expected day {new_dt.date()}, got {got.date()}"
    # Time-of-day preserved (hour+minute)
    assert got.hour == orig.hour and got.minute == orig.minute

    # Cleanup: restore original scheduled_at
    client.post(f"{BASE_URL}/api/atoms/{aid}/schedule",
                json={"scheduled_at": orig.isoformat()})
