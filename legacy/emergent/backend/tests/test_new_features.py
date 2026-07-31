"""Tests for iteration 6: bulk-approve auto-schedule, image versions (watermark/original),
media choice endpoints, platform-based auto-schedule slots."""
import os
import uuid
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@egitim.today"
ADMIN_PASSWORD = "admin123"

TR_UTC_OFFSET = 3
LINKEDIN_LOCAL = [(8, 0), (12, 0), (17, 30)]
TWITTER_LOCAL = [(9, 0), (12, 30), (15, 0), (20, 0)]


def _utc_slots(local_slots):
    return sorted(((h - TR_UTC_OFFSET) % 24, m) for (h, m) in local_slots)


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def article(client):
    """Create a fresh article + analyze -> 50 atoms."""
    marker = uuid.uuid4().hex
    payload = {
        "title": f"TEST_iter6 {marker[:6]}",
        "content": ("Eğitimde yapay zeka kullanımı hızla yaygınlaşıyor. Kişiselleştirilmiş öğrenme, "
                    "adaptif değerlendirme ve zeki öğretim asistanları öne çıkıyor. Öğretmen ve "
                    f"öğrenciler için yeni fırsatlar sunuyor. Test id: {marker}"),
    }
    r = client.post(f"{BASE_URL}/api/articles", json=payload)
    assert r.status_code == 200, r.text
    art = r.json()
    r2 = client.post(f"{BASE_URL}/api/articles/{art['id']}/analyze", timeout=120)
    assert r2.status_code == 200, r2.text
    yield art
    client.delete(f"{BASE_URL}/api/articles/{art['id']}")


# ============ Image atom: watermark + original + version endpoints ============
class TestImageAtomMedia:
    def test_generate_image_atom_stores_both_versions(self, client, article):
        atoms = client.get(f"{BASE_URL}/api/articles/{article['id']}/atoms").json()
        # find an image atom (social_card or thumbnail)
        img_atoms = [a for a in atoms if a["category"] == "image"]
        assert len(img_atoms) > 0
        target = next((a for a in img_atoms if a["type"] == "social_card"), img_atoms[0])
        pytest.image_atom_id = target["id"]
        pytest.image_atom_aspect = target["aspect"]

        r = client.post(f"{BASE_URL}/api/atoms/{target['id']}/generate", timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["media_type"] == "image"
        assert d.get("media_choice") == "watermarked"

    def test_get_media_returns_both_versions(self, client):
        aid = pytest.image_atom_id
        r = client.get(f"{BASE_URL}/api/atoms/{aid}/media")
        assert r.status_code == 200
        d = r.json()
        assert d["media_type"] == "image"
        assert d["media_choice"] == "watermarked"
        assert isinstance(d.get("original"), str) and len(d["original"]) > 100
        assert isinstance(d.get("watermarked"), str) and len(d["watermarked"]) > 100
        # watermarked ≠ original (different pixels)
        assert d["watermarked"] != d["original"]

    def test_select_original_persists(self, client):
        aid = pytest.image_atom_id
        r = client.post(f"{BASE_URL}/api/atoms/{aid}/select-media", json={"choice": "original"})
        assert r.status_code == 200
        assert r.json()["choice"] == "original"
        # Verify persistence
        g = client.get(f"{BASE_URL}/api/atoms/{aid}/media").json()
        assert g["media_choice"] == "original"

    def test_select_watermarked_switches_back(self, client):
        aid = pytest.image_atom_id
        r = client.post(f"{BASE_URL}/api/atoms/{aid}/select-media", json={"choice": "watermarked"})
        assert r.status_code == 200
        g = client.get(f"{BASE_URL}/api/atoms/{aid}/media").json()
        assert g["media_choice"] == "watermarked"

    def test_select_media_404_for_missing_atom(self, client):
        r = client.post(f"{BASE_URL}/api/atoms/nonexistent-id/select-media", json={"choice": "original"})
        assert r.status_code == 404


# ============ Approve auto-schedules Twitter/LinkedIn atoms ============
class TestAutoScheduleOnApprove:
    def test_generate_and_approve_twitter_auto_schedules(self, client, article):
        atoms = client.get(f"{BASE_URL}/api/articles/{article['id']}/atoms").json()
        # Find a Twitter/X or LinkedIn atom that is NOT auto_approve (goes to review)
        # then approve manually to see auto-schedule.
        # short_video_script -> review; but not social platform.
        # Use twitter_post (auto_approve=True): after generate it's already approved and auto-scheduled.
        tp = next(a for a in atoms if a["type"] == "twitter_post")
        r = client.post(f"{BASE_URL}/api/atoms/{tp['id']}/generate", timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "approved"
        assert d.get("scheduled_at"), "twitter_post should be auto-scheduled after generate"

        # Verify slot matches Twitter/X local slots (converted to UTC)
        sched = d["scheduled_at"]
        # scheduled_at may come back as ISO string or datetime dict
        if isinstance(sched, str):
            dt = datetime.fromisoformat(sched.replace("Z", "+00:00"))
        else:
            dt = sched
        utc_slots = _utc_slots(TWITTER_LOCAL)
        assert (dt.hour, dt.minute) in utc_slots, f"got {dt.hour}:{dt.minute} not in {utc_slots}"

    def test_approve_endpoint_returns_scheduled_at(self, client, article):
        atoms = client.get(f"{BASE_URL}/api/articles/{article['id']}/atoms").json()
        # Find a LinkedIn atom that needs review, generate, then approve
        li_atoms = [a for a in atoms if a["platform"] == "LinkedIn" and not a["auto_approve"]]
        # If none require review, take an auto_approve one that is not yet generated but approve after gen
        if li_atoms:
            target = li_atoms[0]
            client.post(f"{BASE_URL}/api/atoms/{target['id']}/generate", timeout=90)
            r = client.post(f"{BASE_URL}/api/atoms/{target['id']}/approve")
            assert r.status_code == 200
            d = r.json()
            # scheduled_at may be None if already scheduled or content missing; but content was generated
            # so it should return a slot
            assert d.get("scheduled_at"), f"approve should return scheduled_at, got {d}"
            dt = datetime.fromisoformat(d["scheduled_at"].replace("Z", "+00:00"))
            utc_slots = _utc_slots(LINKEDIN_LOCAL)
            assert (dt.hour, dt.minute) in utc_slots


# ============ Bulk-approve auto-schedules ============
class TestBulkApproveAutoSchedule:
    def test_bulk_approve_returns_ok_and_scheduled_count(self, client, article):
        atoms = client.get(f"{BASE_URL}/api/articles/{article['id']}/atoms").json()
        # generate 2 twitter_post atoms (auto_approve=True → already approved on gen);
        # to test bulk, pick draft twitter_posts NOT yet generated: bulk-approve won't schedule
        # since content is empty. Instead generate 2 LinkedIn atoms that are auto_approve=False,
        # keep them in review (do not approve), then bulk approve them.
        li_review = [a for a in atoms if a["platform"] == "LinkedIn" and not a["auto_approve"]][:2]
        if len(li_review) < 2:
            # fallback: use twitter_thread (auto_approve=False)
            li_review = [a for a in atoms if a["type"] == "twitter_thread"][:2]
        ids = []
        for a in li_review:
            client.post(f"{BASE_URL}/api/atoms/{a['id']}/generate", timeout=90)
            ids.append(a["id"])

        r = client.post(f"{BASE_URL}/api/atoms/bulk-approve", json={"ids": ids})
        assert r.status_code == 200
        d = r.json()
        assert d["count"] == len(ids)
        assert d.get("scheduled", 0) >= 0  # some may already be scheduled

        # Verify each atom is approved and has scheduled_at
        for aid in ids:
            g = client.get(f"{BASE_URL}/api/atoms/{aid}").json()
            assert g["status"] == "approved"
            assert g.get("scheduled_at"), f"atom {aid} not scheduled: {g.get('platform')}"


# ============ Schedule endpoint sanity ============
class TestScheduleEndpoint:
    def test_schedule_endpoint_returns_lists(self, client):
        r = client.get(f"{BASE_URL}/api/schedule")
        assert r.status_code == 200
        d = r.json()
        assert "unscheduled" in d and "timeline" in d
        assert isinstance(d["unscheduled"], list) and isinstance(d["timeline"], list)

    def test_auto_schedule_bulk_endpoint(self, client):
        r = client.post(f"{BASE_URL}/api/schedule/auto")
        assert r.status_code == 200
        assert "scheduled" in r.json()
