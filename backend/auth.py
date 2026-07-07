import hashlib
import secrets
import time
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel

import models
import schemas
from database import SessionLocal

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory session store: token -> expiry timestamp.
# Fine for a single-user local app — restarting the backend just logs you out.
active_sessions = {}
SESSION_DURATION_SECONDS = 60 * 60 * 12  # 12 hours


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_secret(secret: str, salt: str = None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", secret.encode(), salt.encode(), 100_000).hex()
    return digest, salt


def verify_secret(secret: str, digest: str, salt: str) -> bool:
    check, _ = hash_secret(secret, salt)
    return secrets.compare_digest(check, digest)


def create_session_token() -> str:
    token = secrets.token_urlsafe(32)
    active_sessions[token] = time.time() + SESSION_DURATION_SECONDS
    return token


def require_auth(authorization: str = Header(None)):
    """
    Dependency you can attach to any route to require login, e.g.:
        @app.get("/entries", dependencies=[Depends(require_auth)])
    Not applied to existing routes yet — wire it in once the login
    flow is confirmed working end to end.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    expiry = active_sessions.get(token)
    if not expiry or expiry < time.time():
        raise HTTPException(status_code=401, detail="Session expired")
    return True


class SetupRequest(BaseModel):
    pin: str
    password: str

class PinLoginRequest(BaseModel):
    pin: str

class PasswordLoginRequest(BaseModel):
    password: str


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    """Tells the frontend whether this is first-run (show setup) or returning (show login)."""
    row = db.query(models.AuthSettings).filter(models.AuthSettings.id == 1).first()
    return {"configured": row is not None}


@router.post("/setup")
def setup_auth(payload: SetupRequest, db: Session = Depends(get_db)):
    existing = db.query(models.AuthSettings).filter(models.AuthSettings.id == 1).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already set up. Use login instead.")

    pin_hash, pin_salt = hash_secret(payload.pin)
    password_hash, password_salt = hash_secret(payload.password)

    row = models.AuthSettings(
        id=1,
        pin_hash=pin_hash, pin_salt=pin_salt,
        password_hash=password_hash, password_salt=password_salt,
    )
    db.add(row)
    db.commit()
    return {"ok": True}


@router.post("/login/pin")
def login_pin(payload: PinLoginRequest, db: Session = Depends(get_db)):
    row = db.query(models.AuthSettings).filter(models.AuthSettings.id == 1).first()
    if not row or not verify_secret(payload.pin, row.pin_hash, row.pin_salt):
        raise HTTPException(status_code=401, detail="Incorrect pin")
    return {"token": create_session_token()}


@router.post("/login/password")
def login_password(payload: PasswordLoginRequest, db: Session = Depends(get_db)):
    row = db.query(models.AuthSettings).filter(models.AuthSettings.id == 1).first()
    if not row or not verify_secret(payload.password, row.password_hash, row.password_salt):
        raise HTTPException(status_code=401, detail="Incorrect password")
    return {"token": create_session_token()}


@router.get("/verify")
def verify_session(authorization: str = Header(None)):
    """Frontend calls this on load to check if a saved token is still valid."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"valid": False}
    token = authorization.removeprefix("Bearer ")
    expiry = active_sessions.get(token)
    return {"valid": bool(expiry and expiry > time.time())}


def calc_age(date_of_birth: str) -> int | None:
    if not date_of_birth:
        return None
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
    except ValueError:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def is_profile_complete(row: models.UserProfile | None) -> bool:
    if not row:
        return False
    required = (row.name, row.date_of_birth, row.gender)
    return all(v and str(v).strip() for v in required)


def profile_to_response(row: models.UserProfile | None) -> schemas.ProfileResponse:
    if not row:
        return schemas.ProfileResponse(is_complete=False)
    return schemas.ProfileResponse(
        name=row.name,
        date_of_birth=row.date_of_birth,
        age=calc_age(row.date_of_birth),
        gender=row.gender,
        is_complete=is_profile_complete(row),
    )


@router.get("/profile", response_model=schemas.ProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    row = db.query(models.UserProfile).filter(models.UserProfile.id == 1).first()
    return profile_to_response(row)


@router.put("/profile", response_model=schemas.ProfileResponse)
def update_profile(payload: schemas.ProfileUpdate, db: Session = Depends(get_db)):
    row = db.query(models.UserProfile).filter(models.UserProfile.id == 1).first()
    if not row:
        row = models.UserProfile(id=1)
        db.add(row)

    for field in ("name", "date_of_birth", "gender"):
        value = getattr(payload, field)
        if value is not None:
            setattr(row, field, value.strip() if isinstance(value, str) else value)

    db.commit()
    db.refresh(row)
    return profile_to_response(row)
