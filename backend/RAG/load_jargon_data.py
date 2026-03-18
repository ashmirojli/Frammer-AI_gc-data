"""
load_jargon_data.py
-------------------
Loads business glossary terms from business_glossary.json into
the ChromaDB 'business_jargon' collection.

Run once:  python load_jargon_data.py
"""

import json
import os
import chromadb
from chromadb.utils import embedding_functions

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CHROMA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data", "chroma_db")
GLOSSARY   = os.path.join(BASE_DIR, "business_glossary.json")

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


def create_jargon_collection():
    """Load business_glossary.json and upsert every term into ChromaDB."""

    # ── Read glossary ────────────────────────────────────────────────────
    with open(GLOSSARY, "r") as f:
        entries = json.load(f)

    if not entries:
        print("⚠  business_glossary.json is empty — nothing to load.")
        return

    # ── Connect to ChromaDB ──────────────────────────────────────────────
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = client.get_or_create_collection(
        name="business_jargon",
        embedding_function=ef,
    )

    # ── Build parallel lists ─────────────────────────────────────────────
    ids       = [e["id"] for e in entries]
    documents = [e.get("semantic_text", e["definition"]) for e in entries]
    metadatas = [
        {"term": e["term"], "definition": e["definition"]}
        for e in entries
    ]

    # Upsert so the script is idempotent
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)

    print(f"✅ Loaded {len(ids)} business glossary terms into 'business_jargon' collection.")


if __name__ == "__main__":
    create_jargon_collection()