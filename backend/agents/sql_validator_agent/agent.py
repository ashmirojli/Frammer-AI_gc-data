"""
sql_validator_agent.py
----------------------
LangChain Tool-calling Agent for SQL Validation.

Replaces the direct validation logic in nlq/agents/sql_validator.py
with a LangChain agent that uses validation tools:
  - sql_syntax_check
  - sql_table_name_check
  - sql_safety_check
"""

import os
import json
import re
import sys
import signal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv, find_dotenv

from prompts.validator_prompt import validator_prompt
from tools.sql_tools import sql_syntax_check, sql_table_name_check, sql_safety_check

load_dotenv(find_dotenv())

# ── LLM ──────────────────────────────────────────────────────────────────────
MODEL_NAME = "gpt-4.1-mini"

llm = ChatOpenAI(
    model=MODEL_NAME,
    temperature=0.0,
    max_tokens=1024,
)

# ── Tools ────────────────────────────────────────────────────────────────────
validator_tools = [sql_syntax_check, sql_table_name_check, sql_safety_check]

# ── Agent ────────────────────────────────────────────────────────────────────
AGENT_TIMEOUT = 90  # seconds

_agent = create_react_agent(
    model=llm, 
    tools=validator_tools, 
    prompt=validator_prompt
)


class _Timeout(Exception):
    pass


def _invoke_with_timeout(agent, payload, timeout=AGENT_TIMEOUT):
    """Invoke a LangGraph agent with a thread-safe timeout."""
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(agent.invoke, payload, {"recursion_limit": 6})
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            raise _Timeout(f"Agent timed out after {timeout}s")


def _validate_and_fill(result: dict) -> dict:
    """Ensure all required fields exist."""
    defaults = {
        "is_valid": False,
        "checks": {},
        "issues": [],
        "fix_suggestion": None,
        "warnings": []
    }
    for key, default in defaults.items():
        if key not in result:
            result[key] = default
    return result


def _check_cost(sql: str) -> tuple[bool, list[str]]:
    """
    Block expensive or unbounded queries (same logic as original).
    This is kept in Python since it's deterministic — no LLM needed.
    """
    warnings = []
    sql_upper = sql.upper().strip()

    if re.search(r"SELECT\s+\*", sql_upper):
        warnings.append("SELECT * is not allowed — specify only needed columns.")
        return False, warnings

    # check for unbounded scans on large fact tables
    large_tables = {"fact_video", "fact_user_channel", "fact_user_summary"}
    referenced = set(re.findall(r"(?:FROM|JOIN)\s+(\w+)", sql, re.IGNORECASE))
    hits_large = referenced & {t.lower() for t in large_tables}

    if hits_large:
        has_guard = any(k in sql_upper for k in ["GROUP BY", "LIMIT", "WHERE", "SUM(", "COUNT(", "AVG(", "MAX(", "MIN("])
        if not has_guard:
            warnings.append(f"Unbounded scan on {hits_large} — add GROUP BY, WHERE, LIMIT, or aggregation.")
            return False, warnings

    return True, warnings


def _parse_output(output) -> dict:
    """Parse agent output to dict."""
    if isinstance(output, list):
        output = " ".join([block.get("text", "") for block in output if isinstance(block, dict) and "text" in block])

    text = str(output).strip()
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()
    
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        parsed = json.loads(text[start:i+1])
                        return _validate_and_fill(parsed)
                    except json.JSONDecodeError:
                        break
    
    return _validate_and_fill({
        "is_valid": False,
        "issues": ["Failed to parse validator output."],
        "fix_suggestion": "Retry SQL generation."
    })


# ── Main function ────────────────────────────────────────────────────────────

def validate_sql(
    sql: str,
    user_question: str,
    schema_result: dict,
    plan_result: dict | None = None,
) -> dict:
    """
    Validate a generated SQL query using LangChain tools.

    Args:
        sql           : SQL string from sql_generator
        user_question : original user question
        schema_result : output from table_agent
        plan_result   : output from planner_agent

    Returns:
        dict with is_valid, checks, issues, fix_suggestion, warnings
    """
    if plan_result is None:
        plan_result = {}

    # guard: empty SQL
    if not sql or not sql.strip():
        return {
            "is_valid": False,
            "checks": {"empty": False},
            "issues": ["SQL is empty — generator produced no output."],
            "fix_suggestion": "Retry SQL generation with clearer context.",
            "warnings": []
        }

    # Python-side cost check (deterministic, no LLM needed)
    cost_ok, cost_warnings = _check_cost(sql)

    try:
        input_str = (
            f"SQL to Validate: {sql}\n"
            f"User Question: {user_question}\n"
            f"Linked Schema: {json.dumps(schema_result, indent=2)}\n"
            f"Query Plan: {json.dumps(plan_result, indent=2)}"
        )
        
        result = _invoke_with_timeout(_agent, {"messages": [HumanMessage(content=input_str)]})
        final_message = result["messages"][-1].content
        parsed = _parse_output(final_message)

        # If parsing failed, search ALL AI messages
        if "is_valid" not in parsed or parsed.get("checks") == {}:
            from langchain_core.messages import AIMessage
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content and isinstance(msg.content, str):
                    candidate = _parse_output(msg.content)
                    if "is_valid" in candidate and candidate.get("checks") != {}:
                        parsed = candidate
                        break

        # merge cost check results
        if not cost_ok:
            parsed["is_valid"] = False
            parsed["issues"] = parsed.get("issues", []) + cost_warnings
            parsed["checks"]["cost"] = False
            if not parsed.get("fix_suggestion"):
                parsed["fix_suggestion"] = "Fix cost/query guard issues."
        else:
            parsed["checks"]["cost"] = True

        return parsed
    except Exception as e:
        print(f"  [SQLValidatorAgent] Error: {e}")
        return _validate_and_fill({
            "is_valid": False,
            "issues": [f"Validator agent error: {str(e)}"],
            "fix_suggestion": "Retry SQL generation."
        })
