"""
table_agent.py
--------------
NEW LangChain ReAct Agent for Table Selection.

Dynamically inspects the database using SQL tools to select the best
fact and dimension tables for answering the user's question.

This agent did NOT exist in the original pipeline — it replaces the
hardcoded schema linking done inside intent_schema_agent.py.
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

from prompts.table_prompt import table_prompt
from tools.sql_tools import sql_get_tables, sql_get_schema, sql_sample_rows

load_dotenv(find_dotenv())

# ── LLM ──────────────────────────────────────────────────────────────────────
MODEL_NAME = "gpt-4.1-mini"

llm = ChatOpenAI(
    model=MODEL_NAME,
    temperature=0.1,
    max_tokens=2048,
)

# ── Tools ────────────────────────────────────────────────────────────────────
table_tools = [sql_get_tables, sql_get_schema, sql_sample_rows]

# ── Agent ────────────────────────────────────────────────────────────────────
AGENT_TIMEOUT = 90  # seconds

_agent = create_react_agent(
    model=llm, 
    tools=table_tools, 
    prompt=table_prompt
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

# ── Allowed tables (for validation) ──────────────────────────────────────────
ALLOWED_TABLES = {
    "fact_user_summary", "fact_user_channel", "fact_monthly",
    "fact_channel_publishing", "fact_input_type", "fact_language",
    "fact_output_type", "fact_video",
    "dim_channel", "dim_user", "dim_input_type", "dim_output_type",
    "dim_language", "dim_platform", "dim_team", "dim_month",
}


def _validate_and_fill(result: dict) -> dict:
    """Ensure all required schema fields exist with safe defaults."""
    defaults = {
        "primary_table": None, "dimension_tables": [], "joins": [],
        "select_columns": [], "metric_columns": [], "group_by_columns": [],
        "filter_conditions": [], "order_by": None, "limit": None,
        "duration_conversion": False, "aggregation_required": True,
        "aggregation_type": "SUM", "schema_warnings": []
    }
    for key, default in defaults.items():
        if key not in result:
            result[key] = default

    # validate tables
    warnings = result.get("schema_warnings", [])
    if result.get("primary_table") and result["primary_table"] not in ALLOWED_TABLES:
        warnings.append(f"Invalid primary_table '{result['primary_table']}' — cleared.")
        result["primary_table"] = None
    if result.get("dimension_tables"):
        invalid = [t for t in result["dimension_tables"] if t not in ALLOWED_TABLES]
        if invalid:
            warnings.append(f"Invalid dimension tables removed: {invalid}")
            result["dimension_tables"] = [t for t in result["dimension_tables"] if t in ALLOWED_TABLES]
    result["schema_warnings"] = warnings
    result["warnings"] = warnings
    return result


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
        "schema_warnings": ["Failed to parse table agent output."]
    })


def _extract_json_from_messages(messages) -> dict | None:
    """Search all AI messages for a valid JSON with 'primary_table' key."""
    from langchain_core.messages import AIMessage
    for msg in reversed(messages):
        if not isinstance(msg, AIMessage) or not msg.content or not isinstance(msg.content, str):
            continue
        parsed = _parse_output(msg.content)
        if parsed.get("primary_table") is not None:
            return parsed
    return None


def select_tables(
    user_question: str,
    intent_result: dict,
) -> dict:
    """Use LangChain ReAct agent to dynamically select tables. Includes retry."""
    input_str = (
        f"User Question: {user_question}\n"
        f"Intent Result: {json.dumps(intent_result, indent=2)}"
    )

    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            result = _invoke_with_timeout(_agent, {"messages": [HumanMessage(content=input_str)]})
            final_message = result["messages"][-1].content
            parsed = _parse_output(final_message)

            # If parsing failed, search ALL AI messages
            if parsed.get("primary_table") is None:
                found = _extract_json_from_messages(result["messages"])
                if found:
                    parsed = found

            if parsed.get("primary_table") is not None or attempt >= max_attempts - 1:
                return parsed

            print(f"  [TableAgent] Parse failed, retrying ({attempt+1}/{max_attempts})...")
        except Exception as e:
            if attempt < max_attempts - 1:
                print(f"  [TableAgent] Error: {e}, retrying ({attempt+1}/{max_attempts})...")
                continue
            print(f"  [TableAgent] Error: {e}")
            return _validate_and_fill({
                "schema_warnings": [f"Table Agent error: {str(e)}"]
            })

