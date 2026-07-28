"""Fire-and-forget publish notifications via Slack Incoming Webhook + Resend email.

Never raises: a failed notification must not break the publish flow.
"""
import os
import asyncio
import logging

import requests
import resend

logger = logging.getLogger("notifications")

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "eğitim.today <onboarding@resend.dev>")
NOTIFY_EMAIL = os.environ.get("NOTIFY_EMAIL")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _send_slack(text: str, blocks: list | None = None) -> None:
    if not SLACK_WEBHOOK_URL:
        return
    try:
        payload = {"text": text}
        if blocks:
            payload["blocks"] = blocks
        r = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
        if r.status_code >= 300:
            logger.warning("Slack webhook %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Slack notification failed: %s", e)


def _send_email(subject: str, html: str) -> None:
    if not (RESEND_API_KEY and NOTIFY_EMAIL):
        return
    try:
        resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [NOTIFY_EMAIL],
            "subject": subject,
            "html": html,
        })
    except Exception as e:
        logger.warning("Resend email failed: %s", e)


async def notify_published(atom: dict, url: str) -> None:
    """Notify Slack + email that an atom was published. Fully non-blocking, never raises."""
    platform = atom.get("platform", "")
    label = atom.get("label", "İçerik")
    idx = atom.get("index", 0) + 1
    title = f"{label} #{idx}"
    content = (atom.get("content") or "").strip()
    snippet = content[:280] + ("…" if len(content) > 280 else "")

    text = f"✅ Yayınlandı: *{title}* — {platform}\n{url}"
    blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": "✅ İçerik Yayınlandı", "emoji": True}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Platform:*\n{platform}"},
            {"type": "mrkdwn", "text": f"*İçerik:*\n{title}"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"{snippet or '_(medya içeriği)_'}"}},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"<{url}|Gönderiyi görüntüle →>"}},
        {"type": "context", "elements": [{"type": "mrkdwn", "text": "content-studio · eğitim.today"}]},
    ]

    html = f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;background:#0f1011;border-radius:12px;padding:28px;color:#ffffff">
      <div style="display:inline-block;background:#27C281;color:#000;font-weight:bold;font-size:12px;padding:4px 10px;border-radius:999px">YAYINLANDI</div>
      <h2 style="margin:16px 0 4px;font-size:20px">{title}</h2>
      <p style="margin:0 0 16px;color:#8A8F98;font-size:13px">{platform} · content-studio</p>
      <div style="background:#191A1B;border:1px solid #2A2E33;border-radius:10px;padding:16px;color:#e6e6e6;font-size:14px;line-height:1.6;white-space:pre-wrap">{snippet or "(medya içeriği)"}</div>
      <a href="{url}" style="display:inline-block;margin-top:20px;background:#5E6AD2;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;font-size:14px">Gönderiyi Görüntüle →</a>
      <p style="margin-top:24px;color:#8A8F98;font-size:12px">eğitim.today İçerik Atomizasyon &amp; Otomatik Yayın Platformu</p>
    </div>
    """

    await asyncio.gather(
        asyncio.to_thread(_send_slack, text, blocks),
        asyncio.to_thread(_send_email, f"✅ Yayınlandı: {title} ({platform})", html),
    )
