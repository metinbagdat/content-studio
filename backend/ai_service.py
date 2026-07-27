"""AI provider abstraction (Gemini text/image + OpenAI TTS via Emergent key)."""
import os
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAITextToSpeech

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

TEXT_MODEL = "gemini-3.5-flash"
IMAGE_MODEL = "gemini-3.1-flash-image-preview"


async def generate_text(system: str, prompt: str, session_id: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_KEY, session_id=session_id, system_message=system
    ).with_model("gemini", TEXT_MODEL)
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


async def generate_image(prompt: str, session_id: str) -> str | None:
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=session_id,
        system_message="You are an expert educational graphic designer.",
    ).with_model("gemini", IMAGE_MODEL).with_params(modalities=["image", "text"])
    _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if images:
        return images[0]["data"]  # base64 string
    return None


async def generate_audio(text: str, voice: str = "alloy") -> str:
    tts = OpenAITextToSpeech(api_key=EMERGENT_KEY)
    audio_bytes = await tts.generate_speech(
        text=text[:4000], model="tts-1", voice=voice, response_format="mp3"
    )
    return base64.b64encode(audio_bytes).decode("utf-8")
