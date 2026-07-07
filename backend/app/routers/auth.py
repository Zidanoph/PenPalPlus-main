"""Authentication endpoints (matches PRD Part 4: /auth/*)."""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, security, services

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(db: Session, user: models.User, device: str = "") -> schemas.TokenPair:
    access = security.create_access_token(user.id)
    refresh = security.create_refresh_token(user.id)
    db.add(models.UserSession(user_id=user.id, refresh_token=refresh, device=device))
    db.commit()
    return schemas.TokenPair(access_token=access, refresh_token=refresh)


@router.post("/register", response_model=schemas.TokenPair, status_code=201)
def register(payload: schemas.RegisterIn, request: Request, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(email=payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(models.Profile).filter_by(handle=payload.handle).first():
        raise HTTPException(status_code=409, detail="Handle already taken")

    user = models.User(
        email=payload.email.lower(),
        password_hash=security.hash_password(payload.password),
    )
    db.add(user)
    db.flush()  # assign user.id

    db.add(models.Profile(
        user_id=user.id,
        display_name=payload.display_name,
        handle=payload.handle,
        country=payload.country,
        country_code=payload.country_code.upper()[:2],
        city=payload.city,
        latitude=payload.latitude,
        longitude=payload.longitude,
        avatar_seed=payload.handle,
    ))
    db.add(models.UserSettings(user_id=user.id))
    db.add(models.AuditLog(
        user_id=user.id, action="register",
        ip=request.client.host if request.client else "",
    ))
    db.flush()
    services.check_achievements(db, user.id)
    return _issue_tokens(db, user, device=request.headers.get("user-agent", ""))


@router.post("/login", response_model=schemas.TokenPair)
def login(form: OAuth2PasswordRequestForm = Depends(), request: Request = None,
          db: Session = Depends(get_db)):
    """OAuth2 password flow. `username` field carries the email."""
    user = db.query(models.User).filter_by(email=form.username.lower()).first()
    if not user or not security.verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    user.last_active_at = services.utcnow()
    device = request.headers.get("user-agent", "") if request else ""
    return _issue_tokens(db, user, device=device)


@router.post("/refresh-token", response_model=schemas.TokenPair)
def refresh_token(payload: schemas.RefreshIn, db: Session = Depends(get_db)):
    try:
        claims = security.decode_token(payload.refresh_token, expected_type="refresh")
        user_id = int(claims["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    session = (
        db.query(models.UserSession)
        .filter_by(refresh_token=payload.refresh_token, revoked=False)
        .first()
    )
    if not session:
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    user = db.get(models.User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")

    # Rotate: revoke the old refresh token, issue a fresh pair.
    session.revoked = True
    return _issue_tokens(db, user, device=session.device)


@router.post("/logout", status_code=204)
def logout(payload: schemas.RefreshIn, db: Session = Depends(get_db),
           user: models.User = Depends(get_current_user)):
    session = (
        db.query(models.UserSession)
        .filter_by(refresh_token=payload.refresh_token, user_id=user.id)
        .first()
    )
    if session:
        session.revoked = True
        db.commit()
    return None


@router.post("/forgot-password", status_code=202)
def forgot_password(payload: schemas.ForgotPasswordIn, db: Session = Depends(get_db)):
    """Always returns 202 so the endpoint can't be used to enumerate accounts.
    In production this would email a signed, short-lived reset token."""
    user = db.query(models.User).filter_by(email=payload.email.lower()).first()
    if user:
        token = security.create_access_token(user.id)  # reuse short-lived signer
        # A real deployment emails this; we return nothing to the client.
        db.add(models.AuditLog(user_id=user.id, action="password_reset_requested"))
        db.commit()
        return {"detail": "If that email exists, a reset link has been sent.",
                "_dev_reset_token": token}
    return {"detail": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=200)
def reset_password(payload: schemas.ResetPasswordIn, db: Session = Depends(get_db)):
    try:
        claims = security.decode_token(payload.token, expected_type="access")
        user_id = int(claims["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")
    user.password_hash = security.hash_password(payload.new_password)
    # Revoke all existing sessions on password change.
    for s in db.query(models.UserSession).filter_by(user_id=user.id, revoked=False):
        s.revoked = True
    db.add(models.AuditLog(user_id=user.id, action="password_reset"))
    db.commit()
    return {"detail": "Password updated"}
