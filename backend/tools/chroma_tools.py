"""
chroma_tools.py
---------------
LangChain @tool wrappers around the RAG retriever functions.
These tools are callable by ReAct agents (Intent, Table, SQL Generator).

Each tool accepts a natural-language query string and returns
formatted retrieval results from the ChromaDB vector store.
"""

import json
from langchain_core.tools import tool

# Import retriever functions from the RAG module
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from RAG.retriever import (
    retrieve_metrics,
    retrieve_dimensions,
    retrieve_few_shots,
    retrieve_schema,
    retrieve_all_context,
    format_context_for_prompt,
)


# ── Tool: Retrieve Metrics ───────────────────────────────────────────────────

@tool
def chroma_retrieve_metrics(query: str) -> str:
    """Retrieve relevant KPI metric definitions from the ChromaDB knowledge base.

    Use this tool when you need to understand which metrics exist in the database,
    what columns they correspond to, and how they are aggregated.

    Args:
        query: A natural language description of the metric to search for.

    Returns:
        A JSON string with the top 3 most relevant metric definitions,
        including name, primary_table, column, unit, category, aggregation, and formula.
    """
    results = retrieve_metrics(query, top_k=3)
    return json.dumps(results, indent=2)


# ── Tool: Retrieve Dimensions ────────────────────────────────────────────────

@tool
def chroma_retrieve_dimensions(query: str) -> str:
    """Retrieve relevant dimension definitions from the ChromaDB knowledge base.

    Use this tool when you need to understand which dimensions (groupings) are
    available, what tables they map to, and how to join them.

    Args:
        query: A natural language description of the dimension to search for.

    Returns:
        A JSON string with the top 3 most relevant dimension definitions,
        including name, table, pk_column, label_column, join_key, and supported_metrics.
    """
    results = retrieve_dimensions(query, top_k=3)
    return json.dumps(results, indent=2)


# ── Tool: Retrieve Few-Shot Examples ─────────────────────────────────────────

@tool
def chroma_retrieve_few_shots(query: str) -> str:
    """Retrieve similar NL→SQL example queries from the ChromaDB knowledge base.

    Use this tool when writing SQL to find reference examples that show how
    similar questions were previously translated to SQL queries.

    Args:
        query: A natural language question to find similar examples for.

    Returns:
        A JSON string with the top 5 most similar NL→SQL examples,
        including the natural language question, SQL query, tables used,
        chart_type, and dimensions.
    """
    results = retrieve_few_shots(query, top_k=5)
    return json.dumps(results, indent=2)


# ── Tool: Retrieve Schema Docs ───────────────────────────────────────────────

@tool
def chroma_retrieve_schema(query: str) -> str:
    """Retrieve schema documentation for relevant database tables from ChromaDB.

    Use this tool when you need to understand the structure of specific tables,
    their columns, joins, and relationships.

    Args:
        query: A natural language description of what schema information is needed.

    Returns:
        A JSON string with the top 4 most relevant table schema documents,
        including table name, type (fact/dim), columns, and join information.
    """
    results = retrieve_schema(query, top_k=4)
    return json.dumps(results, indent=2)


# ── Tool: Retrieve All Context ───────────────────────────────────────────────

@tool
def chroma_retrieve_all(query: str) -> str:
    """Retrieve all context (metrics, dimensions, few-shots, schema) from ChromaDB in one call.

    Use this tool when you need a comprehensive understanding of the database
    before making decisions. Returns all 4 types of context at once.

    Args:
        query: A natural language question to retrieve full context for.

    Returns:
        A formatted string combining relevant metrics, dimensions, schema docs,
        and similar example queries — ready to be used as LLM context.
    """
    context = retrieve_all_context(query)
    return format_context_for_prompt(context)


# ── Convenience: get all tools as a list ─────────────────────────────────────

def get_chroma_tools() -> list:
    """Return all ChromaDB retrieval tools as a list for agent binding."""
    return [
        chroma_retrieve_metrics,
        chroma_retrieve_dimensions,
        chroma_retrieve_few_shots,
        chroma_retrieve_schema,
        chroma_retrieve_all,
    ]
