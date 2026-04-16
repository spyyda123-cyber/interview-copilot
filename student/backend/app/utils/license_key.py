from datetime import datetime
import secrets
import string


def generate_license_key(company_name: str) -> str:
    clean_company = "".join(ch for ch in company_name.upper() if ch.isalnum())
    company_prefix = (clean_company[:4] or "LICN").ljust(4, "X")
    year = datetime.utcnow().year
    alphabet = string.ascii_uppercase + string.digits
    token = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"{company_prefix}-{year}-{token}"
