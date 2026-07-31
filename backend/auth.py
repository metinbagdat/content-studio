import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException

JWT_ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    # .env'de yoksa çökmemesi için varsayılan bir değer ekledim
    return os.environ.get("JWT_SECRET", "super-secret-dev-key-change-in-production")

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def _extract_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    token = request.cookies.get("access_token")
    if token:
        return token
    raise HTTPException(status_code=401, detail="Kimlik doğrulanmadı")

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Geçersiz token tipi")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")


# ==========================================================
# BURASI DEĞİŞTİ: MongoDB yerine Supabase kullanacak şekilde güncellendi
# ==========================================================
async def seed_admin(supabase):
    email = os.environ.get("ADMIN_EMAIL", "admin@egitim.today")
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    # 1. Supabase'den kullanıcıyı kontrol et
    response = supabase.table("users").select("*").eq("email", email).execute()
    existing = response.data[0] if response.data else None
    
    # 2. Kullanıcı yoksa oluştur
    if existing is None:
        supabase.table("users").insert({
            "email": email,
            "password_hash": hash_password(password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        print(f"✅ Varsayılan admin oluşturuldu: {email} / {password}")
        
    # 3. Kullanıcı var ama şifresi farklıysa güncelle
    elif not verify_password(password, existing["password_hash"]):
        supabase.table("users").update({
            "password_hash": hash_password(password)
        }).eq("email", email).execute()
        print(f"✅ Admin şifresi güncellendi: {email}")