"""
orchestrator.py
---------------
Parallel Multi-Agent LangGraph orchestrator — extended with KPI RAG path.

Architecture:
  Intent Agent
       ↓
  ┌────────────────────────────────────────┐
  │  route_after_intent                    │
  │  kpi_info  → kpi_rag → END            │  ← NEW
  │  hybrid    → kpi_rag → existing SQL    │  ← NEW
  │  sql       → table_agent → ...        │  (existing)
  │  unsafe    → end_short_circuit → END  │  (existing)
  └────────────────────────────────────────┘
       ↓ (sql path, unchanged)
  Table Agent → Planner → SQL Gen A/B/C (parallel)
       ↓
  Unit Tester → Self Critic / SQL Validator / Cost Estimator (parallel)
       ↓
  Decision Aggregator → Executor
       ↓
  Formatter + Insight Generator (parallel) → Final Output → END
"""

import os
import sys
import time
import hashlib
import re
import json
import operator
from typing import TypedDict, Annotated
from langchain_community.callbacks.manager import get_openai_callback
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv, find_dotenv

# ── Ensure backend/ is on sys.path ───────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ── Agents ───────────────────────────────────────────────────────────────────
from agents.intent_agent.agent           import classify_and_link, is_safe_to_proceed
from agents.table_agent.agent            import select_tables
from agents.planner_agent.agent          import plan_query
from agents.sql_generator_agent.agent    import generate_sql, generate_sql_a, generate_sql_b, generate_sql_c
from agents.self_critic_agent.agent      import critique_sql
from agents.sql_validator_agent.agent    import validate_sql
from agents.unit_tester_agent.agent      import evaluate_candidates
from agents.cost_estimator_agent.agent   import estimate_cost
from agents.insight_generator_agent.agent import generate_insights
from agents.formatter_agent.agent        import format_result
from agents.executor_agent.agent         import execute_sql

# ── RAG Retriever ────────────────────────────────────────────────────────────
from RAG.retriever import retrieve_all_context, retrieve_kpi_knowledge, format_kpi_context_for_prompt

# ── Memory ───────────────────────────────────────────────────────────────────
from memory.memory_layer import get_checkpointer, save_successful_query

# ── LangGraph ────────────────────────────────────────────────────────────────
from langgraph.graph import StateGraph, END

load_dotenv(find_dotenv())

MAX_SQL_RETRIES  = 2
MAX_EXEC_RETRIES = 2

# ── LLM for KPI RAG answer generation ────────────────────────────────────────
_rag_llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0.2, max_tokens=1024)


# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE STATE
# ══════════════════════════════════════════════════════════════════════════════

def _merge_candidates(left: list, right: list) -> list:
    return left + right

def _merge_dicts(left: dict, right: dict) -> dict:
    return {**left, **right}

class PipelineState(TypedDict):
    # input
    user_question:        str
    conversation_history: list[dict]

    # agent outputs
    intent_result:        Annotated[dict, _merge_dicts]
    schema_result:        Annotated[dict, _merge_dicts]
    plan_result:          Annotated[dict, _merge_dicts]
    sql_result:           Annotated[dict, _merge_dicts]
    critic_result:        Annotated[dict, _merge_dicts]
    validation_result:    Annotated[dict, _merge_dicts]
    execution_result:     Annotated[dict, _merge_dicts]
    format_result:        Annotated[dict, _merge_dicts]

    # parallel SQL generation
    sql_candidates: Annotated[list, _merge_candidates]

    # parallel verification
    verification_results: Annotated[dict, _merge_dicts]

    # unit tester / cost / insight
    ut_result:            Annotated[dict, _merge_dicts]
    cost_result:          Annotated[dict, _merge_dicts]
    insight_result:       Annotated[dict, _merge_dicts]

    # retry tracking
    sql_retry_count:      int
    exec_retry_count:     int
    fix_suggestion:       str | None

    # rag context
    retrieved_context:    Annotated[dict, _merge_dicts]

    # NEW: KPI RAG result
    kpi_rag_result:       Annotated[dict, _merge_dicts]

    # pipeline metadata
    pipeline_error:       str | None
    short_circuit:        bool
    node_latencies:       Annotated[dict, _merge_dicts]
    usage_stats:          Annotated[dict, _merge_dicts]


# ══════════════════════════════════════════════════════════════════════════════
#  PIPELINE NODES (existing, unchanged)
# ══════════════════════════════════════════════════════════════════════════════

def node_retriever(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 0: Retriever (ChromaDB)")
    t = time.time()
    try:
        context = retrieve_all_context(state["user_question"])
        print(f"  Retrieved: {len(context.get('metrics',[]))} metrics | "
              f"{len(context.get('dimensions',[]))} dims | "
              f"{len(context.get('few_shots',[]))} few-shots | "
              f"{len(context.get('schema',[]))} schema docs | "
              f"{len(context.get('jargon',[]))} jargon terms")
    except Exception as e:
        print(f"  ⚠ Retriever failed: {e}")
        context = {"metrics": [], "dimensions": [], "few_shots": [], "schema": [], "jargon": []}
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "retrieved_context": context,
        "node_latencies": {**state.get("node_latencies", {}), "retriever": latency_ms}
    }


def node_intent(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 1: Intent Agent (ReAct)")
    t = time.time()
    intent_result, _ = classify_and_link(
        user_question=state["user_question"],
        conversation_history=state["conversation_history"],
        retrieved_context=state.get("retrieved_context", {})
    )
    proceed, reason = is_safe_to_proceed(intent_result)
    short_circuit = not proceed
    pipeline_error = reason if short_circuit else state.get("pipeline_error")
    if short_circuit:
        print(f"  → Short-circuit: {pipeline_error}")
    print(f"  Intent: {intent_result.get('intent')} | "
          f"Safe: {intent_result.get('is_safe')} | "
          f"Answerable: {intent_result.get('is_answerable')}")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "intent_result": intent_result,
        "short_circuit": short_circuit,
        "pipeline_error": pipeline_error,
        "node_latencies": {**state.get("node_latencies", {}), "intent": latency_ms}
    }


# ── NEW: KPI RAG Node ─────────────────────────────────────────────────────────

def node_kpi_rag(state: PipelineState) -> PipelineState:
    """
    KPI RAG Node — handles kpi_info and hybrid intents.

    Steps:
      1. Retrieve relevant KPI docs from kpi_knowledge ChromaDB collection
      2. Format retrieved context into a structured prompt
      3. Call LLM to generate a natural language answer grounded in KPI docs
      4. Store result in kpi_rag_result

    For hybrid intents, this node runs FIRST and the answer is later combined
    with SQL data in _build_final_result.
    """
    print(f"\n[Orchestrator] ── Node KPI RAG: KPI Knowledge Retrieval + Answer")
    t = time.time()

    query = state["user_question"]
    intent = state.get("intent_result", {}).get("intent", "kpi_info")

    # Step 1: Retrieve from kpi_knowledge collection
    try:
        kpi_results = retrieve_kpi_knowledge(query, top_k=5)
        print(f"  Retrieved {len(kpi_results)} KPI knowledge docs")
    except Exception as e:
        print(f"  ⚠ KPI retrieval failed: {e}")
        kpi_results = []

    if not kpi_results:
        kpi_rag_result = {
            "answer": "I couldn't find specific KPI definitions for that query. Please try rephrasing or ask about a specific KPI name.",
            "sources": [],
            "retrieved_count": 0,
        }
        latency_ms = round((time.time() - t) * 1000, 2)
        return {
            **state,
            "kpi_rag_result": kpi_rag_result,
            "node_latencies": {**state.get("node_latencies", {}), "kpi_rag": latency_ms}
        }

    # Step 2: Format retrieved context
    kpi_context_str = format_kpi_context_for_prompt(kpi_results)

    # Step 3: Generate LLM answer grounded in retrieved KPI docs
    system_prompt = """\
You are a KPI Expert for Frammer AI's analytics platform.
Given the user's question and the relevant KPI definitions retrieved from the knowledge base,
provide a clear, accurate, and concise answer.

Rules:
- Answer ONLY from the provided KPI context — do not hallucinate formulas or definitions.
- For KPI definitions: state the name, description, and exact formula clearly.
- For "which tab" questions: state the tab name.
- For formula questions: show the formula clearly with an explanation.
- Keep the answer concise but complete (3-6 sentences max per KPI).
- If multiple KPIs are retrieved, focus on the most relevant one first.
- Do NOT generate SQL — just explain the KPI.
"""

    user_message = (
        f"User Question: {query}\n\n"
        f"Retrieved KPI Knowledge:\n{kpi_context_str}"
    )

    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ]
        response = _rag_llm.invoke(messages)
        answer = response.content.strip()
    except Exception as e:
        print(f"  ⚠ RAG LLM call failed: {e}")
        answer = f"KPI context retrieved but answer generation failed: {e}"

    # Step 4: Build source list for transparency
    sources = []
    for r in kpi_results:
        m = r["metadata"]
        if m.get("doc_type") == "kpi":
            sources.append({
                "kpi_id":   m.get("kpi_id", ""),
                "name":     m.get("name", ""),
                "tab":      m.get("tab", ""),
                "score":    r.get("score", 0),
            })
        elif m.get("doc_type") == "tab":
            sources.append({
                "tab_id":   m.get("tab_id", ""),
                "tab_name": m.get("tab_name", ""),
                "score":    r.get("score", 0),
            })

    kpi_rag_result = {
        "answer":          answer,
        "sources":         sources,
        "retrieved_count": len(kpi_results),
        "intent":          intent,
    }

    print(f"  ✓ KPI RAG answer generated | Sources: {[s.get('name', s.get('tab_name','')) for s in sources]}")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "kpi_rag_result": kpi_rag_result,
        "node_latencies": {**state.get("node_latencies", {}), "kpi_rag": latency_ms}
    }


def node_table(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 2: Table Agent (ReAct)")
    t = time.time()
    schema_result = select_tables(
        user_question=state["user_question"],
        intent_result=state["intent_result"],
    )
    print(f"  Primary table: {schema_result.get('primary_table')} | "
          f"Dims: {schema_result.get('dimension_tables')}")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "schema_result": schema_result,
        "node_latencies": {**state.get("node_latencies", {}), "table": latency_ms}
    }


def node_planner(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 3: Planner Agent (CoT)")
    t = time.time()
    result = plan_query(
        user_question=state["user_question"],
        intent_result=state["intent_result"],
        schema_result=state["schema_result"],
        conversation_history=state["conversation_history"]
    )
    print(f"  Chart: {result.get('suggested_chart_type')} | Steps: {len(result.get('plan_steps', []))}")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "plan_result": result,
        "node_latencies": {**state.get("node_latencies", {}), "planner": latency_ms}
    }


def _gen_kwargs(state: PipelineState) -> dict:
    return dict(
        user_question=state["user_question"],
        intent_result=state["intent_result"],
        schema_result=state["schema_result"],
        plan_result=state["plan_result"],
        conversation_history=state["conversation_history"],
        fix_suggestion=state.get("fix_suggestion"),
        retrieved_context=state.get("retrieved_context", {}),
    )


def node_sql_gen_a(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 4a: SQL Gen A (direct)")
    t = time.time()
    result = generate_sql_a(**_gen_kwargs(state))
    print(f"  Confidence: {result.get('confidence_score')} | Tables: {result.get('tables_used')}")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "sql_candidates": [result],
        "node_latencies": {**state.get("node_latencies", {}), "sql_gen_a": latency_ms},
    }


def node_sql_gen_b(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 4b: SQL Gen B (reasoning)")
    t = time.time()
    result = generate_sql_b(**_gen_kwargs(state))
    print(f"  Confidence: {result.get('confidence_score')} | Tables: {result.get('tables_used')}")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "sql_candidates": [result],
        "node_latencies": {**state.get("node_latencies", {}), "sql_gen_b": latency_ms},
    }


def node_sql_gen_c(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 4c: SQL Gen C (example-driven)")
    t = time.time()
    result = generate_sql_c(**_gen_kwargs(state))
    print(f"  Confidence: {result.get('confidence_score')} | Tables: {result.get('tables_used')}")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "sql_candidates": [result],
        "node_latencies": {**state.get("node_latencies", {}), "sql_gen_c": latency_ms},
    }


def node_unit_tester(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 5: Unit Tester Agent")
    t = time.time()
    candidates = state.get("sql_candidates", [])
    print(f"  Evaluating {len(candidates)} candidates...")
    ut_result = evaluate_candidates(
        sql_candidates=candidates,
        user_question=state["user_question"],
        schema_result=state["schema_result"],
    )
    best = ut_result["best_sql"]
    print(f"  Winner: Strategy '{best.get('strategy')}' "
          f"(score: {ut_result['scores'][0]['score'] if ut_result['scores'] else 'N/A'})")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "sql_result": best,
        "ut_result": ut_result,
        "node_latencies": {**state.get("node_latencies", {}), "unit_tester": latency_ms}
    }


def node_self_critic(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 6a: Self-Critic Agent")
    t = time.time()
    sql = state["sql_result"].get("sql", "")
    if not sql or not sql.strip():
        return {
            "verification_results": {"critic": {"is_correct": False, "issues": ["No SQL generated."]}},
            "node_latencies": {**state.get("node_latencies", {}), "self_critic": round((time.time() - t) * 1000, 2)},
        }
    result = critique_sql(
        sql=sql,
        user_question=state["user_question"],
        intent_result=state["intent_result"],
        schema_result=state["schema_result"],
        plan_result=state["plan_result"],
    )
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "verification_results": {"critic": result},
        "critic_result": result,
        "node_latencies": {**state.get("node_latencies", {}), "self_critic": latency_ms},
    }


def node_sql_validator(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 6b: SQL Validator Agent")
    t = time.time()
    result = validate_sql(
        sql=state["sql_result"].get("sql", ""),
        user_question=state["user_question"],
        schema_result=state["schema_result"],
        plan_result=state["plan_result"]
    )
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "verification_results": {"validator": result},
        "validation_result": result,
        "node_latencies": {**state.get("node_latencies", {}), "validator": latency_ms},
    }


def node_cost_estimator(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 6c: Cost Estimator Agent")
    t = time.time()
    result = estimate_cost(state["sql_result"].get("sql", ""))
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "verification_results": {"cost": result},
        "cost_result": result,
        "node_latencies": {**state.get("node_latencies", {}), "cost_estimator": latency_ms},
    }


def node_decision_aggregator(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 7: Decision Aggregator")
    t = time.time()
    vr = state.get("verification_results", {})
    validator = vr.get("validator", {})
    critic = vr.get("critic", {})
    cost = vr.get("cost", {})
    retry_count = state.get("sql_retry_count", 0)
    fix_suggestion = state.get("fix_suggestion")
    if not validator.get("is_valid") and retry_count < MAX_SQL_RETRIES:
        retry_count += 1
        fix_suggestion = validator.get("fix_suggestion", "Retry SQL generation.")
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "validation_result": validator,
        "critic_result": critic,
        "cost_result": cost,
        "sql_retry_count": retry_count,
        "fix_suggestion": fix_suggestion,
        "node_latencies": {**state.get("node_latencies", {}), "decision_aggregator": latency_ms}
    }


def node_executor(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 8: Executor")
    t = time.time()
    sql = state["sql_result"].get("sql", "")
    if not sql or not sql.strip() or state["sql_result"].get("confidence_score", 1.0) <= 0.05:
        latency_ms = round((time.time() - t) * 1000, 2)
        return {
            **state,
            "sql_result": {**state.get("sql_result", {}), "sql": ""},
            "execution_result": {"success": False, "error": "Query cannot be answered with current schema.", "columns": [], "rows": [], "row_count": 0},
            "pipeline_error": "Query cannot be answered with current schema.",
            "node_latencies": {**state.get("node_latencies", {}), "executor": latency_ms}
        }
    DANGEROUS = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE"]
    blocked_kw = next((kw for kw in DANGEROUS if re.search(rf"\b{kw}\b", sql.upper())), None)
    if blocked_kw:
        latency_ms = round((time.time() - t) * 1000, 2)
        return {
            **state,
            "execution_result": {"success": False, "error": "Dangerous SQL blocked.", "columns": [], "rows": [], "row_count": 0},
            "pipeline_error": "Dangerous SQL blocked.",
            "node_latencies": {**state.get("node_latencies", {}), "executor": latency_ms}
        }
    result = execute_sql(sql=sql)
    exec_retries = state.get("exec_retry_count", 0)
    new_fix = state.get("fix_suggestion")
    if not result.get("success"):
        error_msg = result.get("error", "")
        if any(kw in error_msg.lower() for kw in ["no such column", "no such table", "ambiguous column"]):
            new_fix = f"EXECUTION ERROR: {error_msg}. Check the VALID JOINS section."
            exec_retries += 1
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        **state,
        "execution_result": result,
        "fix_suggestion": new_fix,
        "exec_retry_count": exec_retries,
        "pipeline_error": result.get("error") if not result.get("success") else state.get("pipeline_error"),
        "node_latencies": {**state.get("node_latencies", {}), "executor": latency_ms}
    }


def node_formatter(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 9a: Formatter Agent")
    t = time.time()
    result = format_result(
        user_question=state["user_question"],
        sql_result=state["sql_result"],
        validation_result=state.get("validation_result", {}),
        execution_result=state.get("execution_result", {}),
        intent_result=state["intent_result"],
        plan_result=state["plan_result"]
    )
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "format_result": result,
        "node_latencies": {"formatter": latency_ms},
    }


def node_insight_generator(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 9b: Insight Generator Agent")
    t = time.time()
    result = generate_insights(
        user_question=state["user_question"],
        sql=state["sql_result"].get("sql", ""),
        execution_result=state.get("execution_result", {}),
    )
    latency_ms = round((time.time() - t) * 1000, 2)
    return {
        "insight_result": result,
        "node_latencies": {"insight_generator": latency_ms},
    }


def node_final_output(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Node 10: Final Output")
    return state


def node_result_dispatch(state: PipelineState) -> PipelineState:
    print(f"\n[Orchestrator] ── Result Dispatch → Formatter + Insight Generator")
    return state


# ══════════════════════════════════════════════════════════════════════════════
#  ROUTING LOGIC
# ══════════════════════════════════════════════════════════════════════════════

# KPI-based intents that should go through the RAG path
_KPI_INTENTS = {"kpi_info", "hybrid"}

def route_after_intent(state: PipelineState) -> str:
    """
    Three-way routing:
      - unsafe / unanswerable → end_short_circuit
      - kpi_info / hybrid     → kpi_rag           (NEW)
      - everything else       → table_agent        (existing SQL path)
    """
    if state.get("short_circuit"):
        return "end_short_circuit"
    intent = state.get("intent_result", {}).get("intent", "")
    if intent in _KPI_INTENTS:
        return "kpi_rag"
    return "table_agent"


def route_after_kpi_rag(state: PipelineState) -> str:
    """
    After RAG node:
      - kpi_info  → END  (pure explanation, no SQL needed)
      - hybrid    → table_agent  (need SQL data too)
    """
    intent = state.get("intent_result", {}).get("intent", "kpi_info")
    if intent == "hybrid":
        return "table_agent"
    return "end_kpi_rag"


def route_after_decision(state: PipelineState) -> str:
    sql = state.get("sql_result", {}).get("sql", "")
    if not sql or not sql.strip():
        return "executor"
    validation = state.get("validation_result", {})
    retries = state.get("sql_retry_count", 0)
    if not validation.get("is_valid") and retries < MAX_SQL_RETRIES:
        return "sql_gen_a"
    return "executor"


def route_after_executor(state: PipelineState) -> str:
    sql = state.get("sql_result", {}).get("sql", "")
    if not sql or not sql.strip():
        return "result_dispatch"
    exec_result = state.get("execution_result", {})
    exec_retries = state.get("exec_retry_count", 0)
    if not exec_result.get("success") and exec_retries <= MAX_EXEC_RETRIES:
        error = exec_result.get("error", "")
        if any(kw in error.lower() for kw in ["no such column", "no such table", "ambiguous column"]):
            return "sql_gen_a"
    return "result_dispatch"


# ══════════════════════════════════════════════════════════════════════════════
#  BUILD THE GRAPH
# ══════════════════════════════════════════════════════════════════════════════

def build_pipeline() -> StateGraph:
    graph = StateGraph(PipelineState)

    # ── Register all nodes ────────────────────────────────────────────────
    graph.add_node("retriever",           node_retriever)
    graph.add_node("intent",              node_intent)
    graph.add_node("kpi_rag",             node_kpi_rag)            # NEW
    graph.add_node("table_agent",         node_table)
    graph.add_node("query_planner",       node_planner)
    graph.add_node("sql_gen_a",           node_sql_gen_a)
    graph.add_node("sql_gen_b",           node_sql_gen_b)
    graph.add_node("sql_gen_c",           node_sql_gen_c)
    graph.add_node("unit_tester",         node_unit_tester)
    graph.add_node("self_critic",         node_self_critic)
    graph.add_node("sql_validator",       node_sql_validator)
    graph.add_node("cost_estimator",      node_cost_estimator)
    graph.add_node("decision_aggregator", node_decision_aggregator)
    graph.add_node("executor",            node_executor)
    graph.add_node("result_formatter",    node_formatter)
    graph.add_node("insight_generator",   node_insight_generator)
    graph.add_node("result_dispatch",     node_result_dispatch)
    graph.add_node("final_output",        node_final_output)

    # ── Entry point ───────────────────────────────────────────────────────
    graph.set_entry_point("retriever")

    # ── retriever → intent ────────────────────────────────────────────────
    graph.add_edge("retriever", "intent")

    # ── intent → 3-way conditional routing ───────────────────────────────
    graph.add_conditional_edges(
        "intent",
        route_after_intent,
        {
            "end_short_circuit": END,
            "kpi_rag":           "kpi_rag",      # NEW
            "table_agent":       "table_agent",
        }
    )

    # ── NEW: kpi_rag → END (kpi_info) or table_agent (hybrid) ────────────
    graph.add_conditional_edges(
        "kpi_rag",
        route_after_kpi_rag,
        {
            "end_kpi_rag": END,          # pure kpi_info — stop here
            "table_agent": "table_agent" # hybrid — continue to SQL
        }
    )

    # ── Sequential: table → planner ───────────────────────────────────────
    graph.add_edge("table_agent", "query_planner")

    # ── Fan-out: planner → 3 parallel SQL generators ─────────────────────
    graph.add_edge("query_planner", "sql_gen_a")
    graph.add_edge("query_planner", "sql_gen_b")
    graph.add_edge("query_planner", "sql_gen_c")

    # ── Fan-in: 3 generators → unit_tester ───────────────────────────────
    graph.add_edge("sql_gen_a", "unit_tester")
    graph.add_edge("sql_gen_b", "unit_tester")
    graph.add_edge("sql_gen_c", "unit_tester")

    # ── Fan-out: unit_tester → 3 parallel verification agents ────────────
    graph.add_edge("unit_tester",  "self_critic")
    graph.add_edge("unit_tester",  "sql_validator")
    graph.add_edge("unit_tester",  "cost_estimator")

    # ── Fan-in: verification → decision_aggregator ───────────────────────
    graph.add_edge("self_critic",    "decision_aggregator")
    graph.add_edge("sql_validator",  "decision_aggregator")
    graph.add_edge("cost_estimator", "decision_aggregator")

    # ── Conditional: decision → executor or retry ────────────────────────
    graph.add_conditional_edges(
        "decision_aggregator",
        route_after_decision,
        {"sql_gen_a": "sql_gen_a", "executor": "executor"}
    )

    # ── Conditional: executor → retry or result processing ───────────────
    graph.add_conditional_edges(
        "executor",
        route_after_executor,
        {"sql_gen_a": "sql_gen_a", "result_dispatch": "result_dispatch"}
    )

    # ── Fan-out: result_dispatch → parallel result processing ────────────
    graph.add_edge("result_dispatch", "result_formatter")
    graph.add_edge("result_dispatch", "insight_generator")

    # ── Fan-in: result processing → final_output ─────────────────────────
    graph.add_edge("result_formatter",  "final_output")
    graph.add_edge("insight_generator", "final_output")

    graph.add_edge("final_output", END)

    return graph


# ── Pipeline result cache ────────────────────────────────────────────────────

_cache: dict = {}
CACHE_TTL = 300
CACHE_MAX  = 20

def _cache_key(question: str) -> str:
    return hashlib.md5(question.strip().lower().encode()).hexdigest()

def _cache_get(question: str) -> dict | None:
    key = _cache_key(question)
    if key in _cache:
        result, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return result
        del _cache[key]
    return None

def _cache_set(question: str, result: dict) -> None:
    if len(_cache) >= CACHE_MAX:
        oldest = min(_cache, key=lambda k: _cache[k][1])
        del _cache[oldest]
    _cache[_cache_key(question)] = (result, time.time())


# ── Compile pipeline ─────────────────────────────────────────────────────────

try:
    _checkpointer = get_checkpointer()
    _pipeline = build_pipeline().compile(checkpointer=_checkpointer)
    print("[Orchestrator] Pipeline compiled with KPI RAG + parallel multi-agent architecture.")
except Exception as e:
    print(f"[Orchestrator] Memory init failed ({e}) — compiling without checkpointer.")
    _pipeline = build_pipeline().compile()


# ══════════════════════════════════════════════════════════════════════════════
#  FINAL RESULT BUILDER
# ══════════════════════════════════════════════════════════════════════════════

def _build_final_result(state: dict, usage: dict, elapsed: float,
                        conversation_history: list, user_question: str,
                        user_id: str) -> dict:
    intent = state.get("intent_result", {}).get("intent", "")

    # ── Short-circuit (unsafe / unanswerable) ─────────────────────────────
    if state.get("short_circuit"):
        return {
            "answer":     state.get("pipeline_error", "This question cannot be answered."),
            "intent":     intent,
            "sql":        None, "confidence": 0.0,
            "chart_type": None, "chart_data": {},
            "applied_filters": {}, "follow_ups": [], "warnings": [],
            "insights":   [],
            "kpi_sources": [],
            "pipeline_meta": {
                "short_circuit":      True,
                "total_latency_ms":   elapsed,
                "node_latencies":     state.get("node_latencies", {}),
                "sql_retries":        0,
                "candidates_evaluated": 0,
                "total_tokens":       usage.get("total_tokens", 0),
                "total_cost":         usage.get("total_cost", 0.0),
            }
        }

    # ── kpi_info — pure RAG answer, no SQL ────────────────────────────────
    if intent == "kpi_info":
        kpi_rag = state.get("kpi_rag_result", {})
        result = {
            "answer":          kpi_rag.get("answer", "No KPI information found."),
            "intent":          intent,
            "sql":             None,
            "confidence":      0.9 if kpi_rag.get("retrieved_count", 0) > 0 else 0.3,
            "chart_type":      None,
            "chart_data":      {},
            "applied_filters": {},
            "follow_ups":      [],
            "warnings":        [],
            "insights":        [],
            "kpi_sources":     kpi_rag.get("sources", []),
            "pipeline_meta": {
                "short_circuit":        False,
                "rag_path":             True,
                "total_latency_ms":     elapsed,
                "node_latencies":       state.get("node_latencies", {}),
                "kpi_docs_retrieved":   kpi_rag.get("retrieved_count", 0),
                "sql_retries":          0,
                "candidates_evaluated": 0,
                "total_tokens":         usage.get("total_tokens", 0),
                "total_cost":           usage.get("total_cost", 0.0),
            }
        }
        if not conversation_history:
            _cache_set(user_question, result)
        return result

    # ── hybrid — RAG answer + SQL data ────────────────────────────────────
    if intent == "hybrid":
        kpi_rag = state.get("kpi_rag_result", {})
        fmt = state.get("format_result", {})
        insight = state.get("insight_result", {})

        # Combine RAG explanation with SQL data answer
        rag_answer  = kpi_rag.get("answer", "")
        sql_summary = fmt.get("nl_summary", "")
        combined_answer = (
            f"{rag_answer}\n\n**Data:**\n{sql_summary}"
            if rag_answer and sql_summary
            else (rag_answer or sql_summary or "No answer available.")
        )

        result = {
            "answer":          combined_answer,
            "intent":          intent,
            "sql":             state.get("sql_result", {}).get("sql"),
            "confidence":      fmt.get("confidence_score", 0.0),
            "chart_type":      fmt.get("chart_type"),
            "chart_data":      fmt.get("chart_data", {}),
            "applied_filters": fmt.get("applied_filters", {}),
            "follow_ups":      fmt.get("follow_up_suggestions", []),
            "warnings":        fmt.get("data_warnings", []),
            "insights":        insight.get("insights", []),
            "kpi_sources":     kpi_rag.get("sources", []),
            "pipeline_meta": {
                "short_circuit":        False,
                "rag_path":             True,
                "hybrid":               True,
                "total_latency_ms":     elapsed,
                "node_latencies":       state.get("node_latencies", {}),
                "kpi_docs_retrieved":   kpi_rag.get("retrieved_count", 0),
                "sql_retries":          state.get("sql_retry_count", 0),
                "candidates_evaluated": len(state.get("ut_result", {}).get("scores", [])),
                "total_tokens":         usage.get("total_tokens", 0),
                "total_cost":           usage.get("total_cost", 0.0),
            }
        }
        if not conversation_history:
            _cache_set(user_question, result)
        return result

    # ── Standard SQL path ─────────────────────────────────────────────────
    fmt     = state.get("format_result", {})
    ut      = state.get("ut_result", {})
    cost    = state.get("cost_result", {})
    insight = state.get("insight_result", {})

    final_result = {
        "answer":          fmt.get("nl_summary", "No summary available."),
        "intent":          intent,
        "sql":             state.get("sql_result", {}).get("sql"),
        "confidence":      fmt.get("confidence_score", 0.0),
        "chart_type":      fmt.get("chart_type"),
        "chart_data":      fmt.get("chart_data", {}),
        "applied_filters": fmt.get("applied_filters", {}),
        "follow_ups":      fmt.get("follow_up_suggestions", []),
        "warnings":        fmt.get("data_warnings", []),
        "insights":        insight.get("insights", []),
        "kpi_sources":     [],
        "pipeline_meta": {
            "short_circuit":     False,
            "rag_path":          False,
            "total_latency_ms":  elapsed,
            "node_latencies":    state.get("node_latencies", {}),
            "sql_retries":       state.get("sql_retry_count", 0),
            "validation_checks": state.get("validation_result", {}).get("checks", {}),
            "tables_used":       state.get("sql_result", {}).get("tables_used", []),
            "row_count":         state.get("execution_result", {}).get("row_count", 0),
            "candidates_evaluated": len(ut.get("scores", [])),
            "winning_strategy":  state.get("sql_result", {}).get("strategy", "unknown"),
            "candidate_scores":  ut.get("scores", []),
            "query_cost":        cost.get("estimated_cost", "unknown"),
            "total_tokens":      usage.get("total_tokens", 0),
            "total_cost":        usage.get("total_cost", 0.0),
        }
    }

    if state.get("execution_result", {}).get("success") and state.get("sql_result", {}).get("sql"):
        try:
            save_successful_query(
                user_id=user_id,
                question=user_question,
                sql=state["sql_result"]["sql"],
                confidence=fmt.get("confidence_score", 0.0),
            )
        except Exception:
            pass

    if not conversation_history:
        _cache_set(user_question, final_result)

    return final_result


# ══════════════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

def run_pipeline(
    user_question: str,
    conversation_history: list[dict] | None = None,
    user_id: str = "default_user",
) -> dict:
    """Run the full pipeline (NL→SQL or KPI RAG depending on intent)."""
    if conversation_history is None:
        conversation_history = []

    if not conversation_history:
        cached = _cache_get(user_question)
        if cached:
            print(f"[Orchestrator] Cache HIT for: {user_question[:60]}")
            return cached

    history = conversation_history[-6:]

    initial_state: PipelineState = {
        "user_question":        user_question,
        "conversation_history": history,
        "intent_result":        {},
        "schema_result":        {},
        "plan_result":          {},
        "sql_result":           {},
        "critic_result":        {},
        "validation_result":    {},
        "execution_result":     {},
        "format_result":        {},
        "sql_candidates":       [],
        "verification_results": {},
        "ut_result":            {},
        "cost_result":          {},
        "insight_result":       {},
        "kpi_rag_result":       {},   # NEW
        "sql_retry_count":      0,
        "exec_retry_count":     0,
        "fix_suggestion":       None,
        "pipeline_error":       None,
        "short_circuit":        False,
        "retrieved_context":    {},
        "node_latencies":       {},
        "usage_stats":          {},
    }

    thread_id = hashlib.md5(f"{user_id}:{user_question}".encode()).hexdigest()
    config = {"configurable": {"thread_id": thread_id}}
    start = time.time()

    with get_openai_callback() as cb:
        state = _pipeline.invoke(initial_state, config=config)
        usage = {
            "total_tokens":       cb.total_tokens,
            "prompt_tokens":      cb.prompt_tokens,
            "completion_tokens":  cb.completion_tokens,
            "total_cost":         cb.total_cost,
        }

    elapsed = round((time.time() - start) * 1000, 2)
    return _build_final_result(state, usage, elapsed, conversation_history, user_question, user_id)


def stream_pipeline(
    user_question: str,
    conversation_history: list[dict] | None = None,
    user_id: str = "default_user",
):
    """Generator that yields streaming SSE updates for the frontend."""
    if conversation_history is None:
        conversation_history = []

    if not conversation_history:
        cached = _cache_get(user_question)
        if cached:
            yield f"data: {json.dumps({'type': 'node', 'name': 'cache_hit'})}\n\n"
            yield f"data: {json.dumps({'type': 'final', 'data': cached})}\n\n"
            return

    history = conversation_history[-6:]
    initial_state: PipelineState = {
        "user_question":        user_question,
        "conversation_history": history,
        "intent_result":        {},
        "schema_result":        {},
        "plan_result":          {},
        "sql_result":           {},
        "critic_result":        {},
        "validation_result":    {},
        "execution_result":     {},
        "format_result":        {},
        "sql_candidates":       [],
        "verification_results": {},
        "ut_result":            {},
        "cost_result":          {},
        "insight_result":       {},
        "kpi_rag_result":       {},   # NEW
        "sql_retry_count":      0,
        "exec_retry_count":     0,
        "fix_suggestion":       None,
        "pipeline_error":       None,
        "short_circuit":        False,
        "retrieved_context":    {},
        "node_latencies":       {},
        "usage_stats":          {},
    }

    thread_id = hashlib.md5(f"{user_id}:{user_question}".encode()).hexdigest()
    config = {"configurable": {"thread_id": thread_id}}
    start = time.time()

    with get_openai_callback() as cb:
        for event in _pipeline.stream(initial_state, config=config, stream_mode="updates"):
            for node_name, _ in event.items():
                yield f"data: {json.dumps({'type': 'node', 'name': node_name})}\n\n"
        final_state = _pipeline.get_state(config).values
        usage = {
            "total_tokens":       cb.total_tokens,
            "prompt_tokens":      cb.prompt_tokens,
            "completion_tokens":  cb.completion_tokens,
            "total_cost":         cb.total_cost,
        }

    elapsed = round((time.time() - start) * 1000, 2)
    final_result = _build_final_result(final_state, usage, elapsed, conversation_history, user_question, user_id)
    yield f"data: {json.dumps({'type': 'final', 'data': final_result})}\n\n"


# ── Interactive CLI ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("Orchestrator — KPI RAG + Parallel Multi-Agent Pipeline")
    print("Type 'exit' or 'quit' to stop.")
    print("=" * 60)

    conversation_history = []

    while True:
        try:
            question = input("\nAsk a question: ").strip()
            if question.lower() in ("exit", "quit"):
                break
            if not question:
                continue

            result = run_pipeline(user_question=question, conversation_history=conversation_history)

            print(f"\n── Final Output ──")
            print(f"  Answer   : {result['answer'][:200]}")
            print(f"  Intent   : {result['intent']}")
            print(f"  SQL      : {result['sql']}")
            print(f"  RAG Path : {result['pipeline_meta'].get('rag_path', False)}")
            if result.get("kpi_sources"):
                print(f"  KPI Sources: {[s.get('name', s.get('tab_name')) for s in result['kpi_sources']]}")
            print(f"  Latency  : {result['pipeline_meta']['total_latency_ms']}ms")
            print(f"  Cost     : ${result['pipeline_meta'].get('total_cost', 0.0):.4f}")
            print("-" * 60)

            conversation_history.append({"role": "user", "content": question})
            conversation_history.append({"role": "assistant", "content": result["answer"]})

        except (KeyboardInterrupt, EOFError):
            print("\nExiting...")
            break