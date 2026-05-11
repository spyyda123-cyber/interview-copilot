from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    roll_number: str | None = None
    department: str | None = None
    college: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    student_id: int
    student_name: str | None = None
    primary_skill: str | None = None
