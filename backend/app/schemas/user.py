"""Schémas d'authentification et d'utilisateurs."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.profile import UserRole


class CurrentUser(BaseModel):
    """Utilisateur authentifié, résolu depuis le JWT + la table profiles."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    matricule: str | None = None
    full_name: str
    room: str | None = None
    is_active: bool = True

    @property
    def is_admin(self) -> bool:
        return self.role is UserRole.ADMIN

    @property
    def is_staff(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.LOGISTICIAN)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None = None
    matricule: str | None = None
    full_name: str
    phone: str | None = None
    room: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    """Création de compte par l'admin — pas d'inscription libre."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=120)
    role: UserRole = UserRole.STUDENT
    matricule: str | None = Field(default=None, max_length=30)
    room: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=30)

    @field_validator("matricule")
    @classmethod
    def check_matricule(cls, v: str | None, info) -> str | None:
        if v is not None:
            v = v.strip().upper()
            if len(v) < 4:
                raise ValueError("Matricule trop court (4 caractères minimum)")
        role = info.data.get("role", UserRole.STUDENT)
        if role is UserRole.STUDENT and (v is None or info.data.get("room") is None):
            raise ValueError("Un étudiant doit avoir un matricule et une chambre")
        return v


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    room: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=30)
    role: UserRole | None = None
    is_active: bool | None = None


class UserImportRow(BaseModel):
    email: EmailStr
    full_name: str
    matricule: str | None = None
    room: str | None = None


class UserImportIn(BaseModel):
    rows: list[UserImportRow] = Field(min_length=1, max_length=500)
    role: UserRole = UserRole.STUDENT


class UserImportError(BaseModel):
    row: int
    email: str | None = None
    reason: str


class UserImportOut(BaseModel):
    created: int
    skipped: int
    errors: list[UserImportError]