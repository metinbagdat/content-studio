"""Social publishing provider abstraction (Twitter/X first)."""
import os
import re
import requests

TWEET_URL = "https://api.twitter.com/2/tweets"
ME_URL = "https://api.twitter.com/2/users/me"


class PublishError(Exception):
    pass


class TokenExpired(Exception):
    pass


def refresh_twitter(refresh_token: str | None) -> dict | None:
    import base64
    cid = os.environ.get("TWITTER_CLIENT_ID")
    csec = os.environ.get("TWITTER_CLIENT_SECRET")
    if not cid or not refresh_token:
        return None
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    if csec:
        basic = base64.b64encode(f"{cid}:{csec}".encode()).decode()
        headers["Authorization"] = f"Basic {basic}"
    data = {"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": cid}
    try:
        r = requests.post("https://api.twitter.com/2/oauth2/token", data=data, headers=headers, timeout=30)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


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
    if r.status_code == 401:
        raise TokenExpired()
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


# ---------- LinkedIn ----------
LI_VERSION = os.environ.get("LINKEDIN_VERSION", "202607")


def linkedin_exchange_code(code: str, redirect_uri: str) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": os.environ["LINKEDIN_CLIENT_ID"],
        "client_secret": os.environ["LINKEDIN_CLIENT_SECRET"],
    }
    r = requests.post("https://www.linkedin.com/oauth/v2/accessToken", data=data, timeout=30)
    if r.status_code != 200:
        raise PublishError(f"LinkedIn token {r.status_code}: {r.text}")
    return r.json()


def linkedin_userinfo(token: str) -> dict:
    r = requests.get("https://api.linkedin.com/v2/userinfo", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    if r.status_code != 200:
        raise PublishError(f"LinkedIn userinfo {r.status_code}: {r.text}")
    return r.json()


def verify_linkedin(token: str) -> dict | None:
    try:
        r = requests.get("https://api.linkedin.com/v2/userinfo", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def _li_escape(text: str) -> str:
    for ch in "()[]{}<>":
        text = text.replace(ch, "\\" + ch)
    return text


def publish_linkedin(token: str, sub: str, text: str) -> dict:
    payload = {
        "author": f"urn:li:person:{sub}",
        "commentary": _li_escape(text[:2900]),
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    r = requests.post(
        "https://api.linkedin.com/rest/posts",
        headers={
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": LI_VERSION,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    if r.status_code in (200, 201):
        pid = r.headers.get("x-restli-id") or ""
        return {"url": f"https://www.linkedin.com/feed/update/{pid}", "id": pid}
    try:
        j = r.json()
        msg = j.get("message") or j.get("detail") or str(j)
    except Exception:
        msg = r.text
    raise PublishError(f"LinkedIn API {r.status_code}: {msg}")
