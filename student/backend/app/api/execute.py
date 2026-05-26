"""
Code Execution Engine — Judge0 Integration
===========================================

Provides a secure proxy to Judge0 CE (Community Edition) for running student
code against AI-generated test cases.

JUDGE0 Language IDs (most common):
    71 = Python 3
    63 = JavaScript (Node.js)
    62 = Java
    54 = C++ (GCC 9.2)

FLOW:
    POST /execute/run   → submit code + test cases → judge each case → return results
"""

import logging
import os
import time
import base64
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/execute", tags=["execute"])

# ── Judge0 Configuration ────────────────────────────────────────────────────
# Uses the public Judge0 CE instance by default.  Point JUDGE0_URL to a
# self-hosted instance or RapidAPI endpoint to swap providers.
JUDGE0_URL = os.environ.get("JUDGE0_URL", "https://judge0-ce.p.rapidapi.com")
JUDGE0_API_KEY = os.environ.get("JUDGE0_API_KEY", "")  # RapidAPI key, if using rapid API host

# Free public CE instance (no key required, rate-limited)
JUDGE0_PUBLIC_URL = os.environ.get("JUDGE0_PUBLIC_URL", "https://ce.judge0.com")

# Language ID map — mirrors LANGUAGE_CONFIGS in the frontend
LANGUAGE_IDS = {
    "python": 71,       # Python 3.8.1
    "javascript": 63,   # JavaScript (Node.js 12.14.0)
    "java": 62,         # Java (OpenJDK 13.0.1)
    "cpp": 54,          # C++ (GCC 9.2.0)
}


# ── Schemas ──────────────────────────────────────────────────────────────────

class TestCase(BaseModel):
    label: str
    input: str
    expected_output: str


class ExecuteRequest(BaseModel):
    language: str          # "python" | "javascript" | "java" | "cpp"
    source_code: str
    test_cases: List[TestCase]
    problem_title: Optional[str] = "Solution"


class TestResult(BaseModel):
    label: str
    passed: bool
    input: str
    expected: str
    got: str
    stderr: Optional[str] = None
    compile_error: Optional[str] = None
    execution_time: Optional[str] = None


class ExecuteResponse(BaseModel):
    results: List[TestResult]
    passed_count: int
    total_count: int
    success_rate: int


# ── Helper: wrap code so stdin maps to expected function args ────────────────

def _build_python_runner(source_code: str, test_input: str) -> str:
    """
    Wraps student Python code so the test input is fed as stdin.
    We embed the input directly into the source as a mock stdin.
    """
    # Escape backslashes and quotes in the test input
    safe_input = test_input.replace("\\", "\\\\").replace('"', '\\"').replace("'", "\\'")
    return f"""{source_code}

# ── Test harness (injected by CoPilot) ──
import sys as _sys
_sys.stdin = __import__('io').StringIO('''{safe_input}
''')
"""


def _build_runner(language: str, source_code: str, test_input: str) -> str:
    """Build the runnable source for a given language and test input."""
    if language == "python":
        return _build_python_runner(source_code, test_input)
    # For Java/C++/JS: just pass stdin through the normal submission channel (stdin field in Judge0)
    return source_code


# ── Judge0 API Calls ─────────────────────────────────────────────────────────

def _get_judge0_base() -> tuple[str, dict]:
    """Returns (base_url, headers) for the appropriate Judge0 instance."""
    if JUDGE0_API_KEY:
        # RapidAPI hosted Judge0 Pro
        headers = {
            "X-RapidAPI-Key": JUDGE0_API_KEY,
            "X-RapidAPI-Host": JUDGE0_URL.replace("https://", ""),
            "Content-Type": "application/json",
        }
        return JUDGE0_URL, headers
    else:
        # Free public CE instance
        headers = {"Content-Type": "application/json"}
        return JUDGE0_PUBLIC_URL, headers


def _submit_to_judge0(language: str, source_code: str, stdin: str) -> dict:
    """Submit a single code execution to Judge0 and poll for results."""
    lang_id = LANGUAGE_IDS.get(language, 71)
    base_url, headers = _get_judge0_base()

    # Encode source and stdin as base64
    encoded_source = base64.b64encode(source_code.encode()).decode()
    encoded_stdin = base64.b64encode(stdin.encode()).decode() if stdin else ""

    payload = {
        "language_id": lang_id,
        "source_code": encoded_source,
        "stdin": encoded_stdin,
        "base64_encoded": True,
        "wait": False,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            # 1. Submit the code
            submit_resp = client.post(
                f"{base_url}/submissions?base64_encoded=true&wait=false",
                json=payload,
                headers=headers,
            )
            if submit_resp.status_code not in (200, 201):
                logger.warning("[EXECUTE] Judge0 submit failed: %s %s", submit_resp.status_code, submit_resp.text)
                return {"status": {"id": 13, "description": "Internal Error"}, "stdout": None, "stderr": submit_resp.text[:200]}

            token = submit_resp.json().get("token")
            if not token:
                return {"status": {"id": 13, "description": "No token received"}, "stdout": None, "stderr": None}

            # 2. Poll until done (max 15 seconds)
            for _ in range(15):
                time.sleep(1)
                result_resp = client.get(
                    f"{base_url}/submissions/{token}?base64_encoded=true",
                    headers=headers,
                )
                result = result_resp.json()
                status_id = result.get("status", {}).get("id", 0)
                if status_id not in (1, 2):  # 1=In Queue, 2=Processing
                    return result

            # Timeout
            return {"status": {"id": 13, "description": "Timeout"}, "stdout": None, "stderr": "Execution timed out"}

    except httpx.ConnectError as e:
        logger.error("[EXECUTE] Cannot connect to Judge0 at %s: %s", base_url, e)
        return {"status": {"id": 13, "description": "Judge0 unreachable"}, "stdout": None, "stderr": str(e)}
    except Exception as e:
        logger.error("[EXECUTE] Judge0 error: %s", e)
        return {"status": {"id": 13, "description": "Execution error"}, "stdout": None, "stderr": str(e)}


def _decode_b64(val: Optional[str]) -> str:
    """Safely base64-decode a Judge0 field."""
    if not val:
        return ""
    try:
        return base64.b64decode(val).decode("utf-8", errors="replace").strip()
    except Exception:
        return val.strip()


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/run", response_model=ExecuteResponse)
def run_code(req: ExecuteRequest):
    """
    Execute student code against each test case via Judge0.
    Returns pass/fail for each test case with actual vs expected output.
    """
    if req.language not in LANGUAGE_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {req.language}. Supported: {list(LANGUAGE_IDS.keys())}"
        )

    if not req.test_cases:
        raise HTTPException(status_code=400, detail="No test cases provided")

    results: List[TestResult] = []

    for tc in req.test_cases:
        # Build the source to run — for Python we inject stdin mock; others use Judge0's stdin field
        if req.language == "python":
            runnable = req.source_code  # stdin passed via Judge0's stdin field
            stdin = tc.input
        else:
            runnable = req.source_code
            stdin = tc.input

        logger.info("[EXECUTE] Running test '%s' lang=%s", tc.label, req.language)
        result = _submit_to_judge0(req.language, runnable, stdin)

        status_id = result.get("status", {}).get("id", 0)
        stdout_raw = _decode_b64(result.get("stdout"))
        stderr_raw = _decode_b64(result.get("stderr"))
        compile_out = _decode_b64(result.get("compile_output"))
        exec_time = result.get("time")

        # Normalise output for comparison
        actual_output = stdout_raw.strip()
        expected_output = tc.expected_output.strip()

        # Status IDs:  3=Accepted, 4=Wrong Answer, 5=TLE, 6=CE, 7-12=RE, 13=Internal Error
        is_compile_error = status_id == 6
        is_runtime_error = status_id in (7, 8, 9, 10, 11, 12)
        is_tle = status_id == 5

        if is_compile_error:
            got = f"Compile Error: {compile_out or stderr_raw}"
            passed = False
        elif is_tle:
            got = "Time Limit Exceeded"
            passed = False
        elif is_runtime_error:
            got = f"Runtime Error: {stderr_raw or 'Unknown error'}"
            passed = False
        else:
            # Compare output (strip whitespace, handle multi-line)
            passed = actual_output == expected_output
            got = actual_output if actual_output else (f"Error: {stderr_raw}" if stderr_raw else "No output")

        results.append(TestResult(
            label=tc.label or f"Test {len(results) + 1}",
            passed=passed,
            input=tc.input,
            expected=expected_output,
            got=got,
            stderr=stderr_raw or None,
            compile_error=compile_out if is_compile_error else None,
            execution_time=exec_time,
        ))

    passed_count = sum(1 for r in results if r.passed)
    total = len(results)
    rate = round((passed_count / total) * 100) if total > 0 else 0

    logger.info("[EXECUTE] Done: %d/%d passed", passed_count, total)
    return ExecuteResponse(
        results=results,
        passed_count=passed_count,
        total_count=total,
        success_rate=rate,
    )


@router.get("/languages")
def get_supported_languages():
    """Returns the list of supported programming languages."""
    return {lang: lang_id for lang, lang_id in LANGUAGE_IDS.items()}


@router.get("/health")
def execute_health():
    """Check if Judge0 is reachable."""
    base_url, headers = _get_judge0_base()
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{base_url}/about", headers=headers)
            return {"judge0_status": "reachable", "url": base_url, "http_status": resp.status_code}
    except Exception as e:
        return {"judge0_status": "unreachable", "url": base_url, "error": str(e)}
