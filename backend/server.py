from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import json
import uuid
import hashlib
import logging
import secrets
from urllib.parse import urlencode
from datetime import datetime, timezone, timedelta

import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler

import auth
import blueprint as bp
import ai_service
import publisher

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


# ---------- helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def strip_html(html: str) -> str:
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


async def bump_quota(field: str):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.quotas.update_one({"date": today}, {"$inc": {field: 1}}, upsert=True)


async def log_job(atom_id: str, atom_type: str, status: str, message: str = ""):
    await db.jobs.insert_one({
        "id": str(uuid.uuid4()),
        "atom_id": atom_id,
        "type": atom_type,
        "status": status,
        "message": message[:500],
        "created_at": now_iso(),
    })


async def get_current_user(request: Request) -> dict:
    token = auth._extract_token(request)
    payload = auth.decode_token(token)
    user = await db.users.find_one({"email": payload.get("email")}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    user["id"] = str(user.pop("_id"))
    return user


# ---------- models ----------
class LoginInput(BaseModel):
    email: str
    password: str


class ArticleInput(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = ""
    tags: List[str] = []
    target_audience: Optional[str] = ""


class AtomUpdate(BaseModel):
    content: Optional[str] = None
    notes: Optional[str] = None


class BulkIds(BaseModel):
    ids: List[str]


# ---------- auth routes ----------
@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not auth.verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    token = auth.create_access_token(str(user["_id"]), email)
    return {"token": token, "user": {"id": str(user["_id"]), "email": email, "name": user.get("name"), "role": user.get("role")}}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- articles ----------
@api_router.post("/articles")
async def create_article(data: ArticleInput, user: dict = Depends(get_current_user)):
    title = (data.title or "").strip()
    content = (data.content or "").strip()
    url = (data.url or "").strip()
    source = "manual"

    if url and not content:
        source = "url"
        try:
            resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            content = strip_html(resp.text)
            if not title:
                m = re.search(r"<title>(.*?)</title>", resp.text, re.IGNORECASE | re.DOTALL)
                title = strip_html(m.group(1)) if m else url
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"URL alınamadı: {e}")

    if not content:
        raise HTTPException(status_code=400, detail="Makale içeriği veya geçerli bir URL gerekli")
    if not title:
        title = content[:60] + "..."

    content_hash = hashlib.sha256((url or content).encode("utf-8")).hexdigest()
    dup = await db.articles.find_one({"content_hash": content_hash}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(status_code=409, detail="Bu makale zaten eklenmiş (duplicate)")

    doc = {
        "id": str(uuid.uuid4()),
        "title": title,
        "content": content,
        "url": url,
        "category": data.category or "",
        "tags": data.tags,
        "target_audience": data.target_audience or "",
        "source": source,
        "content_hash": content_hash,
        "status": "new",
        "analysis": None,
        "created_at": now_iso(),
    }
    await db.articles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/articles")
async def list_articles(user: dict = Depends(get_current_user)):
    articles = await db.articles.find({}, {"_id": 0, "content": 0}).sort("created_at", -1).to_list(500)
    for a in articles:
        a["atom_count"] = await db.atoms.count_documents({"article_id": a["id"]})
    return articles


@api_router.get("/articles/{article_id}")
async def get_article(article_id: str, user: dict = Depends(get_current_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")
    return article


@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str, user: dict = Depends(get_current_user)):
    await db.articles.delete_one({"id": article_id})
    await db.atoms.delete_many({"article_id": article_id})
    return {"ok": True}


@api_router.post("/articles/{article_id}/analyze")
async def analyze_article(article_id: str, user: dict = Depends(get_current_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")

    # LLM analysis
    raw = await ai_service.generate_text(
        bp.ANALYSIS_SYSTEM, bp.analysis_prompt(article["title"], article["content"]),
        session_id=f"analyze-{article_id}",
    )
    await bump_quota("gemini_text")
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        analysis = json.loads(cleaned)
    except Exception:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        analysis = json.loads(m.group(0)) if m else {"summary": raw[:500], "concepts": [], "quotes": [], "audience": "", "tone": "", "key_points": []}

    await db.articles.update_one({"id": article_id}, {"$set": {"analysis": analysis, "status": "analyzed"}})

    # regenerate blueprint atoms
    await db.atoms.delete_many({"article_id": article_id})
    atoms = []
    for spec in bp.BLUEPRINT:
        for i in range(spec["count"]):
            atoms.append({
                "id": str(uuid.uuid4()),
                "article_id": article_id,
                "type": spec["type"],
                "label": spec["label"],
                "platform": spec["platform"],
                "category": spec["category"],
                "aspect": spec["aspect"],
                "index": i,
                "auto_approve": spec["auto_approve"],
                "status": "draft",
                "content": "",
                "media_type": None,
                "media": None,
                "notes": "",
                "published": False,
                "publish_platform": None,
                "publish_url": None,
                "published_at": None,
                "scheduled_at": None,
                "publish_attempts": 0,
                "last_error": None,
                "dead": False,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
    if atoms:
        await db.atoms.insert_many(atoms)
    return {"analysis": analysis, "atom_count": len(atoms)}


@api_router.get("/articles/{article_id}/atoms")
async def article_atoms(article_id: str, user: dict = Depends(get_current_user)):
    atoms = await db.atoms.find({"article_id": article_id}, {"_id": 0, "media": 0, "media_original": 0, "media_watermarked": 0}).to_list(1000)
    return atoms


# ---------- atoms ----------
@api_router.get("/atoms")
async def list_atoms(status: Optional[str] = None, include_media: bool = False, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    proj = {"_id": 0} if include_media else {"_id": 0, "media": 0, "media_original": 0, "media_watermarked": 0}
    atoms = await db.atoms.find(query, proj).sort("updated_at", -1).to_list(1000)
    return atoms


@api_router.get("/atoms/{atom_id}")
async def get_atom(atom_id: str, user: dict = Depends(get_current_user)):
    atom = await db.atoms.find_one({"id": atom_id}, {"_id": 0})
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    return atom


async def _generate_atom(atom: dict, article: dict):
    analysis = article.get("analysis") or {}
    atom_type = atom["type"]
    category = atom["category"]
    updates = {}

    if category == "image":
        prompt = bp.image_prompt(atom_type, article, analysis)
        w, h = ai_service.aspect_size(atom.get("aspect", "1:1"))
        b64 = await ai_service.generate_image(prompt, session_id=f"img-{atom['id']}", width=w, height=h)
        await bump_quota("gemini_image")
        if not b64:
            raise RuntimeError("Görsel üretilemedi")
        watermarked = ai_service.apply_watermark(b64)
        updates["media_type"] = "image"
        updates["media_original"] = b64
        updates["media_watermarked"] = watermarked
        updates["media"] = watermarked
        updates["media_choice"] = "watermarked"
        updates["content"] = prompt
    elif category == "audio":
        text = await ai_service.generate_text(
            bp.CONTENT_SYSTEM, bp.text_prompt(atom_type, atom["index"], article, analysis),
            session_id=f"txt-{atom['id']}",
        )
        await bump_quota("gemini_text")
        audio_b64 = await ai_service.generate_audio(text, voice=bp.tts_voice(atom_type))
        await bump_quota("openai_tts")
        updates["content"] = text
        updates["media_type"] = "audio"
        updates["media"] = audio_b64
    else:  # text
        text = await ai_service.generate_text(
            bp.CONTENT_SYSTEM, bp.text_prompt(atom_type, atom["index"], article, analysis),
            session_id=f"txt-{atom['id']}",
        )
        await bump_quota("gemini_text")
        updates["content"] = text

    updates["status"] = "approved" if atom["auto_approve"] else "review"
    updates["updated_at"] = now_iso()
    return updates


@api_router.post("/atoms/{atom_id}/generate")
async def generate_atom(atom_id: str, user: dict = Depends(get_current_user)):
    atom = await db.atoms.find_one({"id": atom_id}, {"_id": 0})
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    article = await db.articles.find_one({"id": atom["article_id"]}, {"_id": 0})
    try:
        updates = await _generate_atom(atom, article)
        await db.atoms.update_one({"id": atom_id}, {"$set": updates})
        await log_job(atom_id, atom["type"], "success", "Üretim tamamlandı")
    except Exception as e:
        await log_job(atom_id, atom["type"], "error", str(e))
        raise HTTPException(status_code=500, detail=f"Üretim hatası: {e}")
    result = await db.atoms.find_one({"id": atom_id}, {"_id": 0})
    if result and result.get("status") == "approved":
        await _auto_schedule_atom(result)
        result = await db.atoms.find_one({"id": atom_id}, {"_id": 0})
    return result


@api_router.post("/atoms/{atom_id}/regenerate")
async def regenerate_atom(atom_id: str, user: dict = Depends(get_current_user)):
    return await generate_atom(atom_id, user)


@api_router.put("/atoms/{atom_id}")
async def update_atom(atom_id: str, data: AtomUpdate, user: dict = Depends(get_current_user)):
    updates = {"updated_at": now_iso()}
    if data.content is not None:
        updates["content"] = data.content
    if data.notes is not None:
        updates["notes"] = data.notes
    res = await db.atoms.update_one({"id": atom_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    return await db.atoms.find_one({"id": atom_id}, {"_id": 0})


@api_router.post("/atoms/{atom_id}/approve")
async def approve_atom(atom_id: str, user: dict = Depends(get_current_user)):
    await db.atoms.update_one({"id": atom_id}, {"$set": {"status": "approved", "updated_at": now_iso()}})
    atom = await db.atoms.find_one({"id": atom_id}, {"_id": 0})
    slot = await _auto_schedule_atom(atom) if atom else None
    return {"ok": True, "scheduled_at": slot.isoformat() if slot else None}


@api_router.post("/atoms/{atom_id}/reject")
async def reject_atom(atom_id: str, user: dict = Depends(get_current_user)):
    await db.atoms.update_one({"id": atom_id}, {"$set": {"status": "rejected", "updated_at": now_iso()}})
    return {"ok": True}


@api_router.post("/atoms/bulk-approve")
async def bulk_approve(data: BulkIds, user: dict = Depends(get_current_user)):
    await db.atoms.update_many({"id": {"$in": data.ids}}, {"$set": {"status": "approved", "updated_at": now_iso()}})
    atoms = await db.atoms.find({"id": {"$in": data.ids}}, {"_id": 0}).to_list(1000)
    scheduled = 0
    for atom in atoms:
        if await _auto_schedule_atom(atom):
            scheduled += 1
    return {"ok": True, "count": len(data.ids), "scheduled": scheduled}


class MediaChoice(BaseModel):
    choice: str  # "watermarked" | "original"


@api_router.get("/atoms/{atom_id}/media")
async def get_atom_media(atom_id: str, user: dict = Depends(get_current_user)):
    atom = await db.atoms.find_one(
        {"id": atom_id},
        {"_id": 0, "media": 1, "media_original": 1, "media_watermarked": 1, "media_choice": 1, "media_type": 1},
    )
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    original = atom.get("media_original")
    watermarked = atom.get("media_watermarked")
    # Backfill legacy image atoms generated before dual-version support.
    if not original and not watermarked and atom.get("media_type") == "image" and atom.get("media"):
        original = atom["media"]
        watermarked = ai_service.apply_watermark(original)
        await db.atoms.update_one(
            {"id": atom_id},
            {"$set": {"media_original": original, "media_watermarked": watermarked, "media": watermarked, "media_choice": "watermarked"}},
        )
    return {
        "media_type": atom.get("media_type"),
        "media_choice": atom.get("media_choice", "watermarked"),
        "original": original,
        "watermarked": watermarked,
    }


@api_router.post("/atoms/{atom_id}/select-media")
async def select_media(atom_id: str, data: MediaChoice, user: dict = Depends(get_current_user)):
    atom = await db.atoms.find_one({"id": atom_id})
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    field = "media_watermarked" if data.choice == "watermarked" else "media_original"
    media = atom.get(field)
    if not media:
        raise HTTPException(status_code=400, detail="Bu versiyon mevcut değil")
    await db.atoms.update_one(
        {"id": atom_id},
        {"$set": {"media": media, "media_choice": data.choice, "updated_at": now_iso()}},
    )
    return {"ok": True, "choice": data.choice}


# ---------- social publishing ----------
class TwitterTokenIn(BaseModel):
    access_token: str


@api_router.get("/social/status")
async def social_status(user: dict = Depends(get_current_user)):
    token = await publisher.get_twitter_token(db)
    twitter = {"connected": False, "username": None, "error": None}
    if token:
        info = publisher.verify_twitter(token)
        if info:
            twitter = {"connected": True, "username": info.get("username"), "error": None}
        else:
            twitter = {"connected": False, "username": None, "error": "Token geçersiz veya süresi dolmuş"}
    li_id = os.environ.get("LINKEDIN_CLIENT_ID", "")
    li_row = await db.social_tokens.find_one({"platform": "linkedin"})
    linkedin = {
        "connected": bool(li_row and li_row.get("access_token")),
        "configured": bool(li_id and li_id not in ("", "...")),
        "name": li_row.get("name") if li_row else None,
    }
    return {"twitter": twitter, "linkedin": linkedin}


@api_router.post("/social/twitter/token")
async def set_twitter_token(data: TwitterTokenIn, user: dict = Depends(get_current_user)):
    await db.social_tokens.update_one(
        {"platform": "twitter"},
        {"$set": {"platform": "twitter", "access_token": data.access_token.strip(), "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/linkedin/login")
async def linkedin_login(user: dict = Depends(get_current_user)):
    state = secrets.token_urlsafe(24)
    await db.oauth_states.insert_one({"state": state, "created_at": now_iso()})
    params = urlencode({
        "response_type": "code",
        "client_id": os.environ["LINKEDIN_CLIENT_ID"],
        "redirect_uri": os.environ["LINKEDIN_REDIRECT_URI"],
        "state": state,
        "scope": "openid profile email w_member_social",
    })
    return {"url": f"https://www.linkedin.com/oauth/v2/authorization?{params}"}


@api_router.get("/linkedin/callback")
async def linkedin_callback(code: str = None, state: str = None, error: str = None):
    frontend = os.environ.get("FRONTEND_URL", "")
    if error or not code or not state:
        return RedirectResponse(f"{frontend}/observability?linkedin=error")
    st = await db.oauth_states.find_one({"state": state})
    if not st:
        return RedirectResponse(f"{frontend}/observability?linkedin=error")
    await db.oauth_states.delete_one({"state": state})
    try:
        token = publisher.linkedin_exchange_code(code, os.environ["LINKEDIN_REDIRECT_URI"])
        access_token = token["access_token"]
        info = publisher.linkedin_userinfo(access_token)
        await db.social_tokens.update_one(
            {"platform": "linkedin"},
            {"$set": {"platform": "linkedin", "access_token": access_token, "sub": info.get("sub"), "name": info.get("name"), "updated_at": now_iso()}},
            upsert=True,
        )
    except Exception as e:
        logger.error(f"LinkedIn callback error: {e}")
        return RedirectResponse(f"{frontend}/observability?linkedin=error")
    return RedirectResponse(f"{frontend}/observability?linkedin=connected")


async def _do_publish(atom: dict) -> dict:
    platform = atom["platform"]
    if platform == "Twitter/X":
        token_row = await db.social_tokens.find_one({"platform": "twitter"})
        token = (token_row or {}).get("access_token") or os.environ.get("TWITTER_ACCESS_TOKEN")
        if not token:
            raise ValueError("Twitter/X bağlı değil")
        try:
            return publisher.publish_twitter(token, atom)
        except publisher.TokenExpired:
            rt = (token_row or {}).get("refresh_token") or os.environ.get("TWITTER_ACCESS_TOKEN_SECRET")
            new = publisher.refresh_twitter(rt)
            if not new:
                raise ValueError("Twitter token yenilenemedi (Client Secret gerekli)")
            await db.social_tokens.update_one(
                {"platform": "twitter"},
                {"$set": {"platform": "twitter", "access_token": new["access_token"], "refresh_token": new.get("refresh_token", rt), "updated_at": now_iso()}},
                upsert=True,
            )
            return publisher.publish_twitter(new["access_token"], atom)
    if platform == "LinkedIn":
        li = await db.social_tokens.find_one({"platform": "linkedin"})
        if not li or not li.get("access_token"):
            raise ValueError("LinkedIn bağlı değil")
        return publisher.publish_linkedin(li["access_token"], li["sub"], atom["content"])
    raise ValueError("Bu platform için yayın desteklenmiyor")


@api_router.post("/atoms/{atom_id}/publish")
async def publish_atom(atom_id: str, user: dict = Depends(get_current_user)):
    atom = await db.atoms.find_one({"id": atom_id}, {"_id": 0})
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    if not atom.get("content"):
        raise HTTPException(status_code=400, detail="Önce içerik üretin")
    if atom["status"] != "approved":
        raise HTTPException(status_code=400, detail="Yayınlamadan önce atomu onaylayın")
    try:
        result = await _do_publish(atom)
    except (publisher.PublishError, ValueError) as e:
        await log_job(atom_id, atom["type"], "error", str(e))
        raise HTTPException(status_code=400, detail=str(e))
    await db.atoms.update_one({"id": atom_id}, {"$set": {
        "published": True, "publish_platform": atom["platform"], "publish_url": result["url"], "published_at": now_iso(), "dead": False,
    }})
    await log_job(atom_id, atom["type"], "success", f"Yayınlandı: {result['url']}")
    return {"ok": True, "url": result["url"]}


class ScheduleInput(BaseModel):
    scheduled_at: str


def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


@api_router.post("/atoms/{atom_id}/schedule")
async def schedule_atom(atom_id: str, data: ScheduleInput, user: dict = Depends(get_current_user)):
    atom = await db.atoms.find_one({"id": atom_id}, {"_id": 0})
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    if atom["status"] != "approved" or not atom.get("content"):
        raise HTTPException(status_code=400, detail="Yalnızca onaylı ve üretilmiş atomlar zamanlanabilir")
    if atom["platform"] not in ("Twitter/X", "LinkedIn"):
        raise HTTPException(status_code=400, detail="Bu platform için zamanlama desteklenmiyor")
    await db.atoms.update_one({"id": atom_id}, {"$set": {"scheduled_at": _parse_dt(data.scheduled_at), "dead": False, "publish_attempts": 0, "last_error": None}})
    return {"ok": True}


@api_router.post("/atoms/{atom_id}/unschedule")
async def unschedule_atom(atom_id: str, user: dict = Depends(get_current_user)):
    await db.atoms.update_one({"id": atom_id}, {"$set": {"scheduled_at": None}})
    return {"ok": True}


TR_UTC_OFFSET = 3  # Türkiye UTC+3


PLATFORM_SLOTS_LOCAL = {
    "LinkedIn": [(8, 0), (12, 0), (17, 30)],           # profesyonel iş saatleri
    "Twitter/X": [(9, 0), (12, 30), (15, 0), (20, 0)],  # yüksek etkileşim saatleri
}
DEFAULT_SLOTS_LOCAL = [(9, 0), (13, 0), (18, 0)]


def _platform_slots_utc(platform: str) -> list:
    local = PLATFORM_SLOTS_LOCAL.get(platform, DEFAULT_SLOTS_LOCAL)
    return sorted(((h - TR_UTC_OFFSET) % 24, m) for (h, m) in local)


def _candidate_slots(platform: str, count: int) -> list:
    slots = _platform_slots_utc(platform)
    now = datetime.now(timezone.utc)
    out, day = [], 0
    while len(out) < count and day < 90:
        base = (now + timedelta(days=day)).replace(second=0, microsecond=0)
        for (h, m) in slots:
            s = base.replace(hour=h, minute=m)
            if s > now:
                out.append(s)
        day += 1
    return out


async def _taken_slots(platform: str) -> set:
    rows = await db.atoms.find(
        {"platform": platform, "scheduled_at": {"$ne": None}, "published": {"$ne": True}},
        {"_id": 0, "scheduled_at": 1},
    ).to_list(1000)
    taken = set()
    for r in rows:
        t = r.get("scheduled_at")
        if isinstance(t, datetime):
            taken.add(t.replace(second=0, microsecond=0, tzinfo=None))
    return taken


async def _auto_schedule_atom(atom: dict) -> Optional[datetime]:
    """Assign the next free platform-optimal slot to an eligible social atom."""
    if atom.get("platform") not in ("Twitter/X", "LinkedIn"):
        return None
    if not atom.get("content") or atom.get("published") or atom.get("scheduled_at"):
        return None
    taken = await _taken_slots(atom["platform"])
    for s in _candidate_slots(atom["platform"], 400):
        if s.replace(tzinfo=None) not in taken:
            await db.atoms.update_one(
                {"id": atom["id"]},
                {"$set": {"scheduled_at": s, "dead": False, "publish_attempts": 0, "last_error": None}},
            )
            return s
    return None


@api_router.post("/schedule/auto")
async def auto_schedule(user: dict = Depends(get_current_user)):
    atoms = await db.atoms.find({
        "status": "approved", "published": {"$ne": True}, "scheduled_at": None,
        "platform": {"$in": ["Twitter/X", "LinkedIn"]},
    }, {"_id": 0}).to_list(500)
    count = 0
    for atom in atoms:
        if await _auto_schedule_atom(atom):
            count += 1
    return {"scheduled": count}


@api_router.get("/schedule")
async def get_schedule(user: dict = Depends(get_current_user)):
    proj = {"_id": 0, "media": 0, "media_original": 0, "media_watermarked": 0}
    unscheduled = await db.atoms.find({
        "status": "approved", "published": {"$ne": True}, "scheduled_at": None,
        "platform": {"$in": ["Twitter/X", "LinkedIn"]},
    }, proj).to_list(500)
    timeline = await db.atoms.find({"scheduled_at": {"$ne": None}}, proj).sort("scheduled_at", 1).to_list(500)
    articles = await db.articles.find({}, {"_id": 0, "id": 1, "title": 1}).to_list(500)
    title_map = {a["id"]: a["title"] for a in articles}
    for a in unscheduled + timeline:
        a["article_title"] = title_map.get(a["article_id"], "")
    return {"unscheduled": unscheduled, "timeline": timeline}


async def scheduled_publisher():
    now = datetime.now(timezone.utc)
    due = await db.atoms.find({
        "scheduled_at": {"$ne": None, "$lte": now},
        "published": {"$ne": True}, "dead": {"$ne": True}, "status": "approved",
    }, {"_id": 0}).to_list(50)
    for atom in due:
        try:
            result = await _do_publish(atom)
            await db.atoms.update_one({"id": atom["id"]}, {"$set": {
                "published": True, "publish_platform": atom["platform"], "publish_url": result["url"], "published_at": now_iso(),
            }})
            await log_job(atom["id"], atom["type"], "success", f"Zamanlı yayın: {result['url']}")
        except Exception as e:
            attempts = atom.get("publish_attempts", 0) + 1
            dead = attempts >= 3
            await db.atoms.update_one({"id": atom["id"]}, {"$set": {"publish_attempts": attempts, "last_error": str(e), "dead": dead}})
            await log_job(atom["id"], atom["type"], "error", f"Zamanlı yayın hatası (deneme {attempts}{'/DLQ' if dead else ''}): {e}")


# ---------- dashboard / observability ----------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    total_articles = await db.articles.count_documents({})
    analyzed = await db.articles.count_documents({"status": "analyzed"})
    total_atoms = await db.atoms.count_documents({})
    published = await db.atoms.count_documents({"published": True})
    by_status = {}
    for s in ["draft", "review", "approved", "rejected"]:
        by_status[s] = await db.atoms.count_documents({"status": s})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    quota = await db.quotas.find_one({"date": today}, {"_id": 0}) or {}
    return {
        "total_articles": total_articles,
        "analyzed_articles": analyzed,
        "total_atoms": total_atoms,
        "published": published,
        "atoms_by_status": by_status,
        "quota_today": {
            "gemini_text": quota.get("gemini_text", 0),
            "gemini_image": quota.get("gemini_image", 0),
            "openai_tts": quota.get("openai_tts", 0),
        },
    }


@api_router.get("/quotas")
async def get_quotas(user: dict = Depends(get_current_user)):
    return await db.quotas.find({}, {"_id": 0}).sort("date", -1).to_list(30)


@api_router.get("/jobs")
async def get_jobs(user: dict = Depends(get_current_user)):
    return await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)


@api_router.get("/blueprint")
async def get_blueprint(user: dict = Depends(get_current_user)):
    return {"blueprint": bp.BLUEPRINT, "total": bp.total_atom_count()}


@api_router.get("/analytics")
async def analytics(user: dict = Depends(get_current_user)):
    pub = await db.atoms.find({"published": True}, {"_id": 0, "media": 0, "media_original": 0, "media_watermarked": 0}).to_list(2000)
    dead = await db.atoms.find({"dead": True}, {"_id": 0, "media": 0, "media_original": 0, "media_watermarked": 0}).to_list(500)
    scheduled_total = await db.atoms.count_documents({"scheduled_at": {"$ne": None}, "published": {"$ne": True}, "dead": {"$ne": True}})
    by_platform: dict = {}
    by_type: dict = {}
    by_hour = {str(h): 0 for h in range(24)}
    for a in pub:
        by_platform[a["platform"]] = by_platform.get(a["platform"], 0) + 1
        by_type[a["label"]] = by_type.get(a["label"], 0) + 1
        pa = a.get("published_at")
        if pa:
            try:
                dt = datetime.fromisoformat(pa.replace("Z", "+00:00"))
                ist = dt + timedelta(hours=5, minutes=30)
                by_hour[str(ist.hour)] += 1
            except Exception:
                pass
    feedback = []
    if by_platform:
        tp = max(by_platform, key=by_platform.get)
        feedback.append(f"En çok yayınlanan platform: {tp} ({by_platform[tp]} gönderi) — blueprint'te bu platforma ağırlık verilebilir.")
    if by_type:
        tt = max(by_type, key=by_type.get)
        feedback.append(f"En çok yayınlanan içerik türü: {tt} — bu türden atom sayısını artırmayı değerlendirin.")
    if sum(by_hour.values()):
        th = max(by_hour, key=lambda k: by_hour[k])
        feedback.append(f"En yoğun yayın saati (IST): {th}:00 civarı.")
    if dead:
        feedback.append(f"{len(dead)} atom yayınlanamadı (DLQ). En sık neden: kota/kimlik hataları — bağlantı ve kotayı kontrol edin.")
    feedback.append("Not: Beğeni/görüntülenme gibi etkileşim metrikleri, Twitter/LinkedIn okuma API'lerine (ücretli/ek izin) bağlıdır; bu sürümde yalnızca yayın verisi analiz edilir.")
    dlq = [{"id": a["id"], "platform": a["platform"], "label": a["label"], "index": a.get("index", 0), "last_error": a.get("last_error")} for a in dead]
    return {
        "published_total": len(pub), "scheduled_total": scheduled_total, "failed_total": len(dead),
        "by_platform": by_platform, "by_type": by_type, "by_hour": by_hour, "dlq": dlq, "feedback": feedback,
    }


@api_router.get("/")
async def root():
    return {"message": "content-studio API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await auth.seed_admin(db)
    existing = await db.social_tokens.find_one({"platform": "twitter"})
    if not existing and os.environ.get("TWITTER_ACCESS_TOKEN"):
        await db.social_tokens.insert_one({
            "platform": "twitter",
            "access_token": os.environ["TWITTER_ACCESS_TOKEN"],
            "refresh_token": os.environ.get("TWITTER_ACCESS_TOKEN_SECRET"),
            "updated_at": now_iso(),
        })
    await db.users.create_index("email", unique=True)
    await db.articles.create_index("content_hash")
    await db.atoms.create_index("article_id")
    await db.atoms.create_index("status")
    scheduler.add_job(scheduled_publisher, "interval", minutes=1, id="publisher", replace_existing=True)
    if not scheduler.running:
        scheduler.start()
    logger.info("content-studio backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
