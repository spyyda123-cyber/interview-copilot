import logging
import os
import json
from sqlalchemy.orm import Session

import google.generativeai as genai
from app.core.config import settings
from app.models import Marksheet, StudentProfile

logger = logging.getLogger(__name__)

def parse_marksheet_file(marksheet_id: int, file_path: str, db: Session):
    marksheet = db.query(Marksheet).filter(Marksheet.id == marksheet_id).first()
    if not marksheet:
        raise ValueError("Marksheet not found")

    tmp_path = None
    try:
        # Resolve the file path to read from
        if file_path.startswith("https://"):
            from shared.storage import get_s3_service
            s3 = get_s3_service()
            if s3 is None:
                raise RuntimeError("S3 URL stored but S3 is not configured")
            
            key = s3.extract_key_from_url(file_path)
            logger.info("[MARKSHEET-PARSE] Downloading from S3 key=%s marksheet_id=%s", key, marksheet_id)
            tmp_path = s3.download_to_temp_file(key, suffix=f".{marksheet.file_type}")
            read_path = tmp_path
        else:
            read_path = file_path

        # Use Gemini for OCR and Extraction
        from app.services.llm_client import _get_generation_model_name
        genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
        
        logger.info("[MARKSHEET-OCR] Uploading file to Gemini... path=%s", read_path)
        gemini_file = genai.upload_file(path=read_path, display_name=f"marksheet_{marksheet_id}")
        
        import time
        max_wait = 60
        waited = 0
        while gemini_file.state.name == "PROCESSING" and waited < max_wait:
            time.sleep(2)
            waited += 2
            gemini_file = genai.get_file(gemini_file.name)
            
        if gemini_file.state.name == "FAILED":
            logger.error("[MARKSHEET-OCR] Gemini file processing failed")
            raise ValueError("Gemini failed to process the marksheet document")

        if gemini_file.state.name == "PROCESSING":
            logger.error("[MARKSHEET-OCR] Gemini file processing timed out")
            raise ValueError("Gemini file processing timed out")


        try:
            resolved_model = _get_generation_model_name()
            logger.info("[MARKSHEET-OCR] Using model: %s", resolved_model)
            model = genai.GenerativeModel(resolved_model)
            prompt = """Analyze this marksheet/transcript.
Extract the student's overall CGPA (or percentage converted to a 10-point scale) and the total number of active backlogs (failed courses not yet cleared).
Return strict JSON: {"cgpa": 8.5, "backlogs": 0}
If you cannot find the information, use 0.0 for cgpa and 0 for backlogs.
"""
            response = model.generate_content(
                [prompt, gemini_file],
                generation_config={"response_mime_type": "application/json"}
            )
            
            data = json.loads(response.text)
            cgpa = float(data.get("cgpa", 0.0))
            backlogs = int(data.get("backlogs", 0))

            # Record usage
            try:
                from app.services.usage_service import record_llm_usage
                usage = {
                    "prompt_tokens": response.usage_metadata.prompt_token_count,
                    "completion_tokens": response.usage_metadata.candidates_token_count,
                    "model": settings.GEMINI_GENERATION_MODEL
                }
                record_llm_usage(db, "gemini", usage["model"], "marksheet_ocr", usage["prompt_tokens"], usage["completion_tokens"], marksheet.student_id)
            except Exception as e:
                logger.warning("[MARKSHEET-OCR] Failed to record usage: %s", e)

            # Update StudentProfile with the parsed data
            profile = db.query(StudentProfile).filter(StudentProfile.student_id == marksheet.student_id).first()
            if profile:
                marksheets_data = list(profile.marksheets) if profile.marksheets else []
                marksheets_data.append({
                    "marksheet_id": marksheet.id,
                    "cgpa": cgpa,
                    "backlogs": backlogs,
                    "file_name": marksheet.file_name
                })
                profile.marksheets = marksheets_data
                db.commit()

            return {"cgpa": cgpa, "backlogs": backlogs}

        finally:
            genai.delete_file(gemini_file.name)

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError as e:
                logger.warning("[MARKSHEET-PARSE] Failed to clean up temp file path=%s error=%s", tmp_path, e)
