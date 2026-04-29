from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise cred_exc
    return user


def require_roles(*roles: UserRole):
    """Dependency factory: requires the current user to have one of the listed roles."""
    allowed = {r.value for r in roles}

    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role.value not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user

    return _checker


RescuerRoles = (UserRole.PILOT, UserRole.SWIMMER, UserRole.WATCHSTANDER, UserRole.ADMIN)
