"""
intent_agent.py
---------------
LangChain ReAct Agent for Intent Classification.

Replaces the raw Gemini API call in nlq/agents/intent_schema_agent.py
with a LangChain ReAct agent that uses ChromaDB tools to validate
its classification.

Input : user_question, conversation_history, retrieved_context
Output: (intent_result, schema_result) — same interface as original
"""

import os
import json
import re
import sys
import time
import signal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv, find_dotenv

from prompts.intent_prompt import intent_prompt
from tools.chroma_tools import chroma_retrieve_metrics, chroma_retrieve_dimensions

load_dotenv(find_dotenv())

# ── LLM ──────────────────────────────────────────────────────────────────────
MODEL_NAME = "gpt-4.1-mini"

llm = ChatOpenAI(
    model=MODEL_NAME,
    temperature=0.1,
    max_tokens=2048,
)

# ── Tools ────────────────────────────────────────────────────────────────────
intent_tools = [chroma_retrieve_metrics, chroma_retrieve_dimensions]

# ── Agent ────────────────────────────────────────────────────────────────────
AGENT_TIMEOUT = 90  # seconds

_agent = create_react_agent(
    model=llm, 
    tools=intent_tools, 
    prompt=intent_prompt
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


# ── Intent/Schema field sets (for splitting) ─────────────────────────────────
INTENT_FIELDS = {
    "intent", "intent_confidence", "is_safe", "is_answerable",
    "requires_clarification", "clarification_question",
    "entities", "rephrased_question", "rejection_reason"
}

SCHEMA_FIELDS = {
    "primary_table", "dimension_tables", "joins", "select_columns",
    "metric_columns", "group_by_columns", "filter_conditions",
    "order_by", "limit", "duration_conversion",
    "aggregation_required", "aggregation_type", "schema_warnings"
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _format_history(history: list[dict]) -> str:
    if not history:
        return "No previous conversation."
    lines = []
    for turn in history[-6:]:
        role = turn.get("role", "user").capitalize()
        content = turn.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _format_context(retrieved_context: dict) -> str:
    if not retrieved_context:
        return "No retrieved context available."
    lines = []
    if retrieved_context.get("metrics"):
        lines.append("RELEVANT METRICS:")
        for i, m in enumerate(retrieved_context["metrics"], 1):
            lines.append(f"  {i}. {m['text'][:500]}")
    if retrieved_context.get("dimensions"):
        lines.append("RELEVANT DIMENSIONS:")
        for i, d in enumerate(retrieved_context["dimensions"], 1):
            lines.append(f"  {i}. {d['text'][:500]}")
    if retrieved_context.get("schema"):
        lines.append("RELEVANT SCHEMA DOCS:")
        for i, s in enumerate(retrieved_context["schema"], 1):
            lines.append(f"  {i}. {s['text'][:500]}")
    if retrieved_context.get("jargon"):
        lines.append("BUSINESS GLOSSARY:")
        for i, j in enumerate(retrieved_context["jargon"], 1):
            term = j["metadata"].get("term", "")
            defn = j["metadata"].get("definition", j["text"])
            lines.append(f"  {i}. {term}: {defn}")
    result = "\n".join(lines) if lines else "No retrieved context available."
    return result[:3000]


def _validate_and_fill(result: dict) -> dict:
    """Ensure all required fields exist with safe defaults."""
    defaults = {
        "intent": "out_of_scope", "intent_confidence": 0.0,
        "is_safe": False, "is_answerable": False,
        "requires_clarification": False, "clarification_question": None,
        "entities": {"metric": None, "dimensions": [], "filters": [],
                     "time_period": None, "limit": None, "comparison": False},
        "rephrased_question": "", "rejection_reason": None,
        "primary_table": None, "dimension_tables": [], "joins": [],
        "select_columns": [], "metric_columns": [], "group_by_columns": [],
        "filter_conditions": [], "order_by": None, "limit": None,
        "duration_conversion": False, "aggregation_required": True,
        "aggregation_type": "SUM", "schema_warnings": []
    }
    for key, default in defaults.items():
        if key not in result:
            result[key] = default
    return result


def _parse_output(output) -> dict:
    """Parse agent output string or list to JSON dict."""
    if isinstance(output, list):
        # Gemini may return multiple text blocks; concatenate only text parts
        output = " ".join([block.get("text", "") for block in output if isinstance(block, dict) and "text" in block])
    
    text = str(output).strip()
    # Strip markdown code fences
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()
    
    # Extract the first JSON object { ... } using brace matching
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    json_str = text[start:i+1]
                    try:
                        parsed = json.loads(json_str)
                        return _validate_and_fill(parsed)
                    except json.JSONDecodeError:
                        break
    
    return _validate_and_fill({
        "is_safe": False, "is_answerable": False,
        "rejection_reason": f"Failed to parse agent output."
    })


def _split_result(result: dict) -> tuple[dict, dict]:
    """Split merged output into intent_result and schema_result."""
    intent_result = {k: result[k] for k in INTENT_FIELDS if k in result}
    schema_result = {
        k: result[k] for k in SCHEMA_FIELDS
        if k in result and k != "schema_warnings"
    }
    schema_result["warnings"] = result.get("schema_warnings", [])
    return intent_result, schema_result


# ── Main function ────────────────────────────────────────────────────────────

def _extract_json_from_messages(messages) -> dict | None:
    """Search all AI messages (last-first) for a valid JSON object with 'intent' key."""
    from langchain_core.messages import AIMessage
    for msg in reversed(messages):
        if not isinstance(msg, AIMessage):
            continue
        content = msg.content
        if not content or not isinstance(content, str):
            continue
        parsed = _parse_output(content)
        # Check if we got a real result (not a default failure)
        if parsed.get("intent") != "out_of_scope" or parsed.get("is_safe"):
            return parsed
    return None


def classify_and_link(
    user_question: str,
    conversation_history: list[dict] | None = None,
    retrieved_context: dict | None = None
) -> tuple[dict, dict]:
    """
    Classify intent AND link schema using a LangChain ReAct agent.
    Includes retry logic and searches all messages for JSON output.
    """
    if conversation_history is None:
        conversation_history = []
    if retrieved_context is None:
        retrieved_context = {}

    input_str = (
        f"User Question: {user_question}\n"
        f"Conversation History:\n{_format_history(conversation_history)}\n"
        f"Retrieved Context:\n{_format_context(retrieved_context)}"
    )

    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            result = _invoke_with_timeout(
                _agent, {"messages": [HumanMessage(content=input_str)]}
            )
            # Try the last message first (fast path)
            final_message = result["messages"][-1].content
            parsed = _parse_output(final_message)

            # If parsing failed, search ALL AI messages for JSON
            if parsed.get("rejection_reason") == "Failed to parse agent output.":
                found = _extract_json_from_messages(result["messages"])
                if found:
                    parsed = found

            # If still failed and we have retries left, try again
            if (parsed.get("rejection_reason") == "Failed to parse agent output."
                    and attempt < max_attempts - 1):
                print(f"  [IntentAgent] Parse failed, retrying ({attempt+1}/{max_attempts})...")
                continue

            return _split_result(parsed)
        except Exception as e:
            if attempt < max_attempts - 1:
                print(f"  [IntentAgent] Error: {e}, retrying ({attempt+1}/{max_attempts})...")
                continue
            print(f"  [IntentAgent] Error: {e}")
            error_result = _validate_and_fill({
                "is_safe": False, "is_answerable": False,
                "rejection_reason": f"Agent error: {str(e)}"
            })
            return _split_result(error_result)


def is_safe_to_proceed(intent_result: dict) -> tuple[bool, str | None]:
    """Helper used by orchestrator to check if pipeline should continue."""
    if not intent_result.get("is_safe"):
        return False, intent_result.get("rejection_reason", "Unsafe query.")
    if not intent_result.get("is_answerable"):
        return False, intent_result.get("rejection_reason", "Question cannot be answered.")
    if intent_result.get("requires_clarification"):
        return False, intent_result.get("clarification_question", "Please clarify your question.")
    return True, None
