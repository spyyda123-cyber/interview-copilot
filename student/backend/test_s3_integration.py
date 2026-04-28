"""
AWS S3 Integration Test Script
Tests: connect, upload, presigned-url, download, delete
"""
import sys
import os
import time

sys.path.insert(0, os.path.abspath("../../"))

from shared.storage.s3_client import get_s3_service

print("=" * 60)
print("  AWS S3 Integration Test")
print("=" * 60)

# ── 1. Get service ───────────────────────────────────────────
s3 = get_s3_service()
if s3 is None:
    print("[FAIL] get_s3_service() returned None — check USE_S3_STORAGE and credentials")
    sys.exit(1)
print("[OK]   S3 service instantiated")
print(f"       Bucket : {s3.bucket_name}")
print(f"       Region : {s3.region}")

# ── 2. Upload test file ──────────────────────────────────────
test_key = f"_test/s3_integration_test_{int(time.time())}.txt"
test_content = b"Interview Copilot S3 integration test file. Safe to delete."

print(f"\n[TEST] Uploading test object: {test_key}")
try:
    url = s3.upload_file(
        file_bytes=test_content,
        key=test_key,
        content_type="text/plain",
    )
    print(f"[OK]   Upload succeeded")
    print(f"       S3 URL : {url}")
except Exception as e:
    print(f"[FAIL] Upload failed: {e}")
    sys.exit(1)

# ── 3. Generate pre-signed URL ───────────────────────────────
print(f"\n[TEST] Generating pre-signed URL (expires in 300s) ...")
try:
    presigned = s3.generate_presigned_url(test_key, expires_in=300)
    print(f"[OK]   Pre-signed URL generated")
    print(f"       URL    : {presigned[:80]}...")
except Exception as e:
    print(f"[FAIL] Pre-signed URL generation failed: {e}")
    sys.exit(1)

# ── 4. Download and verify ───────────────────────────────────
print(f"\n[TEST] Downloading object back from S3 ...")
try:
    downloaded = s3.download_file_bytes(test_key)
    assert downloaded == test_content, "Content mismatch!"
    print(f"[OK]   Download succeeded — content matches ({len(downloaded)} bytes)")
except Exception as e:
    print(f"[FAIL] Download failed: {e}")
    sys.exit(1)

# ── 5. Test key extraction from URL ─────────────────────────
extracted_key = s3.extract_key_from_url(url)
assert extracted_key == test_key, f"Key extraction failed: got '{extracted_key}'"
print(f"\n[OK]   Key extraction from URL works: '{extracted_key}'")

# ── 6. Test is_s3_url ────────────────────────────────────────
assert s3.is_s3_url(url), "is_s3_url() should return True for S3 URL"
assert not s3.is_s3_url("/local/path/file.pdf"), "is_s3_url() should return False for local path"
print(f"[OK]   is_s3_url() works correctly")

# ── 7. Delete test file ──────────────────────────────────────
print(f"\n[TEST] Deleting test object ...")
try:
    s3.delete_file(test_key)
    print(f"[OK]   Delete succeeded")
except Exception as e:
    print(f"[FAIL] Delete failed: {e}")
    sys.exit(1)

# ── 8. Test temp file download ───────────────────────────────
print(f"\n[TEST] Testing download_to_temp_file with a resume-sized payload ...")
# Re-upload for temp test
s3.upload_file(test_content, test_key, "text/plain")
try:
    tmp = s3.download_to_temp_file(test_key, suffix=".txt")
    with open(tmp, "rb") as f:
        data = f.read()
    assert data == test_content
    os.remove(tmp)
    print(f"[OK]   Temp file download works — cleaned up")
except Exception as e:
    print(f"[FAIL] Temp file download failed: {e}")
    sys.exit(1)
finally:
    # Clean up the re-uploaded test key
    try:
        s3.delete_file(test_key)
    except Exception:
        pass

print("\n" + "=" * 60)
print("  ALL TESTS PASSED ✓")
print("  AWS S3 Integration is fully working!")
print("=" * 60)
print(f"\nBucket  : {s3.bucket_name}")
print(f"Region  : {s3.region}")
print(f"Resume uploads will go to  : s3://{s3.bucket_name}/resumes/")
print(f"Knowledge files will go to : s3://{s3.bucket_name}/knowledge/")
print(f"Pre-signed URLs expire in  : 3600 seconds (1 hour)")
