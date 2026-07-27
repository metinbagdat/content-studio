"""AI provider abstraction with free fallbacks (Groq text, HF image, Edge-TTS)."""
import os
import base64
import requests
import edge_tts
from emergentintegrations.llm.chat import LlmChat, UserMessage

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
    # Prefer free Groq when configured; fall back to Emergent (Gemini).
    if GROQ_API_KEY:
        return _groq_text(system, prompt)
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=session_id, system_message=system).with_model("gemini", TEXT_MODEL)
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


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


async def generate_image(prompt: str, session_id: str) -> str | None:
    if HF_TOKEN:
        try:
            return _hf_image(prompt)
        except Exception as e:
            raise RuntimeError(
                "Görsel üretimi ücretsiz Hugging Face planında şu an kullanılamıyor "
                "(modeller kaldırıldı/kredi gerekiyor). Metin ve ses ücretsiz çalışıyor; "
                "görsel için Emergent bütçesi veya HF Pro gerekir."
            )
    chat = LlmChat(
        api_key=EMERGENT_KEY, session_id=session_id,
        system_message="You are an expert educational graphic designer.",
    ).with_model("gemini", IMAGE_MODEL).with_params(modalities=["image", "text"])
    _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if images:
        return images[0]["data"]
    return None


async def generate_audio(text: str, voice: str = "tr-TR-EmelNeural") -> str:
    communicate = edge_tts.Communicate(text[:3000], voice)
    audio = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return base64.b64encode(audio).decode("utf-8")
