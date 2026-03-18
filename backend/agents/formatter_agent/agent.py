"""
formatter_agent.py
------------------
LangChain LLMChain for Result Formatting.

Replaces the raw Gemini API call in nlq/agents/result_formatter.py
with a LangChain chain. No tools needed — pure LLM formatting.

Key: chart_data values are still computed in Python (never trust LLM for numbers).
"""

import os
import json
import re
import sys
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv, find_dotenv

from prompts.formatter_prompt import formatter_prompt

load_dotenv(find_dotenv())

# ── LLM ──────────────────────────────────────────────────────────────────────
MODEL_NAME = "gpt-4.1-mini"

llm = ChatOpenAI(
    model=MODEL_NAME,
    temperature=0.2,
    max_tokens=2048,
)

# ── Chain ────────────────────────────────────────────────────────────────────
_chain = formatter_prompt | llm | StrOutputParser()


# ── Python-computed chart data (never trust LLM for values) ──────────────────

def _compute_chart_data(execution_result: dict, plan_result: dict) -> dict:
    """Python-computed chart labels and values."""
    columns = execution_result.get("columns", [])
    rows = execution_result.get("rows", [])

    if not rows or not columns:
        return {"labels": [], "values": [], "value_label": "", "columns": columns, "rows": rows}

    if len(columns) == 1:
        value = rows[0].get(columns[0]) if rows else None
        return {"labels": [columns[0]], "values": [value], "value_label": columns[0],
                "columns": columns, "rows": rows}

    if len(columns) == 2:
        label_col, value_col = columns[0], columns[1]
        labels = [str(row.get(label_col, "")) for row in rows]
        values = []
        for row in rows:
            v = row.get(value_col)
            try:
                values.append(float(v) if v is not None else 0.0)
            except (TypeError, ValueError):
                values.append(0.0)
        return {"labels": labels, "values": values, "value_label": value_col,
                "columns": columns, "rows": rows}

    return {"labels": [], "values": [], "value_label": "", "columns": columns, "rows": rows}


def _compute_confidence(sql_result: dict, intent_result: dict, validation_result: dict) -> float:
    """Weighted confidence: SQL 50% + Intent 30% + Validation 20%."""
    sql_conf = float(sql_result.get("confidence_score", 0.0))
    intent_conf = float(intent_result.get("intent_confidence", 0.0))
    val_passed = 1.0 if validation_result.get("is_valid", False) else 0.0
    combined = (sql_conf * 0.5) + (intent_conf * 0.3) + (val_passed * 0.2)
    return round(max(0.0, min(1.0, combined)), 2)


def _format_query_results(execution_result: dict) -> str:
    """Format execution results for the prompt."""
    if not execution_result.get("success"):
        return json.dumps({"error": execution_result.get("error", "Unknown error")})
    columns = execution_result.get("columns", [])
    rows = execution_result.get("rows", [])
    if not rows:
        return json.dumps({"columns": columns, "rows": [], "row_count": 0})
    sample = rows[:50] if len(rows) <= 50 else random.sample(rows, 50)
    return json.dumps({"columns": columns, "rows": sample, "row_count": len(rows)}, default=str)


def _format_metadata(sql_result, validation_result, execution_result, intent_result, plan_result) -> str:
    """Build metadata string for the prompt."""
    return json.dumps({
        "confidence_score": sql_result.get("confidence_score", 0.0),
        "tables_used": sql_result.get("tables_used", []),
        "intent": intent_result.get("intent", ""),
        "entities": intent_result.get("entities", {}),
        "suggested_chart": plan_result.get("suggested_chart_type", "table"),
        "row_count": execution_result.get("row_count", 0),
        "truncated": execution_result.get("truncated", False),
    }, indent=2)


def _validate_and_fill(result: dict) -> dict:
    """Ensure all required fields exist."""
    defaults = {
        "nl_summary": "No summary available.", "chart_type": "table",
        "chart_title": "Query Results",
        "chart_data": {"labels": [], "values": [], "value_label": "", "columns": None, "rows": None},
        "applied_filters": {"metric": None, "dimensions": [], "filters": [], "time_period": None},
        "confidence_score": 0.0, "data_warnings": [], "follow_up_suggestions": []
    }
    for key, default in defaults.items():
        if key not in result:
            result[key] = default
    fuqs = result.get("follow_up_suggestions", [])
    if not isinstance(fuqs, list):
        fuqs = []
    result["follow_up_suggestions"] = fuqs[:2]
    return result


def _parse_output(output: str) -> dict:
    """Parse chain output."""
    cleaned = re.sub(r"```json|```", "", output).strip()
    try:
        parsed = json.loads(cleaned)
        return _validate_and_fill(parsed)
    except json.JSONDecodeError:
        return _validate_and_fill({"nl_summary": "Results retrieved but formatting failed."})


# ── Main function ────────────────────────────────────────────────────────────

def format_result(
    user_question: str,
    sql_result: dict,
    validation_result: dict,
    execution_result: dict,
    intent_result: dict,
    plan_result: dict | None = None,
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Format raw SQL results into a structured response with NL summary.

    Returns:
        dict with nl_summary, chart_type, chart_title, chart_data,
        applied_filters, confidence_score, data_warnings, follow_up_suggestions
    """
    if plan_result is None:
        plan_result = {}

    # guard: empty results
    if not execution_result.get("success") or not execution_result.get("rows"):
        error = execution_result.get("error", "")
        explanation = sql_result.get("sql_explanation", "")
        
        if explanation:
            # Use the SQL generator's own explanation as the summary
            summary = explanation
        elif "cannot be answered" in error.lower():
            summary = f"Unfortunately, this question cannot be answered with the current database schema. {error}"
        elif error:
            summary = f"The query encountered an issue: {error}"
        else:
            summary = "No data was found for this query. Try rephrasing or asking a different question."

        return _validate_and_fill({
            "nl_summary": summary, "chart_type": "table", "chart_title": "No Results",
            "chart_data": {"labels": [], "values": [], "value_label": "", "columns": [], "rows": []},
            "data_warnings": [error] if error else [],
            "confidence_score": _compute_confidence(sql_result, intent_result, validation_result)
        })

    try:
        output = _chain.invoke({
            "user_question": user_question,
            "executed_sql": sql_result.get("sql", ""),
            "query_results": _format_query_results(execution_result),
            "query_metadata": _format_metadata(
                sql_result, validation_result, execution_result, intent_result, plan_result
            ),
        })
        result = _parse_output(output)
    except Exception as e:
        print(f"  [FormatterAgent] Error: {e}")
        result = _validate_and_fill({
            "nl_summary": "Results retrieved but formatting failed.",
            "data_warnings": [str(e)]
        })

    # overwrite chart_data with Python-computed version
    result["chart_data"] = _compute_chart_data(execution_result, plan_result)
    result["confidence_score"] = _compute_confidence(sql_result, intent_result, validation_result)
    return result
