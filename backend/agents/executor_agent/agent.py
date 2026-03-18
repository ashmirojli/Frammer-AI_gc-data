"""
executor_agent.py
-----------------
Executor Agent.

Directly invokes the LangChain `sql_execute` tool from `tools/sql_tools.py`.
This keeps the database logic cleanly encapsulated in the tool layer,
while this agent acts as the pipeline node bridging the tool's output.
"""

import os
import sys
import time
import json

# Ensure backend/ is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools.sql_tools import sql_execute


def execute_sql(sql: str) -> dict:
    """
    Execute a validated SQL query against the database using the LangChain tool.

    Args:
        sql : validated SQL string

    Returns:
        dict with keys matching the orchestrator expectations:
            success, columns, rows, row_count, total_count, truncated, latency_ms, error
    """
    start = time.time()
    
    if not sql or not sql.strip():
        latency_ms = round((time.time() - start) * 1000, 2)
        return {
            "success":     False,
            "columns":     [],
            "rows":        [],
            "row_count":   0,
            "total_count": 0,
            "truncated":   False,
            "latency_ms":  latency_ms,
            "error":       "Empty SQL."
        }
        
    # ── Invoke the LangChain Tool ─────────────────────────────────────────────
    # The tool returns a JSON string, so we parse it back to a dict
    tool_result_str = sql_execute.invoke({"sql": sql})
    
    try:
        if isinstance(tool_result_str, dict):
            # sometimes LangChain tools return dict directly depending on version
            result = tool_result_str
        else:
            result = json.loads(tool_result_str)
    except (json.JSONDecodeError, TypeError):
        result = {"success": False, "error": f"Tool returned invalid output: {tool_result_str}"}
        
    latency_ms = round((time.time() - start) * 1000, 2)
    
    # ── Format the response for the pipeline ──────────────────────────────────
    if result.get("success"):
        row_count = result.get("row_count", 0)
        truncated = result.get("truncated", False)
        
        # approximate total_count for the UI
        from tools.sql_tools import MAX_ROWS
        total = f"{MAX_ROWS}+" if truncated else row_count
        
        return {
            "success":     True,
            "columns":     result.get("columns", []),
            "rows":        result.get("rows", []),
            "row_count":   row_count,
            "total_count": total,
            "truncated":   truncated,
            "latency_ms":  latency_ms,
            "error":       None
        }
    else:
        return {
            "success":     False,
            "columns":     [],
            "rows":        [],
            "row_count":   0,
            "total_count": 0,
            "truncated":   False,
            "latency_ms":  latency_ms,
            "error":       result.get("error", "Unknown execution error.")
        }


# ── Quick test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_cases = [
        {"label": "Drop-off by channel",
         "sql": "SELECT dc.channel_name AS channel, "
                "SUM(fuc.created_count) - SUM(fuc.published_count) AS drop_off "
                "FROM fact_user_channel AS fuc "
                "JOIN dim_channel AS dc ON fuc.channel_id = dc.channel_id "
                "GROUP BY dc.channel_name ORDER BY drop_off DESC"},
        {"label": "Overall publish rate",
         "sql": "SELECT ROUND(100.0 * SUM(published_count) / "
                "NULLIF(SUM(created_count), 0), 2) AS publish_rate_pct "
                "FROM fact_user_summary"},
        {"label": "Invalid SQL",
         "sql": "SELECT invalid_col FROM nonexistent_table"},
    ]

    print("=" * 60)
    print("Executor Agent (LangChain Tool Wrapper) — Test Run")
    print("=" * 60)

    for i, tc in enumerate(test_cases, 1):
        print(f"\nTest {i}: {tc['label']}")
        result = execute_sql(tc["sql"])
        print(f"  Success  : {result['success']}")
        if result['success']:
            print(f"  Columns  : {result['columns']}")
            print(f"  Rows     : {result['row_count']} / {result['total_count']}")
            if result["rows"]:
                print(f"  First    : {result['rows'][0]}")
        else:
            print(f"  Error    : {result['error']}")
        print(f"  Latency  : {result['latency_ms']}ms")
        print("-" * 60)
