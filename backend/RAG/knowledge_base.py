"""
knowledge_base.py
-----------------
Builds the ChromaDB vector store for the Frammer AI NL-to-SQL pipeline.

Collections created:
  - metrics     : 17 metric definitions
  - dimensions  : 8 dimension definitions
  - few_shots   : 56 NL->SQL examples
  - schema      : 16 table schema docs

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
    """
    Embeds metric_definitions.json into the 'metrics' collection.
    Embedding text : semantic_text
    Metadata stored: id, name, primary_table, column, unit, category, aggregation
    """
    print("\n[1/4] Building 'metrics' collection...")
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
    """
    Embeds dimension_definitions.json into the 'dimensions' collection.
    Embedding text : semantic_text
    Metadata stored: id, name, table, pk_column, label_column, dimension_type,
                     default_sort, join_key
    """
    print("\n[2/4] Building 'dimensions' collection...")
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
            # store supported_metrics as pipe-separated string (ChromaDB only allows scalar metadata)
            "supported_metrics": "|".join(d["supported_metrics"]),
            # store joins_to as pipe-separated string
            "joins_to": "|".join(d["joins_to"]),
        })

    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(ids)} dimensions embedded.")
    return col


def build_few_shots_collection(client, ef):
    """
    Embeds few_shot_examples.json into the 'few_shots' collection.
    Embedding text : semantic_text  (rich synonyms for retrieval)
    Metadata stored: id, category, question, metric, sql, chart_type,
                     dimensions (pipe-sep), tables (pipe-sep), notes
    """
    print("\n[3/4] Building 'few_shots' collection...")
    col = client.get_or_create_collection(name="few_shots", embedding_function=ef)

    data = load_json(FEW_SHOT_FILE)

    ids, documents, metadatas = [], [], []
    for ex in data:
        # Combine question + semantic_text for richer embedding
        embed_text = f"{ex['question']} {ex['semantic_text']}"
        ids.append(ex["id"])
        documents.append(embed_text)
        metadatas.append({
            "category":   ex["category"],
            "question":   ex["question"],
            "metric":     ex["metric"],
            "sql":        ex["sql"],
            "chart_type": ex["chart_type"],
            # lists → pipe-separated strings
            "dimensions": "|".join(ex["dimensions"]) if ex["dimensions"] else "",
            "tables":     "|".join(ex["tables"]),
            "notes":      ex.get("notes", ""),
        })

    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(ids)} few-shot examples embedded.")
    return col


def build_schema_collection(client, ef):
    """
    Embeds schema_docs.json into the 'schema' collection.
    Embedding text : semantic_text
    Metadata stored: id, table, type, row_count, notes
                     columns and joins stored as JSON strings
    """
    print("\n[4/4] Building 'schema' collection...")
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
            # store columns and joins as JSON strings for retrieval
            "columns":   json.dumps([c["name"] for c in s["columns"]]),
            "joins":     json.dumps([j["join_table"] for j in s["joins"]]),
        })

    col.upsert(ids=ids, documents=documents, metadatas=metadatas)
    print(f"  ✓ {len(ids)} schema docs embedded.")
    return col


# ── Verification ───────────────────────────────────────────────────────────────

def verify(client, ef):
    """Run 4 sample semantic queries — one per collection — to confirm retrieval works."""
    print("\n── Verification Queries ──────────────────────────────────────────")

    tests = [
        {
            "collection": "metrics",
            "query": "how many videos were uploaded",
            "expect": "metric_001"
        },
        {
            "collection": "dimensions",
            "query": "show data by channel or workspace",
            "expect": "dim_001"
        },
        {
            "collection": "few_shots",
            "query": "top channels by published videos",
            "expect": "fs_025"
        },
        {
            "collection": "schema",
            "query": "monthly trend table for uploaded and published counts",
            "expect": "schema_012"
        },
    ]

    all_passed = True
    for t in tests:
        col = client.get_collection(name=t["collection"], embedding_function=ef)
        results = col.query(query_texts=[t["query"]], n_results=3)
        top_ids = results["ids"][0]
        passed = t["expect"] in top_ids
        status = "✓ PASS" if passed else "✗ FAIL"
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

    # Create ChromaDB persistent client
    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)

    # Load embedding function once (shared across all collections)
    print(f"\nLoading embedding model '{EMBEDDING_MODEL}'...")
    ef = get_embedding_function()
    print("  ✓ Model loaded.")

    # Build all 4 collections
    build_metrics_collection(client, ef)
    build_dimensions_collection(client, ef)
    build_few_shots_collection(client, ef)
    build_schema_collection(client, ef)

    # Summary
    print("\n── Collection Summary ────────────────────────────────────────────")
    for name in ["metrics", "dimensions", "few_shots", "schema"]:
        col = client.get_collection(name=name, embedding_function=ef)
        print(f"  {name:<15} {col.count()} documents")

    print("\n✓ Knowledge base built successfully.")
    print(f"  Stored at: {CHROMA_DIR}")

    if run_verify:
        verify(client, ef)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Frammer AI ChromaDB knowledge base.")
    parser.add_argument("--verify", action="store_true", help="Run verification queries after building.")
    args = parser.parse_args()
    main(run_verify=args.verify)