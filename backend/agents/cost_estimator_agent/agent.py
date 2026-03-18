"""
cost_estimator_agent.py
-----------------------
Cost Estimator Agent — runs EXPLAIN QUERY PLAN on SQL
to estimate query cost and detect full table scans.

Pure Python — no LLM needed.
"""

import os
import sys
import sqlite3

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# ── Database path ────────────────────────────────────────────────────────────
# __file__ is backend/agents/cost_estimator_agent/agent.py
# backend/data/frammer.db is ../../../data/frammer.db
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "frammer.db")


def estimate_cost(sql: str) -> dict:
    """
    Run EXPLAIN QUERY PLAN and return cost metadata.

    Returns:
        dict with:
          - plan_steps:     list of query plan detail strings
          - has_full_scan:  True if any step is a full table scan
          - estimated_cost: 'low' | 'medium' | 'high'
          - warnings:       list of cost-related warnings
    """
    if not sql or not sql.strip():
        return {
            "plan_steps": [],
            "has_full_scan": False,
            "estimated_cost": "unknown",
            "warnings": ["No SQL to analyze."],
        }

    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute(f"EXPLAIN QUERY PLAN {sql}")
        rows = cur.fetchall()
        conn.close()

        plan_steps = [row[3] if len(row) > 3 else str(row) for row in rows]

        # Detect full table scans
        has_full_scan = any("SCAN" in step.upper() and "INDEX" not in step.upper() for step in plan_steps)

        # Count join operations
        join_count = sum(1 for step in plan_steps if "SEARCH" in step.upper() or "SCAN" in step.upper())

        # Estimate cost
        warnings = []
        if has_full_scan:
            warnings.append("Query involves a full table scan — may be slow on large datasets.")
            estimated_cost = "high" if join_count > 2 else "medium"
        elif join_count > 3:
            warnings.append(f"Query involves {join_count} table operations.")
            estimated_cost = "medium"
        else:
            estimated_cost = "low"

        return {
            "plan_steps": plan_steps,
            "has_full_scan": has_full_scan,
            "estimated_cost": estimated_cost,
            "warnings": warnings,
        }
    except Exception as e:
        return {
            "plan_steps": [],
            "has_full_scan": False,
            "estimated_cost": "unknown",
            "warnings": [f"Cost estimation failed: {str(e)}"],
        }
