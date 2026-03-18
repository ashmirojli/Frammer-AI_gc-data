"""
jargon_rag.py
-------------
Retrieves business jargon / glossary terms from the
'business_jargon' ChromaDB collection.

Uses the shared singleton client from retriever.py so
we don't open a second ChromaDB handle.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from RAG.retriever import get_collection, _format_results


def retrieve_business_terms(query: str, top_k: int = 3) -> list[dict]:
    """Return the most relevant business glossary definitions for *query*."""
    collection = get_collection("business_jargon")
    results = collection.query(
        query_texts=[query],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    return _format_results(results, top_k)


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    test_queries = [
        "Which channels have the biggest drop-off?",
        "Top users by uploaded videos",
        "Show monthly publishing trend",
    ]
    for q in test_queries:
        print(f"\nQuery: {q}")
        terms = retrieve_business_terms(q)
        print("Retrieved Terms:")
        for t in terms:
            term = t["metadata"].get("term", "?")
            defn = t["metadata"].get("definition", t["text"])
            print(f"  - {term}: {defn}  (score: {t['score']})")