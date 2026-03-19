"""
knowledge_base.py
-----------------
Builds the ChromaDB vector store for the Frammer AI NL-to-SQL pipeline.

Collections created:
  - metrics     : 17 metric definitions
  - dimensions  : 8 dimension definitions
  - few_shots   : 56 NL->SQL examples
  - schema      : 16 table schema docs
  - kpi_knowledge: 58 KPI definitions from all 5 dashboard tabs  ← NEW

Embedding model: BAAI/bge-small-en-v1.5 (via sentence-transformers)
"""

import os
import json
import argparse
import chromadb
from chromadb.utils import embedding_functions

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = BASE_DIR
CHROMA_DIR  = os.path.join(os.path.dirname(BASE_DIR), "data", "chroma_db")

METRIC_FILE    = os.path.join(DATA_DIR, "metric_definitions.json")
DIM_FILE       = os.path.join(DATA_DIR, "dimension_definitions.json")
FEW_SHOT_FILE  = os.path.join(DATA_DIR, "few_shot_examples.json")
SCHEMA_FILE    = os.path.join(DATA_DIR, "schema_docs.json")
KPI_FILE       = os.path.join(DATA_DIR, "kpi_registry.json")       # NEW
TAB_FILE       = os.path.join(DATA_DIR, "tab_context.json")         # NEW

# ── Embedding model ────────────────────────────────────────────────────────────
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


def get_embedding_function():
    """Return ChromaDB-compatible sentence-transformer embedding function."""
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )


def load_json(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Collection builders ────────────────────────────────────────────────────────

def build_metrics_collection(client, ef):
    print("\n[1/5] Building 'metrics' collection...")
    col = client.get_or_create_collection(name="metrics", embedding_function=ef)
    data = load_json(METRIC_FILE)
    ids, documents, metadatas = [], [], []
    for m in data:
        ids.append(m["id"])
        documents.append(m["semantic_text"])
        metadatas.append({
            "name":          m["name"],
            "primary_table": m["primary_table"],
            "column":        m["column"],
            "unit":          m["unit"],
            "category":      m["category"],
            "aggregation":   m["aggregation"],
            "formula":       m["formula"],
        })
    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(ids)} metrics embedded.")
    return col


def build_dimensions_collection(client, ef):
    print("\n[2/5] Building 'dimensions' collection...")
    col = client.get_or_create_collection(name="dimensions", embedding_function=ef)
    data = load_json(DIM_FILE)
    ids, documents, metadatas = [], [], []
    for d in data:
        ids.append(d["id"])
        documents.append(d["semantic_text"])
        metadatas.append({
            "name":           d["name"],
            "table":          d["table"],
            "pk_column":      d["pk_column"],
            "label_column":   d["label_column"],
            "dimension_type": d["dimension_type"],
            "default_sort":   d["default_sort"],
            "join_key":       d["join_key"],
            "supported_metrics": "|".join(d["supported_metrics"]),
            "joins_to": "|".join(d["joins_to"]),
        })
    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(ids)} dimensions embedded.")
    return col


def build_few_shots_collection(client, ef):
    print("\n[3/5] Building 'few_shots' collection...")
    col = client.get_or_create_collection(name="few_shots", embedding_function=ef)
    data = load_json(FEW_SHOT_FILE)
    ids, documents, metadatas = [], [], []
    for ex in data:
        embed_text = f"{ex['question']} {ex['semantic_text']}"
        ids.append(ex["id"])
        documents.append(embed_text)
        metadatas.append({
            "category":   ex["category"],
            "question":   ex["question"],
            "metric":     ex["metric"],
            "sql":        ex["sql"],
            "chart_type": ex["chart_type"],
            "dimensions": "|".join(ex["dimensions"]) if ex["dimensions"] else "",
            "tables":     "|".join(ex["tables"]),
            "notes":      ex.get("notes", ""),
        })
    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(ids)} few-shot examples embedded.")
    return col


def build_schema_collection(client, ef):
    print("\n[4/5] Building 'schema' collection...")
    col = client.get_or_create_collection(name="schema", embedding_function=ef)
    data = load_json(SCHEMA_FILE)
    ids, documents, metadatas = [], [], []
    for s in data:
        ids.append(s["id"])
        documents.append(s["semantic_text"])
        metadatas.append({
            "table":     s["table"],
            "type":      s["type"],
            "row_count": s["row_count"],
            "notes":     s["notes"],
            "columns":   json.dumps([c["name"] for c in s["columns"]]),
            "joins":     json.dumps([j["join_table"] for j in s["joins"]]),
        })
    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(ids)} schema docs embedded.")
    return col


# ── NEW: KPI Knowledge Collection ─────────────────────────────────────────────

def _build_kpi_embed_text(kpi: dict) -> str:
    """
    Build a rich embedding text for a KPI entry combining all searchable fields.
    Synonyms + description + formula make semantic search highly effective.
    """
    parts = [
        kpi["name"],
        kpi["description"],
        f"Formula: {kpi['formula']}",
        f"Tab: {kpi['tab']}",
        f"Category: {kpi['category']}",
        f"Unit: {kpi['unit']}",
    ]
    if kpi.get("synonyms"):
        parts.append("Also known as: " + ", ".join(kpi["synonyms"]))
    if kpi.get("tags"):
        parts.append("Tags: " + ", ".join(kpi["tags"]))
    return " | ".join(parts)


def build_kpi_collection(client, ef):
    """
    Embeds kpi_registry.json + tab_context.json into 'kpi_knowledge' collection.

    Two document types are stored:
      1. kpi_<id>   — individual KPI definitions (58 entries)
      2. tab_<id>   — tab context docs (5 entries) for "which tab shows X?" queries

    Embedding text uses _build_kpi_embed_text() which packs name + description +
    formula + synonyms + tags for maximum semantic recall.
    """
    print("\n[5/5] Building 'kpi_knowledge' collection...")
    col = client.get_or_create_collection(name="kpi_knowledge", embedding_function=ef)

    ids, documents, metadatas = [], [], []

    # ── Part 1: Individual KPI entries ──────────────────────────────────────
    kpi_data = load_json(KPI_FILE)
    for kpi in kpi_data:
        doc_id = f"kpi_{kpi['id']}"
        embed_text = _build_kpi_embed_text(kpi)
        ids.append(doc_id)
        documents.append(embed_text)
        metadatas.append({
            "doc_type":    "kpi",
            "kpi_id":      kpi["id"],
            "name":        kpi["name"],
            "tab":         kpi["tab"],
            "tab_id":      kpi["tab_id"],
            "formula":     kpi["formula"],
            "sql_hint":    kpi["sql_hint"],
            "unit":        kpi["unit"],
            "category":    kpi["category"],
            "description": kpi["description"][:500],  # ChromaDB metadata size limit
            # Lists stored as pipe-separated strings (ChromaDB only accepts scalars)
            "synonyms":    "|".join(kpi.get("synonyms", [])),
            "tags":        "|".join(kpi.get("tags", [])),
            "related_kpi_ids": "|".join(kpi.get("related_kpi_ids", [])),
            "related_dimensions": "|".join(kpi.get("related_dimensions", [])),
        })

    # ── Part 2: Tab context entries ──────────────────────────────────────────
    tab_data = load_json(TAB_FILE)
    for tab in tab_data:
        doc_id = f"tab_{tab['tab_id']}"
        # Embed text combines tab purpose + sample questions for Q routing
        sample_qs = " | ".join(tab.get("sample_questions", []))
        embed_text = (
            f"{tab['tab_name']}: {tab['purpose']} "
            f"Sample questions: {sample_qs}"
        )
        ids.append(doc_id)
        documents.append(embed_text)
        metadatas.append({
            "doc_type":    "tab",
            "tab_id":      tab["tab_id"],
            "tab_name":    tab["tab_name"],
            "purpose":     tab["purpose"][:400],
            "kpi_ids":     "|".join(tab.get("kpi_ids", [])),
            "key_tables":  "|".join(tab.get("key_tables", [])),
        })

    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(kpi_data)} KPI entries + {len(tab_data)} tab context docs embedded.")
    return col


# ── Verification ───────────────────────────────────────────────────────────────

def verify(client, ef):
    """Run 5 sample semantic queries — one per collection — to confirm retrieval."""
    print("\n── Verification Queries ──────────────────────────────────────────")

    tests = [
        {"collection": "metrics",       "query": "how many videos were uploaded",      "expect": "metric_001"},
        {"collection": "dimensions",    "query": "show data by channel or workspace",  "expect": "dim_001"},
        {"collection": "few_shots",     "query": "top channels by published videos",   "expect": "fs_025"},
        {"collection": "schema",        "query": "monthly trend table for uploaded and published counts", "expect": "schema_012"},
        {"collection": "kpi_knowledge", "query": "what is publish rate and how is it calculated", "expect": "kpi_kpi_009"},
    ]

    all_passed = True
    for t in tests:
        col = client.get_collection(name=t["collection"], embedding_function=ef)
        results = col.query(query_texts=[t["query"]], n_results=3)
        top_ids = results["ids"][0]
        passed = t["expect"] in top_ids
        status = "✓ PASS" if passed else "✗ FAIL (check semantic_text quality)"
        if not passed:
            all_passed = False
        print(f"\n  [{t['collection']}] Query: \"{t['query']}\"")
        print(f"    Expected: {t['expect']}  |  Top 3: {top_ids}  |  {status}")

    print(f"\n{'All verification queries passed ✓' if all_passed else 'Some queries failed — check semantic_text quality'}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main(run_verify: bool = False):
    print("=" * 60)
    print("Frammer AI — Knowledge Base Builder")
    print(f"Embedding model : {EMBEDDING_MODEL}")
    print(f"ChromaDB path   : {CHROMA_DIR}")
    print("=" * 60)

    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)

    print(f"\nLoading embedding model '{EMBEDDING_MODEL}'...")
    ef = get_embedding_function()
    print("  ✓ Model loaded.")

    build_metrics_collection(client, ef)
    build_dimensions_collection(client, ef)
    build_few_shots_collection(client, ef)
    build_schema_collection(client, ef)
    build_kpi_collection(client, ef)   # NEW

    print("\n── Collection Summary ────────────────────────────────────────────")
    for name in ["metrics", "dimensions", "few_shots", "schema", "kpi_knowledge"]:
        col = client.get_collection(name=name, embedding_function=ef)
        print(f"  {name:<20} {col.count()} documents")

    print("\n✓ Knowledge base built successfully.")
    print(f"  Stored at: {CHROMA_DIR}")

    if run_verify:
        verify(client, ef)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Frammer AI ChromaDB knowledge base.")
    parser.add_argument("--verify", action="store_true", help="Run verification queries after building.")
    args = parser.parse_args()
    main(run_verify=args.verify)