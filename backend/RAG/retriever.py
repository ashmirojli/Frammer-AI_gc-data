"""
retriever.py
------------
ChromaDB retrieval layer for the Frammer AI NL-to-SQL pipeline.
Used by all agents to fetch relevant context before SQL generation.

NEW: retrieve_kpi_knowledge() — retrieves KPI definitions, formulas,
     and tab context for the RAG (kpi_info / hybrid) path.
"""

import os
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
from dotenv import load_dotenv

load_dotenv()

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))   # backend/RAG/
BACKEND_DIR = os.path.dirname(BASE_DIR)                    # backend/
CHROMA_DIR  = os.path.join(BACKEND_DIR, "data", "chroma_db")

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


# ── Existing retrieval functions ──────────────────────────────────────────────

def retrieve_metrics(query: str, top_k: int = 6) -> list[dict]:
    """Retrieve top_k most relevant metrics. Used by: Schema Linker."""
    collection = get_collection("metrics")
    results = collection.query(
        query_texts=[query], n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_dimensions(query: str, top_k: int = 6) -> list[dict]:
    """Retrieve top_k most relevant dimensions. Used by: Schema Linker."""
    collection = get_collection("dimensions")
    results = collection.query(
        query_texts=[query], n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_few_shots(query: str, top_k: int = 8) -> list[dict]:
    """Retrieve top_k most similar few-shot NL->SQL examples. Used by: SQL Generator."""
    collection = get_collection("few_shots")
    results = collection.query(
        query_texts=[query], n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_schema(query: str, top_k: int = 6) -> list[dict]:
    """Retrieve top_k most relevant schema/table docs. Used by: SQL Generator, SQL Validator."""
    collection = get_collection("schema")
    results = collection.query(
        query_texts=[query], n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    return _format_results(results, top_k)


def retrieve_jargon(query: str, top_k: int = 3) -> list[dict]:
    """Retrieve top_k business jargon definitions. Used by: Intent Agent, SQL Generator."""
    try:
        collection = get_collection("business_jargon")
        results = collection.query(
            query_texts=[query], n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        return _format_results(results, top_k)
    except Exception:
        return []


# ── NEW: KPI Knowledge Retrieval ─────────────────────────────────────────────

def retrieve_kpi_knowledge(query: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve top_k most relevant KPI definitions and tab context from the
    kpi_knowledge ChromaDB collection.

    Returns both 'kpi' doc_type entries (individual KPI definitions) and
    'tab' doc_type entries (which tab to find a KPI in).

    Used by: orchestrator kpi_rag node → insight_generator_agent for RAG answers.

    Args:
        query: user's natural language question about a KPI
        top_k: number of documents to retrieve (default 5)

    Returns:
        list of dicts with keys: text, metadata, distance, score
        metadata contains: doc_type, kpi_id/tab_id, name, formula,
                           sql_hint, tab, description, synonyms, etc.
    """
    try:
        collection = get_collection("kpi_knowledge")
        results = collection.query(
            query_texts=[query],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        return _format_results(results, top_k)
    except Exception as e:
        print(f"  ⚠ KPI knowledge retrieval failed: {e}")
        return []


def retrieve_all_context(query: str) -> dict:
    """
    Master retrieval function — fetches all collections at once.
    Returns a single context dict used by the orchestrator.
    """
    return {
        "metrics":    retrieve_metrics(query,    top_k=4),
        "dimensions": retrieve_dimensions(query, top_k=4),
        "few_shots":  retrieve_few_shots(query,  top_k=5),
        "schema":     retrieve_schema(query,     top_k=4),
        "jargon":     retrieve_jargon(query,     top_k=2),
    }


# ── Helper ────────────────────────────────────────────────────────────────────

MIN_SCORE     = 0.65
SCORE_GAP_MAX = 0.04

def _format_results(results: dict, top_k: int) -> list[dict]:
    """
    Flatten ChromaDB results into a clean list of dicts.
    Uses 1/(1+distance) for safe similarity conversion.
    Dynamic cutoff: must exceed MIN_SCORE and be within SCORE_GAP_MAX of best result.
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

        if score < MIN_SCORE:
            continue

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
    ready to be injected into a prompt.
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


def format_kpi_context_for_prompt(kpi_results: list[dict]) -> str:
    """
    Format retrieved KPI knowledge into a clean string for the
    insight_generator_agent RAG answer prompt.
    Separates KPI definitions from tab context.
    """
    lines = []

    kpi_entries = [r for r in kpi_results if r["metadata"].get("doc_type") == "kpi"]
    tab_entries = [r for r in kpi_results if r["metadata"].get("doc_type") == "tab"]

    if kpi_entries:
        lines.append("=== KPI DEFINITIONS ===")
        for r in kpi_entries:
            m = r["metadata"]
            lines.append(f"\nKPI: {m.get('name', '')}")
            lines.append(f"  Description : {m.get('description', '')}")
            lines.append(f"  Formula     : {m.get('formula', '')}")
            lines.append(f"  Unit        : {m.get('unit', '')}")
            lines.append(f"  Tab         : {m.get('tab', '')}")
            if m.get("sql_hint"):
                lines.append(f"  SQL Hint    : {m.get('sql_hint', '')}")
            if m.get("synonyms"):
                lines.append(f"  Also called : {m['synonyms'].replace('|', ', ')}")

    if tab_entries:
        lines.append("\n=== TAB CONTEXT ===")
        for r in tab_entries:
            m = r["metadata"]
            lines.append(f"\nTab: {m.get('tab_name', '')} ({m.get('tab_id', '')})")
            lines.append(f"  Purpose: {m.get('purpose', '')}")

    return "\n".join(lines)


# ── Quick test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_query = "What is publish rate and how is it calculated?"

    print(f"Test query: {test_query}\n")
    print("=" * 60)

    kpi_results = retrieve_kpi_knowledge(test_query, top_k=5)
    print(f"KPI docs retrieved: {len(kpi_results)}")
    for r in kpi_results:
        doc_type = r["metadata"].get("doc_type", "?")
        name = r["metadata"].get("name", r["metadata"].get("tab_name", "?"))
        print(f"  [{doc_type}] {name} (score: {r['score']})")

    print("\n" + "=" * 60)
    print("FORMATTED KPI CONTEXT:")
    print("=" * 60)
    print(format_kpi_context_for_prompt(kpi_results))