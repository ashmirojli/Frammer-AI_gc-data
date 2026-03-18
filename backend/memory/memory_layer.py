"""
memory_layer.py
---------------
Short-term + Long-term memory configuration for the LangGraph pipeline.

Short-term Memory : LangGraph SqliteSaver — persists graph checkpoints
                    across server restarts (thread-scoped per session).

Long-term Memory  : LangGraph InMemoryStore — semantic episodic memory
                    that stores successful (question → SQL) pairs with
                    embeddings for cross-session learning.
"""

import os
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))   # memory/
BACKEND_DIR = os.path.dirname(BASE_DIR)                     # backend/
MEMORY_DB   = os.path.join(BACKEND_DIR, "data", "frammer_memory.db")


# ── Short-term Memory: LangGraph Checkpointer ───────────────────────────────

_checkpointer = None

def get_checkpointer() -> MemorySaver:
    """
    Return a MemorySaver checkpointer for session memory.

    Stores full PipelineState graph snapshots so that:
    - Multi-turn conversations survive within the same process
    - The orchestrator can resume from any checkpoint
    """
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = MemorySaver()
    return _checkpointer


# ── Long-term Memory: Semantic Episodic Store ────────────────────────────────

_store = None

def get_episodic_store() -> InMemoryStore:
    """
    Return a singleton InMemoryStore for semantic episodic memory.

    Stores successful (question → SQL) pairs with embeddings.
    Semantically similar questions recall similar past episodes.

    Usage:
        store = get_episodic_store()
        # Save a successful run:
        store.put(("user_123", "sql_history"), key=question_hash,
                  value={"question": q, "sql": s, "confidence": 0.95})
        # Retrieve before generating SQL:
        results = store.search(("user_123", "sql_history"),
                               query=user_question, limit=5)
    """
    global _store
    if _store is None:
        _store = InMemoryStore()
    return _store


def save_successful_query(
    user_id: str,
    question: str,
    sql: str,
    confidence: float,
) -> None:
    """
    Save a successful query to long-term episodic memory.

    Args:
        user_id    : namespace for the user
        question   : the natural language question
        sql        : the generated SQL that was successful
        confidence : the pipeline confidence score
    """
    import hashlib
    store = get_episodic_store()
    key = hashlib.md5(question.strip().lower().encode()).hexdigest()
    store.put(
        (user_id, "sql_history"),
        key=key,
        value={
            "question": question,
            "sql": sql,
            "confidence": confidence,
        }
    )


def recall_similar_queries(
    user_id: str,
    question: str,
    limit: int = 5,
) -> list[dict]:
    """
    Retrieve similar past successful queries from episodic memory.

    Args:
        user_id  : namespace for the user
        question : current question to find similar past queries for
        limit    : max number of results

    Returns:
        List of dicts with question, sql, and confidence from past runs.
    """
    store = get_episodic_store()
    try:
        results = store.search(
            (user_id, "sql_history"),
            query=question,
            limit=limit,
        )
        return [item.value for item in results]
    except Exception:
        return []
