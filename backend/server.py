from dotenv import load_dotenv
from pathlib import Path

# .env dosyasını kök dizinden (content-studio) oku
ROOT_DIR = Path(__file__).parent.parent
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
from pydantic import BaseModel, Field
from typing import List, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from supabase import create_client, Client

import auth
import blueprint as bp
import ai_service
import publisher
import notifications

# Supabase Client Başlatma
supabase: Client = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_KEY")
)

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
    supabase.table("quotas").upsert({"date": today, field: 1}, on_conflict="date").execute()

async def log_job(atom_id: str, atom_type: str, status: str, message: str = ""):
    supabase.table("jobs").insert({
        "id": str(uuid.uuid4()), "atom_id": atom_id, "type": atom_type,
        "status": status, "message": message[:500], "created_at": now_iso(),
    }).execute()

async def get_current_user(request: Request) -> dict:
    token = auth._extract_token(request)
    payload = auth.decode_token(token)
    response = supabase.table("users").select("*").eq("email", payload.get("email")).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    user = response.data[0]
    user.pop("password_hash", None)
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
    response = supabase.table("users").select("*").eq("email", email).execute()
    if not response.data or len(response.data) == 0 or not auth.verify_password(data.password, response.data[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    user = response.data[0]
    token = auth.create_access_token(str(user["id"]), email)
    return {"token": token, "user": {"id": str(user["id"]), "email": email, "name": user.get("name"), "role": user.get("role")}}

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
    dup = supabase.table("articles").select("id").eq("content_hash", content_hash).execute()
    if dup.data and len(dup.data) > 0:
        raise HTTPException(status_code=409, detail="Bu makale zaten eklenmiş (duplicate)")

    doc = {
        "id": str(uuid.uuid4()), "title": title, "content": content, "url": url,
        "category": data.category or "", "tags": data.tags, "target_audience": data.target_audience or "",
        "source": source, "content_hash": content_hash, "status": "new", "analysis": None, "created_at": now_iso(),
    }
    supabase.table("articles").insert(doc).execute()
    return doc

@api_router.get("/articles")
async def list_articles(user: dict = Depends(get_current_user)):
    articles = supabase.table("articles").select("id, title, url, category, tags, target_audience, source, content_hash, status, analysis, created_at").order("created_at", desc=True).execute()
    result = []
    for a in articles.data:
        atoms_count = len(supabase.table("atoms").select("id").eq("article_id", a["id"]).execute().data)
        a["atom_count"] = atoms_count
        result.append(a)
    return result

@api_router.get("/articles/{article_id}")
async def get_article(article_id: str, user: dict = Depends(get_current_user)):
    response = supabase.table("articles").select("*").eq("id", article_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")
    return response.data[0]

@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str, user: dict = Depends(get_current_user)):
    supabase.table("articles").delete().eq("id", article_id).execute()
    supabase.table("atoms").delete().eq("article_id", article_id).execute()
    return {"ok": True}

@api_router.post("/articles/{article_id}/analyze")
async def analyze_article(article_id: str, user: dict = Depends(get_current_user)):
    response = supabase.table("articles").select("*").eq("id", article_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")
    article = response.data[0]

    raw = await ai_service.generate_text(bp.ANALYSIS_SYSTEM, bp.analysis_prompt(article["title"], article["content"]), session_id=f"analyze-{article_id}")
    await bump_quota("gemini_text")
    
    cleaned = re.sub(r"^```(json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        analysis = json.loads(cleaned)
    except Exception:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        analysis = json.loads(m.group(0)) if m else {"summary": raw[:500], "concepts": [], "quotes": [], "audience": "", "tone": "", "key_points": []}

    supabase.table("articles").update({"analysis": analysis, "status": "analyzed"}).eq("id", article_id).execute()

    supabase.table("atoms").delete().eq("article_id", article_id).execute()
    atoms = []
    for spec in bp.BLUEPRINT:
        for i in range(spec["count"]):
            atoms.append({
                "id": str(uuid.uuid4()), "article_id": article_id, "type": spec["type"], "label": spec["label"],
                "platform": spec["platform"], "category": spec["category"], "aspect": spec["aspect"], "index": i,
                "auto_approve": spec["auto_approve"], "status": "draft", "content": "", "media_type": None,
                "media": None, "notes": "", "published": False, "publish_platform": None, "publish_url": None,
                "published_at": None, "scheduled_at": None, "publish_attempts": 0, "last_error": None, "dead": False,
                "created_at": now_iso(), "updated_at": now_iso(),
            })
    if atoms:
        supabase.table("atoms").insert(atoms).execute()
    return {"analysis": analysis, "atom_count": len(atoms)}

@api_router.get("/articles/{article_id}/atoms")
async def article_atoms(article_id: str, user: dict = Depends(get_current_user)):
    response = supabase.table("atoms").select("id, article_id, type, label, platform, category, aspect, index, auto_approve, status, content, media_type, media_choice, notes, published, publish_platform, publish_url, published_at, scheduled_at, publish_attempts, last_error, dead, created_at, updated_at").eq("article_id", article_id).execute()
    return response.data

# ---------- atoms ----------
@api_router.get("/atoms")
async def list_atoms(status: Optional[str] = None, include_media: bool = False, user: dict = Depends(get_current_user)):
    query = supabase.table("atoms").select("*" if include_media else "id, article_id, type, label, platform, category, aspect, index, auto_approve, status, content, media_type, media_choice, notes, published, publish_platform, publish_url, published_at, scheduled_at, publish_attempts, last_error, dead, created_at, updated_at")
    if status:
        query = query.eq("status", status)
    response = query.order("updated_at", desc=True).execute()
    return response.data

@api_router.get("/atoms/{atom_id}")
async def get_atom(atom_id: str, user: dict = Depends(get_current_user)):
    response = supabase.table("atoms").select("*").eq("id", atom_id).execute()
    if not response.data or len(response.data) == 0:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    return response.data[0]

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
        text = await ai_service.generate_text(bp.CONTENT_SYSTEM, bp.text_prompt(atom_type, atom["index"], article, analysis), session_id=f"txt-{atom['id']}")
        await bump_quota("gemini_text")
        audio_b64 = await ai_service.generate_audio(text, voice=bp.tts_voice(atom_type))
        await bump_quota("openai_tts")
        updates["content"] = text
        updates["media_type"] = "audio"
        updates["media"] = audio_b64
    else:
        text = await ai_service.generate_text(bp.CONTENT_SYSTEM, bp.text_prompt(atom_type, atom["index"], article, analysis), session_id=f"txt-{atom['id']}")
        await bump_quota("gemini_text")
        updates["content"] = text

    updates["status"] = "approved" if atom["auto_approve"] else "review"
    updates["updated_at"] = now_iso()
    return updates

@api_router.post("/atoms/{atom_id}/generate")
async def generate_atom(atom_id: str, user: dict = Depends(get_current_user)):
    atom_res = supabase.table("atoms").select("*").eq("id", atom_id).execute()
    if not atom_res.data or len(atom_res.data) == 0:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    atom = atom_res.data[0]
    
    article_res = supabase.table("articles").select("*").eq("id", atom["article_id"]).execute()
    if not article_res.data or len(article_res.data) == 0:
        raise HTTPException(status_code=404, detail="Makale bulunamadı")
    article = article_res.data[0]
    
    try:
        updates = await _generate_atom(atom, article)
        supabase.table("atoms").update(updates).eq("id", atom_id).execute()
        await log_job(atom_id, atom["type"], "success", "Üretim tamamlandı")
    except Exception as e:
        await log_job(atom_id, atom["type"], "error", str(e))
        raise HTTPException(status_code=500, detail=f"Üretim hatası: {e}")
        
    result = supabase.table("atoms").select("*").eq("id", atom_id).execute().data[0]
    if result and result.get("status") == "approved":
        await _auto_schedule_atom(result)
        result = supabase.table("atoms").select("*").eq("id", atom_id).execute().data[0]
    return result

@api_router.post("/atoms/{atom_id}/regenerate")
async def regenerate_atom(atom_id: str, user: dict = Depends(get_current_user)):
    return await generate_atom(atom_id, user)

@api_router.put("/atoms/{atom_id}")
async def update_atom(atom_id: str, data: AtomUpdate, user: dict = Depends(get_current_user)):
    updates = {"updated_at": now_iso()}
    if data.content is not None: updates["content"] = data.content
    if data.notes is not None: updates["notes"] = data.notes
    
    res = supabase.table("atoms").update(updates).eq("id", atom_id).execute()
    if not res.data or len(res.data) == 0:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    return res.data[0]

@api_router.post("/atoms/{atom_id}/approve")
async def approve_atom(atom_id: str, user: dict = Depends(get_current_user)):
    supabase.table("atoms").update({"status": "approved", "updated_at": now_iso()}).eq("id", atom_id).execute()
    atom = supabase.table("atoms").select("*").eq("id", atom_id).execute().data[0]
    slot = await _auto_schedule_atom(atom) if atom else None
    return {"ok": True, "scheduled_at": slot.isoformat() if slot else None}

@api_router.post("/atoms/{atom_id}/reject")
async def reject_atom(atom_id: str, user: dict = Depends(get_current_user)):
    supabase.table("atoms").update({"status": "rejected", "updated_at": now_iso()}).eq("id", atom_id).execute()
    return {"ok": True}

@api_router.post("/atoms/bulk-approve")
async def bulk_approve(data: BulkIds, user: dict = Depends(get_current_user)):
    supabase.table("atoms").update({"status": "approved", "updated_at": now_iso()}).in_("id", data.ids).execute()
    atoms = supabase.table("atoms").select("*").in_("id", data.ids).execute().data
    scheduled = 0
    for atom in atoms:
        if await _auto_schedule_atom(atom):
            scheduled += 1
    return {"ok": True, "count": len(data.ids), "scheduled": scheduled}

class MediaChoice(BaseModel):
    choice: str

@api_router.get("/atoms/{atom_id}/media")
async def get_atom_media(atom_id: str, user: dict = Depends(get_current_user)):
    atom_res = supabase.table("atoms").select("media, media_original, media_watermarked, media_choice, media_type").eq("id", atom_id).execute()
    if not atom_res.data or len(atom_res.data) == 0:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    atom = atom_res.data[0]
    
    original = atom.get("media_original")
    watermarked = atom.get("media_watermarked")
    
    if not original and not watermarked and atom.get("media_type") == "image" and atom.get("media"):
        original = atom["media"]
        watermarked = ai_service.apply_watermark(original)
        supabase.table("atoms").update({"media_original": original, "media_watermarked": watermarked, "media": watermarked, "media_choice": "watermarked"}).eq("id", atom_id).execute()
        
    return {"media_type": atom.get("media_type"), "media_choice": atom.get("media_choice", "watermarked"), "original": original, "watermarked": watermarked}

@api_router.post("/atoms/{atom_id}/select-media")
async def select_media(atom_id: str, data: MediaChoice, user: dict = Depends(get_current_user)):
    atom = supabase.table("atoms").select("*").eq("id", atom_id).execute().data[0]
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    field = "media_watermarked" if data.choice == "watermarked" else "media_original"
    media = atom.get(field)
    if not media:
        raise HTTPException(status_code=400, detail="Bu versiyon mevcut değil")
    supabase.table("atoms").update({"media": media, "media_choice": data.choice, "updated_at": now_iso()}).eq("id", atom_id).execute()
    return {"ok": True, "choice": data.choice}

# ---------- social publishing ----------
class TwitterTokenIn(BaseModel):
    access_token: str

@api_router.get("/social/status")
async def social_status(user: dict = Depends(get_current_user)):
    token_res = supabase.table("social_tokens").select("*").eq("platform", "twitter").execute()
    token = token_res.data[0]["access_token"] if token_res.data and len(token_res.data) > 0 else None
    
    twitter = {"connected": False, "username": None, "error": None}
    if token:
        info = publisher.verify_twitter(token)
        if info:
            twitter = {"connected": True, "username": info.get("username"), "error": None}
        else:
            twitter = {"connected": False, "username": None, "error": "Token geçersiz veya süresi dolmuş"}
            
    li_id = os.environ.get("LINKEDIN_CLIENT_ID", "")
    li_res = supabase.table("social_tokens").select("*").eq("platform", "linkedin").execute()
    li_row = li_res.data[0] if li_res.data and len(li_res.data) > 0 else None
    
    linkedin = {
        "connected": bool(li_row and li_row.get("access_token")),
        "configured": bool(li_id and li_id not in ("", "...")),
        "name": li_row.get("name") if li_row else None,
    }
    return {"twitter": twitter, "linkedin": linkedin}

@api_router.post("/social/twitter/token")
async def set_twitter_token(data: TwitterTokenIn, user: dict = Depends(get_current_user)):
    supabase.table("social_tokens").upsert({"platform": "twitter", "access_token": data.access_token.strip(), "updated_at": now_iso()}, on_conflict="platform").execute()
    return {"ok": True}

@api_router.get("/linkedin/login")
async def linkedin_login(user: dict = Depends(get_current_user)):
    state = secrets.token_urlsafe(24)
    supabase.table("oauth_states").insert({"state": state, "created_at": now_iso()}).execute()
    params = urlencode({
        "response_type": "code", "client_id": os.environ["LINKEDIN_CLIENT_ID"],
        "redirect_uri": os.environ["LINKEDIN_REDIRECT_URI"], "state": state,
        "scope": "openid profile email w_member_social",
    })
    return {"url": f"https://www.linkedin.com/oauth/v2/authorization?{params}"}

@api_router.get("/linkedin/callback")
async def linkedin_callback(code: str = None, state: str = None, error: str = None):
    frontend = os.environ.get("FRONTEND_URL", "")
    if error or not code or not state:
        return RedirectResponse(f"{frontend}/observability?linkedin=error")
        
    st = supabase.table("oauth_states").select("*").eq("state", state).execute()
    if not st.data or len(st.data) == 0:
        return RedirectResponse(f"{frontend}/observability?linkedin=error")
        
    supabase.table("oauth_states").delete().eq("state", state).execute()
    
    try:
        token = publisher.linkedin_exchange_code(code, os.environ["LINKEDIN_REDIRECT_URI"])
        access_token = token["access_token"]
        info = publisher.linkedin_userinfo(access_token)
        supabase.table("social_tokens").upsert({
            "platform": "linkedin", "access_token": access_token, "sub": info.get("sub"), 
            "name": info.get("name"), "updated_at": now_iso()
        }, on_conflict="platform").execute()
    except Exception as e:
        logger.error(f"LinkedIn callback error: {e}")
        return RedirectResponse(f"{frontend}/observability?linkedin=error")
    return RedirectResponse(f"{frontend}/observability?linkedin=connected")

async def _do_publish(atom: dict) -> dict:
    platform = atom["platform"]
    if platform == "Twitter/X":
        token_res = supabase.table("social_tokens").select("*").eq("platform", "twitter").execute()
        token = (token_res.data[0] or {}).get("access_token") if token_res.data else os.environ.get("TWITTER_ACCESS_TOKEN")
        if not token:
            raise ValueError("Twitter/X bağlı değil")
        try:
            return publisher.publish_twitter(token, atom)
        except publisher.TokenExpired:
            rt = (token_res.data[0] or {}).get("refresh_token") if token_res.data else os.environ.get("TWITTER_ACCESS_TOKEN_SECRET")
            new = publisher.refresh_twitter(rt)
            if not new:
                raise ValueError("Twitter token yenilenemedi (Client Secret gerekli)")
            supabase.table("social_tokens").upsert({
                "platform": "twitter", "access_token": new["access_token"], "refresh_token": new.get("refresh_token", rt), "updated_at": now_iso()
            }, on_conflict="platform").execute()
            return publisher.publish_twitter(new["access_token"], atom)
            
    if platform == "LinkedIn":
        li_res = supabase.table("social_tokens").select("*").eq("platform", "linkedin").execute()
        li = li_res.data[0] if li_res.data else None
        if not li or not li.get("access_token"):
            raise ValueError("LinkedIn bağlı değil")
        return publisher.publish_linkedin(li["access_token"], li.get("sub"), atom["content"])
    raise ValueError("Bu platform için yayın desteklenmiyor")

@api_router.post("/atoms/{atom_id}/publish")
async def publish_atom(atom_id: str, user: dict = Depends(get_current_user)):
    atom_res = supabase.table("atoms").select("*").eq("id", atom_id).execute()
    if not atom_res.data or len(atom_res.data) == 0:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    atom = atom_res.data[0]
    
    if not atom.get("content"):
        raise HTTPException(status_code=400, detail="Önce içerik üretin")
    if atom["status"] != "approved":
        raise HTTPException(status_code=400, detail="Yayınlamadan önce atomu onaylayın")
        
    try:
        result = await _do_publish(atom)
    except (publisher.PublishError, ValueError) as e:
        await log_job(atom_id, atom["type"], "error", str(e))
        raise HTTPException(status_code=400, detail=str(e))
        
    supabase.table("atoms").update({
        "published": True, "publish_platform": atom["platform"], "publish_url": result["url"], "published_at": now_iso(), "dead": False,
    }).eq("id", atom_id).execute()
    
    await log_job(atom_id, atom["type"], "success", f"Yayınlandı: {result['url']}")
    await notifications.notify_published(atom, result["url"])
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
    atom = supabase.table("atoms").select("*").eq("id", atom_id).execute().data[0]
    if not atom:
        raise HTTPException(status_code=404, detail="Atom bulunamadı")
    if atom["status"] != "approved" or not atom.get("content"):
        raise HTTPException(status_code=400, detail="Yalnızca onaylı ve üretilmiş atomlar zamanlanabilir")
    if atom["platform"] not in ("Twitter/X", "LinkedIn"):
        raise HTTPException(status_code=400, detail="Bu platform için zamanlama desteklenmiyor")
        
    supabase.table("atoms").update({"scheduled_at": _parse_dt(data.scheduled_at).isoformat(), "dead": False, "publish_attempts": 0, "last_error": None}).eq("id", atom_id).execute()
    return {"ok": True}

@api_router.post("/atoms/{atom_id}/unschedule")
async def unschedule_atom(atom_id: str, user: dict = Depends(get_current_user)):
    supabase.table("atoms").update({"scheduled_at": None}).eq("id", atom_id).execute()
    return {"ok": True}

TR_UTC_OFFSET = 3
PLATFORM_SLOTS_LOCAL = {"LinkedIn": [(8, 0), (12, 0), (17, 30)], "Twitter/X": [(9, 0), (12, 30), (15, 0), (20, 0)]}
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
    rows = supabase.table("atoms").select("scheduled_at").eq("platform", platform).not_.is_("scheduled_at", "null").not_.eq("published", True).execute().data
    taken = set()
    for r in rows:
        t = r.get("scheduled_at")
        if t:
            try:
                dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
                taken.add(dt.replace(second=0, microsecond=0, tzinfo=None))
            except Exception:
                pass
    return taken

async def _auto_schedule_atom(atom: dict):
    if atom.get("platform") not in ("Twitter/X", "LinkedIn"):
        return None
    if not atom.get("content") or atom.get("published") or atom.get("scheduled_at"):
        return None
    taken = await _taken_slots(atom["platform"])
    for s in _candidate_slots(atom["platform"], 400):
        if s.replace(tzinfo=None) not in taken:
            supabase.table("atoms").update({
                "scheduled_at": s.isoformat(), "dead": False, "publish_attempts": 0, "last_error": None
            }).eq("id", atom["id"]).execute()
            return s
    return None

@api_router.post("/schedule/auto")
async def auto_schedule(user: dict = Depends(get_current_user)):
    atoms = supabase.table("atoms").select("*").eq("status", "approved").not_.eq("published", True).is_("scheduled_at", "null").in_("platform", ["Twitter/X", "LinkedIn"]).execute().data
    count = 0
    for atom in atoms:
        if await _auto_schedule_atom(atom):
            count += 1
    return {"scheduled": count}

@api_router.get("/schedule")
async def get_schedule(user: dict = Depends(get_current_user)):
    unscheduled = supabase.table("atoms").select("id, article_id, type, label, platform, category, aspect, index, auto_approve, status, content, media_type, media_choice, notes, published, publish_platform, publish_url, published_at, scheduled_at, publish_attempts, last_error, dead, created_at, updated_at").eq("status", "approved").not_.eq("published", True).is_("scheduled_at", "null").in_("platform", ["Twitter/X", "LinkedIn"]).execute().data
    
    timeline = supabase.table("atoms").select("id, article_id, type, label, platform, category, aspect, index, auto_approve, status, content, media_type, media_choice, notes, published, publish_platform, publish_url, published_at, scheduled_at, publish_attempts, last_error, dead, created_at, updated_at").not_.is_("scheduled_at", "null").order("scheduled_at", desc=False).execute().data
    
    articles = supabase.table("articles").select("id, title").execute().data
    title_map = {a["id"]: a["title"] for a in articles}
    
    for a in unscheduled + timeline:
        a["article_title"] = title_map.get(a["article_id"], "")
        
    return {"unscheduled": unscheduled, "timeline": timeline}

async def scheduled_publisher():
    now = datetime.now(timezone.utc)
    due = supabase.table("atoms").select("*").not_.is_("scheduled_at", "null").lte("scheduled_at", now.isoformat()).not_.eq("published", True).not_.eq("dead", True).eq("status", "approved").execute().data
    
    for atom in due:
        try:
            result = await _do_publish(atom)
            supabase.table("atoms").update({
                "published": True, "publish_platform": atom["platform"], "publish_url": result["url"], "published_at": now.isoformat(),
            }).eq("id", atom["id"]).execute()
            await log_job(atom["id"], atom["type"], "success", f"Zamanlı yayın: {result['url']}")
            await notifications.notify_published(atom, result["url"])
        except Exception as e:
            attempts = atom.get("publish_attempts", 0) + 1
            dead = attempts >= 3
            supabase.table("atoms").update({"publish_attempts": attempts, "last_error": str(e), "dead": dead}).eq("id", atom["id"]).execute()
            await log_job(atom["id"], atom["type"], "error", f"Zamanlı yayın hatası (deneme {attempts}{'/DLQ' if dead else ''}): {e}")

# ---------- dashboard / observability ----------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    total_articles = len(supabase.table("articles").select("id", count="exact").execute().data or [])
    analyzed = len(supabase.table("articles").select("id", count="exact").eq("status", "analyzed").execute().data or [])
    total_atoms = len(supabase.table("atoms").select("id", count="exact").execute().data or [])
    published = len(supabase.table("atoms").select("id", count="exact").eq("published", True).execute().data or [])
    
    by_status = {}
    for s in ["draft", "review", "approved", "rejected"]:
        by_status[s] = len(supabase.table("atoms").select("id", count="exact").eq("status", s).execute().data or [])
        
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    quota_res = supabase.table("quotas").select("*").eq("date", today).execute()
    quota = quota_res.data[0] if quota_res.data else {}
    
    return {
        "total_articles": total_articles, "analyzed_articles": analyzed, "total_atoms": total_atoms, "published": published,
        "atoms_by_status": by_status,
        "quota_today": {"gemini_text": quota.get("gemini_text", 0), "gemini_image": quota.get("gemini_image", 0), "openai_tts": quota.get("openai_tts", 0)},
    }

@api_router.get("/quotas")
async def get_quotas(user: dict = Depends(get_current_user)):
    return supabase.table("quotas").select("*").order("date", desc=True).limit(30).execute().data

@api_router.get("/jobs")
async def get_jobs(user: dict = Depends(get_current_user)):
    return supabase.table("jobs").select("*").order("created_at", desc=True).limit(100).execute().data

@api_router.get("/blueprint")
async def get_blueprint(user: dict = Depends(get_current_user)):
    return {"blueprint": bp.BLUEPRINT, "total": bp.total_atom_count()}

@api_router.get("/analytics")
async def analytics(user: dict = Depends(get_current_user)):
    pub = supabase.table("atoms").select("id, platform, label, published_at").eq("published", True).execute().data
    dead = supabase.table("atoms").select("id, platform, label, last_error").eq("dead", True).execute().data
    scheduled_total = len(supabase.table("atoms").select("id", count="exact").not_.is_("scheduled_at", "null").not_.eq("published", True).not_.eq("dead", True).execute().data or [])
    
    by_platform, by_type = {}, {}
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
    
    dlq = [{"id": a["id"], "platform": a["platform"], "label": a["label"], "last_error": a.get("last_error")} for a in dead]
    
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
    await auth.seed_admin(supabase)
    existing = supabase.table("social_tokens").select("*").eq("platform", "twitter").execute()
    if (not existing.data or len(existing.data) == 0) and os.environ.get("TWITTER_ACCESS_TOKEN"):
        supabase.table("social_tokens").insert({
            "platform": "twitter", "access_token": os.environ["TWITTER_ACCESS_TOKEN"],
            "refresh_token": os.environ.get("TWITTER_ACCESS_TOKEN_SECRET"), "updated_at": now_iso(),
        }).execute()
    
    scheduler.add_job(scheduled_publisher, "interval", minutes=1, id="publisher", replace_existing=True)
    if not scheduler.running:
        scheduler.start()
    logger.info("content-studio backend ready")

@app.on_event("shutdown")
async def shutdown():
    pass # Supabase client otomatik yönetilir