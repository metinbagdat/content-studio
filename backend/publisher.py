"""Social publishing provider abstraction (Twitter/X first)."""
import os
import re
import requests

TWEET_URL = "https://api.twitter.com/2/tweets"
ME_URL = "https://api.twitter.com/2/users/me"


class PublishError(Exception):
    pass


async def get_twitter_token(db) -> str | None:
    row = await db.social_tokens.find_one({"platform": "twitter"})
    if row and row.get("access_token"):
        return row["access_token"]
    return os.environ.get("TWITTER_ACCESS_TOKEN")


def verify_twitter(token: str) -> dict | None:
    try:
        r = requests.get(ME_URL, headers={"Authorization": f"Bearer {token}"}, timeout=20)
        if r.status_code == 200:
            return r.json().get("data")
    except Exception:
        pass
    return None


def _tweet(token: str, text: str, reply_to: str | None = None) -> str:
    body = {"text": text[:280]}
    if reply_to:
        body["reply"] = {"in_reply_to_tweet_id": reply_to}
    r = requests.post(
        TWEET_URL,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    if r.status_code in (200, 201):
        return r.json()["data"]["id"]
    # surface a clean error message
    try:
        j = r.json()
        msg = j.get("detail") or j.get("title") or str(j)
    except Exception:
        msg = r.text
    raise PublishError(f"X API {r.status_code}: {msg}")


def _split_thread(content: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]
    if len(parts) <= 1:
        parts = [p.strip() for p in re.split(r"(?m)^\s*\d+\s*[/\.]", content) if p.strip()]
    return parts or [content]


def publish_twitter(token: str, atom: dict) -> dict:
    if atom["type"] == "twitter_thread":
        parts = _split_thread(atom["content"])
        reply = None
        first_id = None
        for p in parts:
            tid = _tweet(token, p, reply)
            reply = tid
            first_id = first_id or tid
        return {"url": f"https://x.com/i/status/{first_id}", "id": first_id}
    tid = _tweet(token, atom["content"])
    return {"url": f"https://x.com/i/status/{tid}", "id": tid}
