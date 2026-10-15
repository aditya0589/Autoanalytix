import os
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
import jwt
import bcrypt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def create_access_token(subject: str | Any, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.APP_SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

# --- BYOK Credential Encryption (AES-GCM) ---

def _get_aes_key() -> bytes:
    raw = settings.CREDENTIAL_ENCRYPTION_KEY
    try:
        key_bytes = base64.urlsafe_b64decode(raw)
        if len(key_bytes) == 32:
            return key_bytes
    except Exception:
        pass
    import hashlib
    return hashlib.sha256(raw.encode("utf-8")).digest()

def encrypt_credential(plaintext_secret: str) -> str:
    """Encrypts an API key using authenticated AES-GCM. Returns base64 encoded nonce+ciphertext+tag."""
    if not plaintext_secret:
        return ""
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    ciphertext = aesgcm.encrypt(nonce, plaintext_secret.encode("utf-8"), None)
    payload = nonce + ciphertext
    return base64.b64encode(payload).decode("utf-8")

LEGACY_KEYS = [
    b"autoanalytix-32bytes-secretkey!!",
    base64.urlsafe_b64decode("YXV0b2FuYWx5dGl4LTMyYnl0ZXMtc2VjcmV0a2V5ISE=")
]

def decrypt_credential(encrypted_secret: str) -> str:
    """Decrypts an AES-GCM encrypted API key. Returns plaintext."""
    if not encrypted_secret:
        return ""
    try:
        raw_payload = base64.b64decode(encrypted_secret.encode("utf-8"))
        nonce = raw_payload[:12]
        ciphertext = raw_payload[12:]
    except Exception as e:
        raise ValueError(f"Invalid base64 payload: {str(e)}")

    # 1. Try current active AES key
    current_key = _get_aes_key()
    try:
        aesgcm = AESGCM(current_key)
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode("utf-8")
    except Exception:
        pass

    # 2. Try legacy fallback keys for backwards compatibility across key rotations
    for leg_key in LEGACY_KEYS:
        try:
            aesgcm = AESGCM(leg_key)
            decrypted = aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode("utf-8")
        except Exception:
            continue

    raise ValueError("Failed to decrypt credential with current or legacy keys.")

def mask_api_key(plaintext_or_key: str) -> str:
    """Masks an API key for safe display in UI e.g. sk-proj...7x9F or AIza...9B2x"""
    if not plaintext_or_key:
        return ""
    if len(plaintext_or_key) <= 8:
        return "••••••••"
    prefix = plaintext_or_key[:6]
    suffix = plaintext_or_key[-4:]
    return f"{prefix}••••••••{suffix}"
