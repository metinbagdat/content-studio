"""AI provider abstraction with free fallbacks (Groq text, HF image, Edge-TTS)."""
import os
import io
import base64
import requests
import logging
import edge_tts
from PIL import Image, ImageDraw, ImageFont

# emergentintegrations yorum satırı yapıldı
# from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
HF_TOKEN = os.environ.get("HF_TOKEN")

TEXT_MODEL = "gemini-3.5-flash"
IMAGE_MODEL = "gemini-3.1-flash-image-preview"
GROQ_MODEL = "llama-3.3-70b-versatile"
HF_IMAGE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"


def _groq_text(system: str, prompt: str) -> str:
    r = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": GROQ_MODEL,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "temperature": 0.8,
        },
        timeout=60,
    )
    if r.status_code == 200:
        return r.json()["choices"][0]["message"]["content"]
    raise RuntimeError(f"Groq {r.status_code}: {r.text[:200]}")


async def generate_text(system: str, prompt: str, session_id: str) -> str:
    # 1. Tercih: Ücretsiz Groq API
    if GROQ_API_KEY:
        return _groq_text(system, prompt)
    
    # 2. Fallback: Emergent kaldırıldığı için, API key yoksa sunucunun çökmemesi için mock veri döndür
    logger.warning("GROQ_API_KEY bulunamadı. Metin üretimi için mock (sahte) yanıt döndürülüyor.")
    return f"[MOCK YANIT] {prompt[:100]}... (Gerçek metin için .env dosyasına GROQ_API_KEY ekleyin)"


def _hf_image(prompt: str) -> str:
    r = requests.post(
        f"https://router.huggingface.co/hf-inference/models/{HF_IMAGE_MODEL}",
        headers={"Authorization": f"Bearer {HF_TOKEN}"},
        json={"inputs": prompt, "options": {"wait_for_model": True}},
        timeout=120,
    )
    ctype = r.headers.get("content-type", "")
    if r.status_code == 200 and ctype.startswith("image"):
        return base64.b64encode(r.content).decode("utf-8")
    raise RuntimeError(f"HF {r.status_code}: {r.text[:200]}")


import urllib.parse as _urlparse

POLLINATIONS_KEY = os.environ.get("POLLINATIONS_API_KEY")
POLLINATIONS_MODEL = os.environ.get("POLLINATIONS_MODEL", "nanobanana-2-lite")


def _pollinations_free(prompt: str, width: int, height: int) -> str:
    p = _urlparse.quote(prompt[:1000])
    url = f"https://image.pollinations.ai/prompt/{p}?width={width}&height={height}&nologo=true"
    r = requests.get(url, timeout=120)
    if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
        return base64.b64encode(r.content).decode("utf-8")
    raise RuntimeError(f"Pollinations(free) {r.status_code}: {r.text[:150]}")


def _pollinations_image(prompt: str, width: int = 1024, height: int = 1024) -> str:
    # Prefer paid nanobanana model when a key + balance is available; otherwise
    # fall back to the free keyless endpoint (402 = no balance, 403 = no access).
    if POLLINATIONS_KEY:
        p = _urlparse.quote(prompt[:1000])
        url = f"https://gen.pollinations.ai/image/{p}?model={POLLINATIONS_MODEL}&width={width}&height={height}"
        r = requests.get(url, headers={"Authorization": f"Bearer {POLLINATIONS_KEY}"}, timeout=120)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
            return base64.b64encode(r.content).decode("utf-8")
        if r.status_code not in (402, 403):
            raise RuntimeError(f"Pollinations {r.status_code}: {r.text[:150]}")
    return _pollinations_free(prompt, width, height)


async def generate_image(prompt: str, session_id: str, width: int = 1024, height: int = 1024) -> str | None:
    return _pollinations_image(prompt, width, height)


_ASPECT_SIZE = {"1:1": (1024, 1024), "16:9": (1280, 720), "9:16": (720, 1280), "2:3": (768, 1152)}
_FONT_PATH = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"


def aspect_size(aspect: str) -> tuple[int, int]:
    return _ASPECT_SIZE.get(aspect, (1024, 1024))


def apply_watermark(b64_img: str, text: str = "eğitim.today") -> str:
    """Overlay a semi-transparent 'eğitim.today' label with an indigo dot in the bottom-left."""
    img = Image.open(io.BytesIO(base64.b64decode(b64_img))).convert("RGBA")
    W, H = img.size
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font_size = max(20, int(H * 0.038))
    try:
        font = ImageFont.truetype(_FONT_PATH, font_size)
    except Exception:
        font = ImageFont.load_default()
    margin = int(H * 0.045)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    dot_r = int(font_size * 0.32)
    gap = int(font_size * 0.45)
    x = margin
    y = H - margin - th
    cy = y + th // 2 + bbox[1]
    # readability shadow
    draw.text((x + dot_r * 2 + gap + 2, y + 2), text, font=font, fill=(0, 0, 0, 150))
    # indigo brand accent dot
    draw.ellipse([x, cy - dot_r, x + dot_r * 2, cy + dot_r], fill=(94, 106, 210, 240))
    draw.text((x + dot_r * 2 + gap, y), text, font=font, fill=(255, 255, 255, 240))
    out = Image.alpha_composite(img, overlay).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


async def generate_audio(text: str, voice: str = "tr-TR-EmelNeural") -> str:
    communicate = edge_tts.Communicate(text[:3000], voice)
    audio = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return base64.b64encode(audio).decode("utf-8")
