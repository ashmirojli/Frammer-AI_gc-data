"""
planner_agent.py
----------------
LangChain LLMChain Agent for Query Planning with Chain-of-Thought reasoning.

Replaces the pure Python rule-based planner in nlq/agents/query_planner.py
with an LLM-powered CoT planner that reasons about:
  - Aggregation strategy
  - JOIN requirements
  - Derived metrics
  - CTE necessity
  - Output shape and chart type
"""

import os
import json
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv, find_dotenv

from prompts.planner_prompt import planner_prompt

load_dotenv(find_dotenv())

# ── LLM ──────────────────────────────────────────────────────────────────────
MODEL_NAME = "gpt-4.1-mini"

llm = ChatOpenAI(
    model=MODEL_NAME,
    temperature=0.2,
    max_tokens=2048,
)

# ── Chain (no tools — pure LLM reasoning) ────────────────────────────────────
_chain = planner_prompt | llm | StrOutputParser()


def _validate_and_fill(result: dict) -> dict:
    """Ensure all required plan fields exist."""
    defaults = {
        "reasoning": "",
        "plan_steps": [],
        "requires_cte": False,
        "cte_reason": None,
        "is_derived_metric": False,
        "derived_metric_formula": None,
        "expected_output_shape": "multi_row_multi_col",
        "suggested_chart_type": "table",
        "chart_reasoning": "",
        "warnings": []
    }
    for key, default in defaults.items():
        if key not in result:
            result[key] = default
    return result


def _parse_output(output: str) -> dict:
    """Parse LLM output to JSON."""
    cleaned = re.sub(r"```json|```", "", output).strip()
    try:
        parsed = json.loads(cleaned)
        return _validate_and_fill(parsed)
    except json.JSONDecodeError:
        return _validate_and_fill({"warnings": ["Failed to parse planner output."]})


# ── Main function ────────────────────────────────────────────────────────────

def plan_query(
    user_question: str,
    intent_result: dict,
    schema_result: dict,
    retrieved_context: dict | None = None,
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Create a logical step-by-step plan for SQL generation using CoT.

    Args:
        user_question        : raw user input
        intent_result        : output from intent_agent
        schema_result        : output from table_agent
        retrieved_context    : (optional, for interface compat)
        conversation_history : (optional, for interface compat)

    Returns:
        dict with plan_steps, requires_cte, is_derived_metric,
        expected_output_shape, suggested_chart_type, etc.
    """
    try:
        output = _chain.invoke({
            "user_question": user_question,
            "intent_result": json.dumps(intent_result, indent=2),
            "schema_result": json.dumps(schema_result, indent=2),
        })
        return _parse_output(output)
    except Exception as e:
        print(f"  [PlannerAgent] Error: {e}")
        return _validate_and_fill({"warnings": [f"Planner error: {str(e)}"]})
