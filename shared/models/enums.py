import enum

class CollegeStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    COLLEGE_ADMIN = "COLLEGE_ADMIN"
    STUDENT = "STUDENT"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"


class TokenTransactionType(str, enum.Enum):
    ALLOCATION = "ALLOCATION"
    CONSUMPTION = "CONSUMPTION"
    RECLAIM = "RECLAIM"
