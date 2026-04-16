"""Knowledge base service for company interview context.

Implements RAG (Retrieval-Augmented Generation) for interview preparation:

KNOWLEDGE BASE PIPELINE:
1. Admin uploads company interview materials (PDF/text via POST /knowledge/ingest)
2. Document split into semantic chunks (max 400 tokens via chunk_text)
3. Each chunk embedded using embedding_service (vector representation)
4. Stored in PostgreSQL with vector similarity search

RETRIEVAL FOR PLAN GENERATION:
1. Plan generation query: "{company_name} {role} interview expectations"
2. Query embedded using same model as chunks
3. PostgreSQL cosine_distance finds top 8 most similar chunks
4. Relevant chunks formatted into prompt context for Gemini

BUSINESS PURPOSE:
- Provides company-specific interview context to LLM
- Helps tailor learning plan to actual interview expectations
- Reduces hallucination by grounding plan in known company data
- Cost-effective knowledge reuse (vector search is cheaper than LLM calls)

Used by:
- Plan generation pipeline (retrieve_company_context called in plan_service.py)
- POST /knowledge/ingest endpoint for admin knowledge uploads
"""
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import KnowledgeChunk, KnowledgeDocument
from app.services.embedding_service import embed_text
from app.utils.text import chunk_text


def ingest_document(
    db: Session,
    title: str,
    company_name: str,
    role: str | None,
    text: str,
    source: str | None = None,
) -> KnowledgeDocument:
    """Ingest company interview material into knowledge base.
    
    PROCESS:
    1. Create KnowledgeDocument metadata
    2. Split text into semantic chunks (max 400 tokens)
    3. Embed each chunk using embedding_service
    4. Store chunks with vector embeddings for similarity search
    
    Used by POST /knowledge/ingest endpoint (admin ingests company materials).
    
    Args:
        db: Database session
        title: Document title (e.g., "Google Backend Interview Guide")
        company_name: Company name for filtering during retrieval
        role: Optional role for role-specific knowledge (e.g., "backend engineer")
        text: Full document text to ingest
        source: Optional source URL/file path for tracking
        
    Returns:
        KnowledgeDocument: Stored document with all chunks embedded
    """
    document = KnowledgeDocument(
        title=title,
        source=source,
        company_name=company_name,
        role=role,
    )
    db.add(document)
    db.flush()

    chunks = chunk_text(text, max_tokens=400)
    for chunk in chunks:
        embedding = embed_text(chunk)
        db.add(
            KnowledgeChunk(
                document_id=document.id,
                content=chunk,
                embedding=embedding,
            )
        )
    db.commit()
    db.refresh(document)
    return document


def retrieve_company_context(
    db: Session,
    company_name: str,
    role: str | None,
    query_text: str,
    limit: int = 8,
) -> List[KnowledgeChunk]:
    """Retrieve most relevant company knowledge chunks via vector similarity search.
    
    Uses embedding_service to embed query and find cosine-distance nearest neighbors.
    
    Called by generate_learning_plan() to provide company context to Gemini.
    Example query: \"Google backend engineer interview expectations\"
    Returns top 8 most relevant chunks from ingested Google materials.
    
    Args:
        db: Database session
        company_name: Company to filter knowledge base
        role: Optional role filter (e.g., "backend engineer")
        query_text: Query text to embed and find similar chunks
        limit: Max chunks to return (default 8, tuned for prompt context)
        
    Returns:
        List[KnowledgeChunk]: Top N most similar chunks (empty if no docs for company)
    """
    doc_query = db.query(KnowledgeDocument).filter(
        KnowledgeDocument.company_name == company_name
    )
    if role:
        doc_query = doc_query.filter(KnowledgeDocument.role == role)
    if doc_query.first() is None:
        return []

    query_embedding = embed_text(query_text)

    stmt = (
        select(KnowledgeChunk)
        .join(KnowledgeDocument)
        .where(KnowledgeDocument.company_name == company_name)
    )
    if role:
        stmt = stmt.where(KnowledgeDocument.role == role)

    stmt = stmt.order_by(KnowledgeChunk.embedding.cosine_distance(query_embedding)).limit(limit)
    result = db.execute(stmt).scalars().all()
    return result


def build_company_context(chunks: List[KnowledgeChunk]) -> str:
    """Format knowledge chunks into readable text for LLM prompt.
    
    Called after retrieve_company_context to prepare context for Gemini.
    Formats chunks as bulleted list for clarity in prompt.
    
    Args:
        chunks: List of retrieved KnowledgeChunk objects
        
    Returns:
        str: Formatted bulleted text (or default message if no chunks)
    """
    if not chunks:
        return "No company knowledge found."
    lines = [f"- {chunk.content.strip()}" for chunk in chunks]
    return "\n".join(lines)
