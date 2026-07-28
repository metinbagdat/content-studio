"""Backend API regression tests for content-studio."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://studio-publish.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@egitim.today"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and d["user"]["email"] == ADMIN_EMAIL

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_no_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# ---------------- Blueprint ----------------
class TestBlueprint:
    def test_blueprint_has_50_atoms(self, client):
        r = client.get(f"{BASE_URL}/api/blueprint")
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 50, f"Expected 50 atoms in blueprint, got {d['total']}"


# ---------------- Articles + Analyze + Atom generation ----------------
class TestArticleFlow:
    article_id = None

    def test_create_article(self, client):
        payload = {
            "title": f"TEST_ Yapay Zeka ve Eğitim {uuid.uuid4().hex[:6]}",
            "content": ("Yapay zeka teknolojileri son yıllarda eğitim dünyasında büyük dönüşümlere neden oldu. "
                        "Kişiselleştirilmiş öğrenme, adaptif değerlendirme sistemleri ve zeki öğretim asistanları "
                        "gibi araçlar öğrencilerin bireysel ihtiyaçlarına uygun içerikler sunmayı mümkün kılıyor. "
                        "Öğretmenler ise yapay zeka destekli platformlar sayesinde daha etkili geri bildirim veriyor. "
                        "Bu makalede yapay zekanın eğitimdeki uygulama alanlarını ve geleceğini inceliyoruz."),
            "category": "AI",
            "tags": ["ai", "education"],
            "target_audience": "Öğretmenler",
        }
        r = client.post(f"{BASE_URL}/api/articles", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["status"] == "new"
        assert "id" in d
        TestArticleFlow.article_id = d["id"]

    def test_duplicate_article_returns_409(self, client):
        # Reuse same content -> same hash
        payload = {
            "title": "duplicate check",
            "content": ("Yapay zeka teknolojileri son yıllarda eğitim dünyasında büyük dönüşümlere neden oldu. "
                        "Kişiselleştirilmiş öğrenme, adaptif değerlendirme sistemleri ve zeki öğretim asistanları "
                        "gibi araçlar öğrencilerin bireysel ihtiyaçlarına uygun içerikler sunmayı mümkün kılıyor. "
                        "Öğretmenler ise yapay zeka destekli platformlar sayesinde daha etkili geri bildirim veriyor. "
                        "Bu makalede yapay zekanın eğitimdeki uygulama alanlarını ve geleceğini inceliyoruz."),
        }
        r = client.post(f"{BASE_URL}/api/articles", json=payload)
        assert r.status_code == 409

    def test_list_articles(self, client):
        r = client.get(f"{BASE_URL}/api/articles")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert any(a["id"] == TestArticleFlow.article_id for a in arr)

    def test_get_article(self, client):
        r = client.get(f"{BASE_URL}/api/articles/{TestArticleFlow.article_id}")
        assert r.status_code == 200
        assert r.json()["id"] == TestArticleFlow.article_id

    def test_analyze_creates_50_atoms(self, client):
        r = client.post(f"{BASE_URL}/api/articles/{TestArticleFlow.article_id}/analyze", timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["atom_count"] == 50
        assert "analysis" in d and isinstance(d["analysis"], dict)
        # verify article status updated
        art = client.get(f"{BASE_URL}/api/articles/{TestArticleFlow.article_id}").json()
        assert art["status"] == "analyzed"
        assert art["analysis"] is not None

    def test_list_atoms_50(self, client):
        r = client.get(f"{BASE_URL}/api/articles/{TestArticleFlow.article_id}/atoms")
        assert r.status_code == 200
        atoms = r.json()
        assert len(atoms) == 50
        # store one twitter_post atom for generation test
        tp = [a for a in atoms if a["type"] == "twitter_post"]
        assert len(tp) == 10
        TestArticleFlow.twitter_atom_id = tp[0]["id"]
        # store one review atom (auto_approve=False, e.g. short_video_script)
        rv = [a for a in atoms if a["type"] == "short_video_script"]
        assert len(rv) == 3
        TestArticleFlow.review_atom_id = rv[0]["id"]

    def test_generate_text_atom_auto_approved(self, client):
        aid = TestArticleFlow.twitter_atom_id
        r = client.post(f"{BASE_URL}/api/atoms/{aid}/generate", timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "approved"  # twitter_post has auto_approve=True
        assert d["content"] and len(d["content"]) > 5

    def test_generate_text_atom_goes_to_review(self, client):
        aid = TestArticleFlow.review_atom_id
        r = client.post(f"{BASE_URL}/api/atoms/{aid}/generate", timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "review"
        assert d["content"]

    def test_edit_atom(self, client):
        aid = TestArticleFlow.review_atom_id
        r = client.put(f"{BASE_URL}/api/atoms/{aid}", json={"content": "TEST_ edited content"})
        assert r.status_code == 200
        assert r.json()["content"] == "TEST_ edited content"

    def test_approve_atom(self, client):
        aid = TestArticleFlow.review_atom_id
        r = client.post(f"{BASE_URL}/api/atoms/{aid}/approve")
        assert r.status_code == 200
        got = client.get(f"{BASE_URL}/api/atoms/{aid}").json()
        assert got["status"] == "approved"

    def test_reject_and_bulk_approve(self, client):
        # pick two draft atoms
        atoms = client.get(f"{BASE_URL}/api/articles/{TestArticleFlow.article_id}/atoms").json()
        drafts = [a for a in atoms if a["status"] == "draft"][:2]
        assert len(drafts) == 2
        # reject one
        rj = client.post(f"{BASE_URL}/api/atoms/{drafts[0]['id']}/reject")
        assert rj.status_code == 200
        # bulk-approve both
        ba = client.post(f"{BASE_URL}/api/atoms/bulk-approve",
                         json={"ids": [drafts[0]["id"], drafts[1]["id"]]})
        assert ba.status_code == 200
        assert ba.json()["count"] == 2
        # verify status
        for a in drafts:
            g = client.get(f"{BASE_URL}/api/atoms/{a['id']}").json()
            assert g["status"] == "approved"


# ---------------- Dashboard / Observability ----------------
class TestObservability:
    def test_dashboard_stats(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_articles", "total_atoms", "atoms_by_status", "quota_today"]:
            assert k in d
        for s in ["draft", "review", "approved", "rejected"]:
            assert s in d["atoms_by_status"]

    def test_jobs(self, client):
        r = client.get(f"{BASE_URL}/api/jobs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_quotas(self, client):
        r = client.get(f"{BASE_URL}/api/quotas")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Cleanup ----------------
def test_zzz_cleanup_article(client):
    if TestArticleFlow.article_id:
        r = client.delete(f"{BASE_URL}/api/articles/{TestArticleFlow.article_id}")
        assert r.status_code == 200
