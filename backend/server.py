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
from datetime import datetime, timezone

import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional

import auth
import blueprint as bp
import ai_service

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


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
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
    if atoms:
        await db.atoms.insert_many(atoms)
    return {"analysis": analysis, "atom_count": len(atoms)}


@api_router.get("/articles/{article_id}/atoms")
async def article_atoms(article_id: str, user: dict = Depends(get_current_user)):
    atoms = await db.atoms.find({"article_id": article_id}, {"_id": 0, "media": 0}).to_list(1000)
    return atoms


# ---------- atoms ----------
@api_router.get("/atoms")
async def list_atoms(status: Optional[str] = None, include_media: bool = False, user: dict = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    proj = {"_id": 0} if include_media else {"_id": 0, "media": 0}
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
        b64 = await ai_service.generate_image(prompt, session_id=f"img-{atom['id']}")
        await bump_quota("gemini_image")
        if not b64:
            raise RuntimeError("Görsel üretilemedi")
        updates["media_type"] = "image"
        updates["media"] = b64
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
    return await db.atoms.find_one({"id": atom_id}, {"_id": 0})


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
    return {"ok": True}


@api_router.post("/atoms/{atom_id}/reject")
async def reject_atom(atom_id: str, user: dict = Depends(get_current_user)):
    await db.atoms.update_one({"id": atom_id}, {"$set": {"status": "rejected", "updated_at": now_iso()}})
    return {"ok": True}


@api_router.post("/atoms/bulk-approve")
async def bulk_approve(data: BulkIds, user: dict = Depends(get_current_user)):
    await db.atoms.update_many({"id": {"$in": data.ids}}, {"$set": {"status": "approved", "updated_at": now_iso()}})
    return {"ok": True, "count": len(data.ids)}


# ---------- dashboard / observability ----------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    total_articles = await db.articles.count_documents({})
    analyzed = await db.articles.count_documents({"status": "analyzed"})
    total_atoms = await db.atoms.count_documents({})
    by_status = {}
    for s in ["draft", "review", "approved", "rejected"]:
        by_status[s] = await db.atoms.count_documents({"status": s})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    quota = await db.quotas.find_one({"date": today}, {"_id": 0}) or {}
    return {
        "total_articles": total_articles,
        "analyzed_articles": analyzed,
        "total_atoms": total_atoms,
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
    await db.users.create_index("email", unique=True)
    await db.articles.create_index("content_hash")
    await db.atoms.create_index("article_id")
    await db.atoms.create_index("status")
    logger.info("content-studio backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
