from shared.auth.dependencies import (
    get_college_scope,
    get_current_user,
    require_college_admin,
    require_super_admin,
)
from shared.auth.jwt import create_access_token, decode_access_token
from shared.auth.passwords import hash_password, verify_password

__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "require_super_admin",
    "require_college_admin",
    "get_college_scope",
]
