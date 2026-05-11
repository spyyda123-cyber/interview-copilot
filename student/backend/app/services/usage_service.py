import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models import LLMUsageLog

logger = logging.getLogger(__name__)

def record_llm_usage(
    db: Session,
    provider: str,
    model: str,
    action: str,
    prompt_tokens: int,
    completion_tokens: int,
    student_id: Optional[int] = None
):
    """Record LLM token usage and calculate estimated cost in USD.
    
    Pricing (Estimated as of May 2026):
    - GPT-5: $15/M input, $60/M output
    - GPT-5-mini: $1.50/M input, $6/M output
    - Gemini 1.5 Pro: $3.50/M input, $10.50/M output
    - Gemini 1.5 Flash: $0.075/M input, $0.30/M output
    """
    
    cost = 0.0
    m_input = prompt_tokens / 1_000_000
    m_output = completion_tokens / 1_000_000
    
    model_lower = model.lower()
    
    if provider == "openai":
        if "mini" in model_lower:
            cost = (m_input * 1.50) + (m_output * 6.00)
        else:
            # Assuming gpt-5 pricing
            cost = (m_input * 15.00) + (m_output * 60.00)
    elif provider == "gemini":
        if "pro" in model_lower:
            cost = (m_input * 3.50) + (m_output * 10.50)
        else:
            # Assuming gemini-1.5-flash pricing
            cost = (m_input * 0.075) + (m_output * 0.30)
            
    try:
        log = LLMUsageLog(
            provider=provider,
            model=model,
            action=action,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost_usd=cost,
            student_id=student_id
        )
        db.add(log)
        db.commit()
        logger.info("[USAGE] Recorded %s tokens for %s (cost: $%f)", prompt_tokens + completion_tokens, action, cost)
    except Exception as e:
        db.rollback()
        logger.error("[USAGE] Failed to record LLM usage: %s", e)
