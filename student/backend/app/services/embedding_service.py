"""Text embedding service for vector similarity search.

Provides embeddings for knowledge base RAG (Retrieval-Augmented Generation):
- Embeds company interview materials during document ingestion
- Embeds queries during plan generation
- Uses Gemini embedding API for semantic vector representation
- Supports cosine distance similarity search on embedded vectors

Used by:
- knowledge_service.py for embedding documents and queries
- Enables efficient vector similarity search without LLM calls
"""
import google.generativeai as genai

from app.core.config import settings


def embed_text(text: str) -> list[float]:
    """Generate vector embedding for text using Gemini API.
    
    Converts text to semantic vector representation suitable for cosine similarity.
    Uses task_type='retrieval_document' for knowledge base retrieval optimization.
    
    Args:
        text: Text to embed
        
    Returns:
        list[float]: Vector embedding (1536-dimensional for Gemini model)
        
    Raises:
        ValueError: GEMINI_API_KEY not configured in settings
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    response = genai.embed_content(
        model=settings.GEMINI_EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_document",
    )
    return response["embedding"]
