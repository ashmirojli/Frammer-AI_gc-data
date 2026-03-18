"""
unit_tester_agent.py
--------------------
Unit Tester Agent — evaluates SQL candidates by dry-running them
against SQLite and scoring based on logical correctness criteria.

No LLM needed — this is pure deterministic evaluation.
"""

import os
import sys
import sqlite3
import re

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Database path ────────────────────────────────────────────────────────────
# __file__ is backend/agents/unit_tester_agent/agent.py
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "frammer.db")


def _dry_run(sql: str) -> dict:
    """Execute SQL and return result metadata (not data)."""
    if not sql or not sql.strip():
        return {"success": False, "error": "Empty SQL", "row_count": 0, "columns": []}

    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description] if cur.description else []
        rows = cur.fetchall()
        conn.close()
        return {
            "success": True,
            "error": None,
            "row_count": len(rows),
            "columns": columns,
            "first_rows": rows[:3],  # sample for scoring
        }
    except Exception as e:
        return {"success": False, "error": str(e), "row_count": 0, "columns": []}


def _score_candidate(sql: str, dry_result: dict, user_question: str, schema_result: dict) -> int:
    """Score a SQL candidate based on correctness criteria.
    
    Scoring rubric (max 14 points):
      +3  valid execution (no errors)
      +2  returns rows (non-empty result)
      +2  uses aggregation (SUM/COUNT/AVG) when question implies totals
      +2  uses ORDER BY when question implies ranking
      +2  uses JOIN when dimension tables are needed
      +1  uses GROUP BY with aggregation
      +2  uses correct fact table from schema_result
    """
    score = 0
    sql_upper = (sql or "").upper()
    q_lower = user_question.lower()

    # +3: valid execution
    if dry_result.get("success"):
        score += 3
    else:
        return 0  # invalid SQL gets 0

    # +2: returns rows
    if dry_result.get("row_count", 0) > 0:
        score += 2

    # +2: aggregation when needed
    needs_agg = any(kw in q_lower for kw in ["total", "sum", "count", "average", "most", "highest", "lowest"])
    has_agg = any(fn in sql_upper for fn in ["SUM(", "COUNT(", "AVG(", "MAX(", "MIN("])
    if needs_agg and has_agg:
        score += 2
    elif not needs_agg:
        score += 2  # no aggregation needed, no penalty

    # +2: ORDER BY when needed
    needs_order = any(kw in q_lower for kw in ["top", "highest", "lowest", "most", "least", "rank", "best", "worst"])
    has_order = "ORDER BY" in sql_upper
    if needs_order and has_order:
        score += 2
    elif not needs_order:
        score += 2

    # +2: JOIN when dimensions are needed
    dims = schema_result.get("dimension_tables", [])
    has_join = "JOIN" in sql_upper
    if dims and has_join:
        score += 2
    elif not dims:
        score += 2

    # +1: GROUP BY with aggregation
    has_group = "GROUP BY" in sql_upper
    if has_agg and has_group:
        score += 1

    # +2: correct primary table
    primary = schema_result.get("primary_table", "")
    if primary and primary.lower() in sql_upper.lower():
        score += 2

    return score


def evaluate_candidates(
    sql_candidates: list[dict],
    user_question: str,
    schema_result: dict,
) -> dict:
    """
    Evaluate a list of SQL candidates and pick the best one.

    Args:
        sql_candidates: list of dicts, each with at least 'sql', 'confidence_score', 'strategy'
        user_question:  the original user question
        schema_result:  output from the table agent

    Returns:
        dict with:
          - best_sql:      the winning SQL result dict
          - scores:        list of {strategy, sql_preview, score, dry_run_ok, row_count}
          - winner_index:  index of the winner
    """
    if not sql_candidates:
        return {
            "best_sql": {"sql": "", "confidence_score": 0.0, "strategy": "none"},
            "scores": [],
            "winner_index": -1,
        }

    scored = []
    for i, candidate in enumerate(sql_candidates):
        sql = candidate.get("sql", "")
        dry = _dry_run(sql)
        score = _score_candidate(sql, dry, user_question, schema_result)

        # Boost score by LLM confidence (0-1 range → 0-3 bonus points)
        confidence_bonus = round(candidate.get("confidence_score", 0.0) * 3)
        total_score = score + confidence_bonus

        scored.append({
            "index": i,
            "strategy": candidate.get("strategy", f"gen_{i}"),
            "sql_preview": (sql[:80] + "...") if len(sql) > 80 else sql,
            "score": total_score,
            "base_score": score,
            "confidence_bonus": confidence_bonus,
            "dry_run_ok": dry.get("success", False),
            "row_count": dry.get("row_count", 0),
            "error": dry.get("error"),
        })

    # Sort by total score descending, then by confidence
    scored.sort(key=lambda x: (x["score"], sql_candidates[x["index"]].get("confidence_score", 0)), reverse=True)

    winner_idx = scored[0]["index"]
    best = sql_candidates[winner_idx].copy()

    return {
        "best_sql": best,
        "scores": scored,
        "winner_index": winner_idx,
    }


# ── Quick test ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_candidates = [
        {"sql": "SELECT channel_name FROM dim_channel", "confidence_score": 0.5, "strategy": "direct"},
        {"sql": "SELECT dc.channel_name, SUM(fuc.uploaded_count) AS total FROM fact_user_channel fuc JOIN dim_channel dc ON fuc.channel_id = dc.channel_id GROUP BY dc.channel_name ORDER BY total DESC LIMIT 5", "confidence_score": 0.9, "strategy": "reasoning"},
        {"sql": "SELECT * FROM nonexistent_table", "confidence_score": 0.3, "strategy": "example"},
    ]
    test_schema = {"primary_table": "fact_user_channel", "dimension_tables": ["dim_channel"]}

    result = evaluate_candidates(test_candidates, "Top 5 channels by uploads", test_schema)
    print(f"Winner: Strategy '{result['best_sql']['strategy']}' (index {result['winner_index']})")
    for s in result["scores"]:
        print(f"  {s['strategy']}: score={s['score']} ok={s['dry_run_ok']} rows={s['row_count']}")
