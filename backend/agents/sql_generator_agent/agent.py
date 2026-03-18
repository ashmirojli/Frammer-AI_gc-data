"""
sql_generator_agent.py
----------------------
LangChain ReAct Agent for SQL Generation.

Replaces the raw Gemini API call in nlq/agents/sql_generator.py
with a LangChain ReAct agent that uses both ChromaDB tools (few-shots, schema)
and SQL tools (schema introspection, syntax checking).
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

from prompts.sql_generator_prompt import sql_generator_prompt
from tools.chroma_tools import chroma_retrieve_few_shots, chroma_retrieve_schema
from tools.sql_tools import sql_get_schema, sql_syntax_check

load_dotenv(find_dotenv())

# ── LLM (3 strategies with different temperatures) ─────────────────────
MODEL_NAME = "gpt-4.1"

llm_a = ChatOpenAI(model=MODEL_NAME, temperature=0.0, max_tokens=2048)  # direct
llm_b = ChatOpenAI(model=MODEL_NAME, temperature=0.2, max_tokens=2048)  # reasoning
llm_c = ChatOpenAI(model=MODEL_NAME, temperature=0.4, max_tokens=2048)  # creative

# Keep backward-compatible default
llm = llm_a

# ── Tools ────────────────────────────────────────────────────────────────────
sql_gen_tools = [
    chroma_retrieve_few_shots,
    chroma_retrieve_schema,
    sql_get_schema,
    sql_syntax_check,
]

# ── Agents (3 strategies) ──────────────────────────────────────────────
AGENT_TIMEOUT = 90  # seconds

_agent_a = create_react_agent(model=llm_a, tools=sql_gen_tools, prompt=sql_generator_prompt)
_agent_b = create_react_agent(model=llm_b, tools=sql_gen_tools, prompt=sql_generator_prompt)
_agent_c = create_react_agent(model=llm_c, tools=sql_gen_tools, prompt=sql_generator_prompt)

# Keep backward-compatible default
_agent = _agent_a


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

# ── Safety ───────────────────────────────────────────────────────────────────
FORBIDDEN_KEYWORDS = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE"]
MAX_SQL_LENGTH = 2000


def _check_sql_safety(sql: str) -> str | None:
    """Check SQL for forbidden keywords."""
    if not sql:
        return None
    sql_upper = sql.upper()
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{kw}\b", sql_upper):
            return f"Unsafe SQL — forbidden keyword: {kw}"
    return None


def _validate_and_fill(result: dict) -> dict:
    """Ensure all required fields exist."""
    defaults = {
        "sql": "", "sql_explanation": "No explanation provided.",
        "tables_used": [], "columns_returned": [],
        "filters_applied": [], "dimensions_applied": [],
        "has_cte": False, "confidence_score": 0.0,
        "confidence_reason": "Default fallback."
    }
    for key, default in defaults.items():
        if key not in result:
            result[key] = default

    # clamp confidence
    try:
        result["confidence_score"] = round(max(0.0, min(1.0, float(result["confidence_score"]))), 2)
    except (TypeError, ValueError):
        result["confidence_score"] = 0.0

    # safety check
    safety_err = _check_sql_safety(result.get("sql", ""))
    if safety_err:
        result["sql"] = ""
        result["confidence_score"] = 0.0
        result["confidence_reason"] = safety_err

    # length guard
    if result["sql"] and len(result["sql"]) > MAX_SQL_LENGTH:
        result["confidence_score"] = min(result["confidence_score"], 0.5)
        result["confidence_reason"] += f" SQL length ({len(result['sql'])}) exceeds recommended maximum."

    return result


def _format_history(history: list[dict]) -> str:
    if not history:
        return "No previous conversation."
    lines = []
    for turn in history[-6:]:
        role = turn.get("role", "user").capitalize()
        content = turn.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


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
        "sql": "",
        "sql_explanation": "Failed to parse SQL generator output.",
        "confidence_score": 0.0,
        "confidence_reason": "Parse error"
    })


# ── Main function ────────────────────────────────────────────────────────────

def generate_sql(
    user_question: str,
    intent_result: dict,
    schema_result: dict,
    plan_result: dict,
    retrieved_context: dict | None = None,
    conversation_history: list[dict] | None = None,
    fix_suggestion: str | None = None,
) -> dict:
    """
    Generate a SQLite SQL query using a LangChain ReAct agent.

    Args:
        user_question        : raw user input
        intent_result        : output from intent_agent
        schema_result        : output from table_agent
        plan_result          : output from planner_agent
        retrieved_context    : (optional)
        conversation_history : list of {role, content} dicts
        fix_suggestion       : validation feedback for retry

    Returns:
        dict with sql, sql_explanation, tables_used, confidence_score, etc.
    """
    if conversation_history is None:
        conversation_history = []

    # format plan
    plan_lines = []
    for i, step in enumerate(plan_result.get("plan_steps", []), 1):
        plan_lines.append(f"{i}. {step}")
    if plan_result.get("requires_cte"):
        plan_lines.append(f"\nREQUIRES CTE: {plan_result.get('cte_reason', '')}")
    if plan_result.get("is_derived_metric"):
        plan_lines.append(f"\nDERIVED METRIC: {plan_result.get('derived_metric_formula', '')}")
    plan_lines.append(f"\nOUTPUT SHAPE: {plan_result.get('expected_output_shape', 'multi_row_multi_col')}")
    plan_lines.append(f"CHART TYPE: {plan_result.get('suggested_chart_type', 'table')}")

    try:
        input_str = (
            f"User Question: {user_question}\n"
            f"Query Plan:\n{chr(10).join(plan_lines)}\n"
            f"Linked Schema: {json.dumps(schema_result, indent=2)}\n"
            f"Conversation History:\n{_format_history(conversation_history)}\n"
            f"Validation Feedback/Fix Suggestion: {fix_suggestion or 'None'}"
        )
        
        result = _invoke_with_timeout(_agent, {"messages": [HumanMessage(content=input_str)]})
        final_message = result["messages"][-1].content
        parsed = _parse_output(final_message)

        # If parsing failed, search ALL AI messages
        if not parsed.get("sql"):
            from langchain_core.messages import AIMessage
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content and isinstance(msg.content, str):
                    candidate = _parse_output(msg.content)
                    if candidate.get("sql"):
                        parsed = candidate
                        break

        return parsed
    except Exception as e:
        print(f"  [SQLGeneratorAgent] Error: {e}")
        return _validate_and_fill({
            "sql": "",
            "sql_explanation": f"SQL Generator error: {str(e)}",
            "confidence_score": 0.0,
            "confidence_reason": "Agent execution failure"
        })


# ── Strategy wrappers for parallel generation ────────────────────────────

def _generate_with_agent(agent, strategy_name, **kwargs):
    """Internal: run generation with a specific agent/strategy."""
    result = _generate_core(agent=agent, **kwargs)
    result["strategy"] = strategy_name
    return result


def _generate_core(
    agent,
    user_question: str,
    intent_result: dict,
    schema_result: dict,
    plan_result: dict,
    retrieved_context: dict | None = None,
    conversation_history: list[dict] | None = None,
    fix_suggestion: str | None = None,
    strategy_hint: str = "",
) -> dict:
    """Core generation logic shared by all strategies."""
    if conversation_history is None:
        conversation_history = []

    plan_lines = []
    for i, step in enumerate(plan_result.get("plan_steps", []), 1):
        plan_lines.append(f"{i}. {step}")
    if plan_result.get("requires_cte"):
        plan_lines.append(f"\nREQUIRES CTE: {plan_result.get('cte_reason', '')}")
    if plan_result.get("is_derived_metric"):
        plan_lines.append(f"\nDERIVED METRIC: {plan_result.get('derived_metric_formula', '')}")
    plan_lines.append(f"\nOUTPUT SHAPE: {plan_result.get('expected_output_shape', 'multi_row_multi_col')}")
    plan_lines.append(f"CHART TYPE: {plan_result.get('suggested_chart_type', 'table')}")

    try:
        input_str = (
            f"{strategy_hint}"
            f"User Question: {user_question}\n"
            f"Query Plan:\n{chr(10).join(plan_lines)}\n"
            f"Linked Schema: {json.dumps(schema_result, indent=2)}\n"
            f"Conversation History:\n{_format_history(conversation_history)}\n"
            f"Validation Feedback/Fix Suggestion: {fix_suggestion or 'None'}"
        )

        result = _invoke_with_timeout(agent, {"messages": [HumanMessage(content=input_str)]})
        final_message = result["messages"][-1].content
        parsed = _parse_output(final_message)

        if not parsed.get("sql"):
            from langchain_core.messages import AIMessage
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage) and msg.content and isinstance(msg.content, str):
                    candidate = _parse_output(msg.content)
                    if candidate.get("sql"):
                        parsed = candidate
                        break

        return parsed
    except Exception as e:
        print(f"  [SQLGenerator] Error: {e}")
        return _validate_and_fill({
            "sql": "",
            "sql_explanation": f"SQL Generator error: {str(e)}",
            "confidence_score": 0.0,
            "confidence_reason": "Agent execution failure"
        })


def generate_sql_a(**kwargs) -> dict:
    """Strategy A: Direct SQL generation (temperature=0.0)."""
    return _generate_with_agent(
        agent=_agent_a,
        strategy_name="direct",
        strategy_hint="STRATEGY: Generate the SQL query directly. Be concise.\n\n",
        **kwargs,
    )


def generate_sql_b(**kwargs) -> dict:
    """Strategy B: Reasoning-first SQL (temperature=0.2)."""
    return _generate_with_agent(
        agent=_agent_b,
        strategy_name="reasoning",
        strategy_hint="STRATEGY: First reason step-by-step about which tables and joins are needed, then generate the SQL.\n\n",
        **kwargs,
    )


def generate_sql_c(**kwargs) -> dict:
    """Strategy C: Example-driven SQL (temperature=0.4)."""
    return _generate_with_agent(
        agent=_agent_c,
        strategy_name="example_driven",
        strategy_hint="STRATEGY: Use the few-shot examples from the knowledge base as templates. Adapt the closest matching example to answer this question.\n\n",
        **kwargs,
    )
