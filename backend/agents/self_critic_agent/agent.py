"""
self_critic_agent.py
--------------------
Self-Critic Agent — performs SEMANTIC/LOGICAL validation of generated SQL.

Inserted between the SQL Generator and SQL Validator in the pipeline.
Checks whether the SQL logically answers the user's question, not just
whether it has correct syntax.

Validates: aggregation, joins, GROUP BY, filters, ORDER BY + LIMIT,
           correct metric columns, and duration handling.
"""

import os
import json
import re
import sys
import signal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from prompts.self_critic_prompt import self_critic_prompt

# ── LLM ──────────────────────────────────────────────────────────────────────
MODEL_NAME = "gpt-4.1"

llm = ChatOpenAI(
    model=MODEL_NAME,
    temperature=0.0,
)

# ── Timeout helper ────────────────────────────────────────────────────────────
AGENT_TIMEOUT = 60  # seconds


class _Timeout(Exception):
    pass


def _invoke_with_timeout(payload, timeout=AGENT_TIMEOUT):
    """Invoke the LLM with a thread-safe timeout."""
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(llm.invoke, payload)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            raise _Timeout(f"Self-Critic Agent timed out after {timeout}s")


# ── Output parsing ────────────────────────────────────────────────────────────

def _validate_and_fill(result: dict) -> dict:
    """Ensure all required fields exist with safe defaults."""
    defaults = {
        "is_correct": True,
        "issues": [],
        "corrected_sql": None,
        "reasoning": "No analysis performed.",
        "checks": {
            "aggregation": True,
            "joins": True,
            "group_by": True,
            "filters": True,
            "order_limit": True,
            "correct_metric": True,
        },
    }
    for key, default in defaults.items():
        if key not in result:
            result[key] = default
    if "checks" in result and isinstance(result["checks"], dict):
        for ck, cv in defaults["checks"].items():
            if ck not in result["checks"]:
                result["checks"][ck] = cv
    return result


def _parse_output(output) -> dict:
    """Parse LLM output string to JSON dict."""
    text = str(output).strip()
    # Strip markdown code fences
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()

    # Extract the first JSON object using brace matching
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    json_str = text[start : i + 1]
                    try:
                        parsed = json.loads(json_str)
                        return _validate_and_fill(parsed)
                    except json.JSONDecodeError:
                        break

    return _validate_and_fill({"is_correct": True, "reasoning": "Could not parse critic output — passing through."})


# ── Main function ────────────────────────────────────────────────────────────

def critique_sql(
    sql: str,
    user_question: str,
    intent_result: dict,
    schema_result: dict,
    plan_result: dict,
) -> dict:
    """
    Perform semantic/logical validation of the generated SQL.

    Args:
        sql             : the generated SQL string
        user_question   : original natural language question
        intent_result   : output from intent agent
        schema_result   : output from table agent
        plan_result     : output from query planner

    Returns:
        dict with is_correct, issues, corrected_sql, reasoning, checks
    """
    # Fast-path: if no SQL was generated, skip the critic
    if not sql or not sql.strip():
        return _validate_and_fill({
            "is_correct": False,
            "issues": ["No SQL was generated — nothing to critique."],
            "corrected_sql": "",
            "reasoning": "SQL Generator produced empty output.",
        })

    input_str = (
        f"User Question: {user_question}\n\n"
        f"Generated SQL:\n{sql}\n\n"
        f"Intent: {intent_result.get('intent', 'unknown')}\n"
        f"Entities: {json.dumps(intent_result.get('entities', {}), indent=2)}\n\n"
        f"Primary Table: {schema_result.get('primary_table', 'unknown')}\n"
        f"Dimension Tables: {json.dumps(schema_result.get('dimension_tables', []))}\n"
        f"Joins: {json.dumps(schema_result.get('joins', []))}\n"
        f"Metric Columns: {json.dumps(schema_result.get('metric_columns', []))}\n"
        f"Group By: {json.dumps(schema_result.get('group_by_columns', []))}\n\n"
        f"Query Plan Steps: {json.dumps(plan_result.get('plan_steps', []))}\n"
        f"Expected Output Shape: {plan_result.get('expected_output_shape', 'unknown')}"
    )

    try:
        messages = [
            {"role": "system", "content": self_critic_prompt},
            {"role": "user", "content": input_str},
        ]
        response = _invoke_with_timeout(messages)
        return _parse_output(response.content)
    except Exception as e:
        print(f"  [SelfCriticAgent] Error: {e}")
        # On error, pass through (don't block the pipeline)
        return _validate_and_fill({
            "is_correct": True,
            "reasoning": f"Self-Critic encountered an error: {str(e)} — passing through.",
        })


# ── Quick test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_sql = """SELECT channel_name, uploaded_count
FROM fact_user_channel
ORDER BY uploaded_count DESC
LIMIT 5"""

    test_intent = {
        "intent": "channel_analysis",
        "entities": {"metric": "upload count", "dimensions": ["channel"], "limit": 5},
    }
    test_schema = {
        "primary_table": "fact_user_channel",
        "dimension_tables": ["dim_channel"],
        "joins": [{"from": "fact_user_channel", "to": "dim_channel", "on": "channel_id"}],
        "metric_columns": ["uploaded_count"],
        "group_by_columns": ["channel_name"],
    }
    test_plan = {"plan_steps": ["Aggregate uploads by channel", "Order DESC", "Limit 5"]}

    print("=== Self-Critic Test ===")
    result = critique_sql(
        sql=test_sql,
        user_question="Top 5 channels by upload count",
        intent_result=test_intent,
        schema_result=test_schema,
        plan_result=test_plan,
    )
    print(json.dumps(result, indent=2))
