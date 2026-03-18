"""
retriever.py
------------
ChromaDB retrieval layer for the Frammer AI NL-to-SQL pipeline.
Used by all agents to fetch relevant context before SQL generation.
"""

import os
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from dotenv import load_dotenv

load_dotenv()

# ── Paths ────────────────────────────────────────────────────────────────────
# retriever.py lives in backend/RAG/
# chroma_db lives in backend/data/chroma_db
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))   # backend/RAG/
BACKEND_DIR = os.path.dirname(BASE_DIR)                    # backend/
CHROMA_DIR = os.path.join(BACKEND_DIR, "data", "chroma_db")

# ── Embedding function (same model used in knowledge_base.py) ────────────────
EMBEDDING_FN = SentenceTransformerEmbeddingFunction(
    model_name="BAAI/bge-small-en-v1.5"
)

# ── ChromaDB client + collection cache (singletons) ─────────────────────────
_client      = None
_collections = {}

def get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_DIR)
    return _client


def get_collection(name: str):
    """Return a cached ChromaDB collection by name."""
    if name not in _collections:
        _collections[name] = get_client().get_collection(
            name=name,
            embedding_function=EMBEDDING_FN
        )
    return _collections[name]


# ── Core retrieval functions ──────────────────────────────────────────────────

def retrieve_metrics(query: str, top_k: int = 6) -> list[dict]:
    """
    Retrieve top_k most relevant metrics for a natural language query.
    Used by: Schema Linker
    """
    collection = get_collection("metrics")
    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_dimensions(query: str, top_k: int = 6) -> list[dict]:
    """
    Retrieve top_k most relevant dimensions for a natural language query.
    Used by: Schema Linker
    """
    collection = get_collection("dimensions")
    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_few_shots(query: str, top_k: int = 8) -> list[dict]:
    """
    Retrieve top_k most similar few-shot NL->SQL examples.
    Used by: SQL Generator
    """
    collection = get_collection("few_shots")
    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_schema(query: str, top_k: int = 6) -> list[dict]:
    """
    Retrieve top_k most relevant schema/table docs for a query.
    Used by: SQL Generator, SQL Validator
    """
    collection = get_collection("schema")
    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_jargon(query: str, top_k: int = 3) -> list[dict]:
    """
    Retrieve top_k most relevant business jargon / glossary definitions.
    Used by: Intent Agent, SQL Generator (to understand business terms).
    """
    try:
        collection = get_collection("business_jargon")
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        return _format_results(results, top_k)
    except Exception:
        # Collection may not exist yet if load_jargon_data.py hasn't been run
        return []


def retrieve_all_context(query: str) -> dict:
    """
    Master retrieval function — fetches all 4 collections at once.
    Returns a single context dict used by the orchestrator.
    The actual counts will vary based on relevance.
    """
    return {
        "metrics":    retrieve_metrics(query,    top_k=4),
        "dimensions": retrieve_dimensions(query, top_k=4),
        "few_shots":  retrieve_few_shots(query,  top_k=5),
        "schema":     retrieve_schema(query,     top_k=4),
        "jargon":     retrieve_jargon(query,     top_k=2),
    }


# ── Helper ────────────────────────────────────────────────────────────────────

MIN_SCORE     = 0.65  # Higher threshold for bge-small-en-v1.5
SCORE_GAP_MAX = 0.04  # Stricter gap to ensure only highly similar items are kept

def _format_results(results: dict, top_k: int) -> list[dict]:
    """Flatten ChromaDB results into a clean list of dicts.
    Uses 1/(1+distance) for safe similarity conversion.
    Implements a dynamic cutoff:
    1. Must exceed MIN_SCORE.
    2. Must be within SCORE_GAP_MAX of the best result (if many results).
    """
    output = []
    docs      = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    if not docs:
        return []

    best_score = None

    for i in range(len(docs)):
        distance = distances[i] if distances else None
        score    = round(1 / (1 + distance), 4) if distance is not None else 0.0

        if i == 0:
            best_score = score

        # 1. Skip if below absolute min
        if score < MIN_SCORE:
            continue
            
        # 2. Skip if it's a huge drop in quality compared to the top hit
        # This makes the list dynamic: if only 2 items are great, it only returns 2.
        if best_score and (best_score - score) > SCORE_GAP_MAX and i > 1:
            break

        output.append({
            "text":     docs[i],
            "metadata": metadatas[i] if metadatas else {},
            "distance": round(distance, 4) if distance is not None else None,
            "score":    score,
        })
    return output


def format_context_for_prompt(context: dict) -> str:
    """
    Convert retrieved context dict into a clean string
    ready to be injected into a Gemini prompt.
    """
    lines = []

    if context.get("metrics"):
        lines.append("=== RELEVANT METRICS ===")
        for i, m in enumerate(context["metrics"], 1):
            score_str = f" (score: {m['score']})" if m.get("score") else ""
            lines.append(f"{i}. {m['text']}{score_str}")

    if context.get("dimensions"):
        lines.append("\n=== RELEVANT DIMENSIONS ===")
        for i, d in enumerate(context["dimensions"], 1):
            score_str = f" (score: {d['score']})" if d.get("score") else ""
            lines.append(f"{i}. {d['text']}{score_str}")

    if context.get("schema"):
        lines.append("\n=== RELEVANT SCHEMA ===")
        for i, s in enumerate(context["schema"], 1):
            score_str = f" (score: {s['score']})" if s.get("score") else ""
            lines.append(f"{i}. {s['text']}{score_str}")

    if context.get("few_shots"):
        lines.append("\n=== SIMILAR EXAMPLE QUERIES ===")
        for i, f in enumerate(context["few_shots"], 1):
            score_str = f" (score: {f['score']})" if f.get("score") else ""
            lines.append(f"{i}. {f['text']}{score_str}")

    if context.get("jargon"):
        lines.append("\n=== BUSINESS GLOSSARY ===")
        for i, j in enumerate(context["jargon"], 1):
            term = j["metadata"].get("term", "")
            defn = j["metadata"].get("definition", j["text"])
            score_str = f" (score: {j['score']})" if j.get("score") else ""
            lines.append(f"{i}. {term}: {defn}{score_str}")

    return "\n".join(lines)


# ── Quick test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_query = "Which channels have the biggest drop-off between processed and published?"

    print(f"Test query: {test_query}\n")
    print("=" * 60)

    context = retrieve_all_context(test_query)

    print(f"Metrics retrieved    : {len(context['metrics'])}")
    for m in context["metrics"]:
        print(f"  → {m['text'][:80]}... (score: {m['score']})")

    print(f"\nDimensions retrieved : {len(context['dimensions'])}")
    for d in context["dimensions"]:
        print(f"  → {d['text'][:80]}... (score: {d['score']})")

    print(f"\nFew-shots retrieved  : {len(context['few_shots'])}")
    for f in context["few_shots"]:
        print(f"  → {f['text'][:80]}... (score: {f['score']})")

    print(f"\nSchema retrieved     : {len(context['schema'])}")
    for s in context["schema"]:
        print(f"  → {s['text'][:80]}... (score: {s['score']})")

    print("\n" + "=" * 60)
    print("FORMATTED PROMPT CONTEXT:")
    print("=" * 60)
    print(format_context_for_prompt(context))