"""
insight_generator_agent.py
--------------------------
Insight Generator Agent — generates data insights from query results.
Runs in parallel with the Formatter after SQL execution.

Uses gpt-4.1-mini for cost efficiency.
"""

import os
import sys
import json
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain_openai import ChatOpenAI
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

# ── LLM ──────────────────────────────────────────────────────────────────────
llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0.3, max_tokens=1024)

# ── Prompt ───────────────────────────────────────────────────────────────────
INSIGHT_SYSTEM_PROMPT = """\
You are a Data Insight Generator for Frammer AI's analytics platform.
Given the user's question, the SQL that was executed, and the query results,
generate 2-3 concise, actionable insights.

Rules:
- Each insight should be 1-2 sentences maximum.
- Focus on patterns, anomalies, or notable findings in the data.
- Use specific numbers from the results when possible.
- Do NOT repeat the question or describe the SQL.

Output format (JSON):
{
  "insights": ["insight 1", "insight 2", "insight 3"],
  "data_quality_notes": ["any data quality observations, or empty list"]
}
"""


def generate_insights(
    user_question: str,
    sql: str,
    execution_result: dict,
) -> dict:
    """
    Generate data insights from query results.

    Args:
        user_question:    original user question
        sql:              the executed SQL
        execution_result: output from executor (with rows, columns, etc.)

    Returns:
        dict with insights (list[str]) and data_quality_notes (list[str])
    """
    if not execution_result.get("success") or not execution_result.get("rows"):
        return {
            "insights": ["No data returned — cannot generate insights."],
            "data_quality_notes": [],
        }

    # Format result data concisely (limit to 20 rows)
    columns = execution_result.get("columns", [])
    rows = execution_result.get("rows", [])[:20]
    row_count = execution_result.get("row_count", len(rows))

    data_str = f"Columns: {columns}\n"
    for row in rows:
        if isinstance(row, dict):
            data_str += str(row) + "\n"
        else:
            data_str += str(dict(zip(columns, row))) + "\n"
    if row_count > 20:
        data_str += f"... ({row_count} total rows, showing first 20)\n"

    try:
        messages = [
            {"role": "system", "content": INSIGHT_SYSTEM_PROMPT},
            {"role": "user", "content": (
                f"Question: {user_question}\n"
                f"SQL: {sql}\n"
                f"Results ({row_count} rows):\n{data_str}"
            )},
        ]
        response = llm.invoke(messages)
        text = response.content.strip()

        # Parse JSON
        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*", "", text)
        start = text.find("{")
        if start != -1:
            depth = 0
            for i in range(start, len(text)):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        parsed = json.loads(text[start:i+1])
                        return {
                            "insights": parsed.get("insights", []),
                            "data_quality_notes": parsed.get("data_quality_notes", []),
                        }

        return {"insights": [text], "data_quality_notes": []}
    except Exception as e:
        return {
            "insights": [f"Insight generation failed: {str(e)}"],
            "data_quality_notes": [],
        }
