"""Atomization blueprint engine and content-generation prompt builders."""

# Default blueprint: type -> metadata. count = number of atoms produced.
BLUEPRINT = [
    {"type": "long_video_script", "label": "Uzun Video Senaryosu", "platform": "YouTube", "category": "text", "aspect": "16:9", "count": 1, "auto_approve": False},
    {"type": "short_video_script", "label": "Kısa Video Senaryosu", "platform": "TikTok/Reels", "category": "text", "aspect": "9:16", "count": 3, "auto_approve": False},
    {"type": "podcast_script", "label": "Podcast Bölümü", "platform": "Podcast", "category": "audio", "aspect": "-", "count": 1, "auto_approve": False},
    {"type": "song", "label": "Şarkı", "platform": "Müzik", "category": "audio", "aspect": "-", "count": 1, "auto_approve": False},
    {"type": "anthem", "label": "Marş", "platform": "Müzik", "category": "audio", "aspect": "-", "count": 1, "auto_approve": False},
    {"type": "social_card", "label": "Sosyal Medya Kartı", "platform": "Instagram", "category": "image", "aspect": "1:1", "count": 6, "auto_approve": False},
    {"type": "twitter_post", "label": "Twitter/X Post", "platform": "Twitter/X", "category": "text", "aspect": "-", "count": 10, "auto_approve": True},
    {"type": "twitter_thread", "label": "Twitter/X Thread", "platform": "Twitter/X", "category": "text", "aspect": "-", "count": 2, "auto_approve": False},
    {"type": "linkedin_post", "label": "LinkedIn Post", "platform": "LinkedIn", "category": "text", "aspect": "-", "count": 5, "auto_approve": True},
    {"type": "linkedin_carousel", "label": "LinkedIn Carousel", "platform": "LinkedIn", "category": "text", "aspect": "1:1", "count": 1, "auto_approve": False},
    {"type": "instagram_post", "label": "Instagram Post/Story", "platform": "Instagram", "category": "text", "aspect": "9:16", "count": 10, "auto_approve": True},
    {"type": "facebook_post", "label": "Facebook Post", "platform": "Facebook", "category": "text", "aspect": "-", "count": 5, "auto_approve": True},
    {"type": "pinterest_pin", "label": "Pinterest Pin", "platform": "Pinterest", "category": "text", "aspect": "2:3", "count": 3, "auto_approve": True},
    {"type": "thumbnail", "label": "YouTube Thumbnail", "platform": "YouTube", "category": "image", "aspect": "16:9", "count": 1, "auto_approve": False},
]


def total_atom_count() -> int:
    return sum(b["count"] for b in BLUEPRINT)


ANALYSIS_SYSTEM = (
    "Sen eğitim.today için uzman bir içerik stratejistisin. Verilen makaleyi analiz eder, "
    "yalnızca geçerli JSON döndürürsün. Türkçe yanıt ver."
)


def analysis_prompt(title: str, content: str) -> str:
    return (
        "Aşağıdaki makaleyi analiz et ve SADECE şu JSON şemasında yanıt ver (markdown yok):\n"
        '{"summary": "2-3 cümle özet", "concepts": ["ana konsept", ...], '
        '"quotes": ["alıntılanabilir cümle", ...], "audience": "hedef kitle", '
        '"tone": "içeriğin tonu", "key_points": ["önemli nokta", ...]}\n\n'
        f"BAŞLIK: {title}\n\nMAKALE:\n{content[:6000]}"
    )


CONTENT_SYSTEM = (
    "Sen eğitim.today için deneyimli bir sosyal medya ve içerik editörüsün. "
    "Akıcı, etkileyici ve platforma uygun Türkçe içerik üretirsin. Sadece istenen içeriği "
    "döndür, açıklama ekleme."
)

_INSTRUCTIONS = {
    "long_video_script": "5-8 dakikalık bir YouTube eğitim videosu için sahne sahne senaryo yaz. Giriş kancası, ana bölümler, örnekler ve kapanış CTA içersin.",
    "short_video_script": "30-60 saniyelik dikey kısa video (Reels/Shorts/TikTok) senaryosu yaz. İlk 3 saniyede güçlü bir kanca olsun, sahne yönergeleri ve altyazı metni ekle.",
    "podcast_script": "Tek konuşmacılı 3-4 dakikalık bir podcast bölümü metni yaz. Doğal, sohbet havasında ve seslendirmeye uygun olsun.",
    "song": "Makalenin temasını işleyen, eğitici ve ilham verici Türkçe bir şarkı sözü yaz. Kıta ve nakarat yapısı olsun.",
    "anthem": "Makalenin ruhunu yansıtan, coşkulu ve birleştirici Türkçe bir marş sözü yaz. Güçlü ve ritmik olsun.",
    "twitter_post": "Tek bir Twitter/X postu yaz (280 karakter altı). 1-2 emoji, 2-3 hashtag ve net bir mesaj içersin.",
    "twitter_thread": "5-7 tweet'lik bir Twitter/X thread yaz. Her tweet'i '1/' formatında numaralandır, ilk tweet güçlü kanca olsun, son tweet CTA içersin.",
    "linkedin_post": "Profesyonel bir LinkedIn postu yaz. Değer odaklı, satırları kısa, 3-5 hashtag ve bir soru/CTA ile bitsin.",
    "linkedin_carousel": "LinkedIn carousel için 6 slayt metni yaz. Her slaytı 'Slayt 1:' formatında başlıkla, kısa ve etkili olsun.",
    "instagram_post": "Instagram için ilgi çekici bir caption yaz. Emoji kullan, satır aralıkları bırak, sonunda 8-12 hashtag ekle.",
    "facebook_post": "Samimi ve paylaşılabilir bir Facebook postu yaz. Hikaye anlatımı ve bir soru/CTA içersin, 1-2 hashtag.",
    "pinterest_pin": "Pinterest pin açıklaması yaz. SEO odaklı, anahtar kelime zengin ve 2-4 hashtag içeren kısa bir metin.",
}

_IMAGE_INSTRUCTIONS = {
    "social_card": "kare (1:1) sosyal medya bilgi kartı, modern editorial tasarım, koyu arkaplan, minimal tipografi",
    "thumbnail": "geniş (16:9) YouTube küçük resmi, dikkat çekici, yüksek kontrast, büyük başlık alanı",
}

_TTS_VOICE = {"podcast_script": "onyx", "song": "nova", "anthem": "echo"}


def text_prompt(atom_type: str, idx: int, article: dict, analysis: dict) -> str:
    instr = _INSTRUCTIONS.get(atom_type, "Makaleye dayalı kısa bir sosyal medya metni yaz.")
    concepts = ", ".join(analysis.get("concepts", [])[:5]) if analysis else ""
    return (
        f"{instr}\n\n"
        f"Bu, bu türden {idx + 1}. içerik — öncekilerden farklı bir açı/konsept işle.\n"
        f"MAKALE BAŞLIĞI: {article.get('title', '')}\n"
        f"ANA KONSEPTLER: {concepts}\n"
        f"HEDEF KİTLE: {article.get('target_audience') or (analysis.get('audience') if analysis else '')}\n"
        f"TON: {analysis.get('tone', '') if analysis else ''}\n\n"
        f"MAKALE ÖZETİ: {analysis.get('summary', '') if analysis else article.get('content', '')[:1500]}"
    )


def image_prompt(atom_type: str, article: dict, analysis: dict) -> str:
    style = _IMAGE_INSTRUCTIONS.get(atom_type, "modern editorial görsel")
    concepts = ", ".join(analysis.get("concepts", [])[:3]) if analysis else ""
    return (
        f"Educational social media graphic. Style: {style}. "
        f"Topic: {article.get('title', '')}. Key concepts: {concepts}. "
        "Turkish education brand 'eğitim.today', dark theme, indigo accent (#5E6AD2), "
        "clean typography, professional, no watermark."
    )


def tts_voice(atom_type: str) -> str:
    return _TTS_VOICE.get(atom_type, "alloy")
