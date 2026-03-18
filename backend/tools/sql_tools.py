"""
sql_tools.py
------------
LangChain tools for SQL database interaction.

Provides:
  1. SQLDatabaseToolkit integration (auto-generates list_tables, schema, query_checker, query)
  2. Custom safety-wrapped SQL execution tool
  3. Custom SQL validation tools (syntax, table, safety, cost)

These tools are used by the Table Agent and SQL Generator Agent.
"""

import os
import re
import json
import sqlite3
from langchain_core.tools import tool
from langchain_community.utilities import SQLDatabase

# ── Database path ─────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))   # tools/
BACKEND_DIR = os.path.dirname(BASE_DIR)                     # backend/
DB_PATH     = os.path.join(BACKEND_DIR, "data", "frammer.db")

# ── SQLDatabase instance (LangChain wrapper around SQLAlchemy) ────────────────
_db = None

def get_sql_database() -> SQLDatabase:
    """Return a singleton SQLDatabase instance for the frammer.db."""
    global _db
    if _db is None:
        db_abs = os.path.abspath(DB_PATH)
        _db = SQLDatabase.from_uri(f"sqlite:///{db_abs}")
    return _db


# ── Allowed tables (for validation) ──────────────────────────────────────────
ALLOWED_TABLES = {
    "fact_user_summary", "fact_user_channel", "fact_monthly",
    "fact_channel_publishing", "fact_input_type", "fact_language",
    "fact_output_type", "fact_video",
    "dim_channel", "dim_user", "dim_input_type", "dim_output_type",
    "dim_language", "dim_platform", "dim_team", "dim_month",
}

# ── Forbidden SQL keywords ───────────────────────────────────────────────────
FORBIDDEN_KEYWORDS = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE"]

MAX_ROWS    = 500
TIMEOUT_SEC = 10


# ══════════════════════════════════════════════════════════════════════════════
#  TOOLS FOR TABLE AGENT (database introspection)
# ══════════════════════════════════════════════════════════════════════════════

@tool
def sql_get_tables() -> str:
    """List all tables in the Frammer AI database.

    Returns the names of all available fact and dimension tables.
    Use this to discover what tables exist before selecting which ones to query.

    Returns:
        A JSON array of table names.
    """
    db = get_sql_database()
    tables = db.get_usable_table_names()
    return json.dumps(sorted(tables))


@tool
def sql_get_schema(table_name: str) -> str:
    """Get the full CREATE TABLE schema for a specific table.

    Use this to inspect columns, data types, and primary/foreign keys
    of a table before writing SQL.

    Args:
        table_name: The exact table name (e.g., 'fact_user_channel', 'dim_channel').

    Returns:
        The CREATE TABLE DDL statement for the table, or an error message
        if the table does not exist.
    """
    table_lower = table_name.strip().lower()
    if table_lower not in {t.lower() for t in ALLOWED_TABLES}:
        return f"Error: Table '{table_name}' does not exist in the schema. Use sql_get_tables to see available tables."
    db = get_sql_database()
    return db.get_table_info(table_names=[table_name])


@tool
def sql_sample_rows(table_name: str, limit: int = 3) -> str:
    """Retrieve a few sample rows from a table to understand its data.

    Use this to inspect actual values, column formats, and data quality
    before writing queries.

    Args:
        table_name: The exact table name to sample.
        limit: Number of rows to return (default: 3, max: 10).

    Returns:
        A JSON string of sample rows, or an error message.
    """
    table_lower = table_name.strip().lower()
    if table_lower not in {t.lower() for t in ALLOWED_TABLES}:
        return f"Error: Table '{table_name}' does not exist."
    limit = min(max(1, limit), 10)
    try:
        conn = sqlite3.connect(f"file:{os.path.abspath(DB_PATH)}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
        columns = [desc[0] for desc in cursor.description]
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return json.dumps({"columns": columns, "rows": rows}, indent=2, default=str)
    except Exception as e:
        return f"Error sampling table: {str(e)}"


# ══════════════════════════════════════════════════════════════════════════════
#  TOOLS FOR SQL VALIDATOR AGENT
# ══════════════════════════════════════════════════════════════════════════════

@tool
def sql_syntax_check(sql: str) -> str:
    """Check if a SQL query has valid syntax using SQLite EXPLAIN.

    Args:
        sql: The SQL query to validate.

    Returns:
        'PASS: Syntax is valid.' or an error description.
    """
    if not sql or not sql.strip():
        return "FAIL: Empty SQL."
    try:
        conn = sqlite3.connect(":memory:")
        conn.execute(f"EXPLAIN {sql}")
        conn.close()
        return "PASS: Syntax is valid."
    except sqlite3.OperationalError as e:
        err = str(e)
        if "no such table" in err or "no such column" in err:
            return "PASS: Syntax is valid (table/column check deferred to schema check)."
        return f"FAIL: {err}"
    except Exception as e:
        return f"FAIL: {str(e)}"


@tool
def sql_table_name_check(sql: str) -> str:
    """Verify that all tables referenced in a SQL query exist in the schema.

    Args:
        sql: The SQL query to validate.

    Returns:
        'PASS' if all tables are valid, or a description of unknown tables.
    """
    if not sql:
        return "FAIL: Empty SQL."

    # try sqlglot first, fall back to regex
    try:
        import sqlglot
        import sqlglot.expressions as exp
        parsed = sqlglot.parse_one(sql, dialect="sqlite")
        referenced = {
            table.name.lower()
            for table in parsed.find_all(exp.Table)
            if table.name
        }
    except Exception:
        referenced = set(re.findall(r"(?:FROM|JOIN)\s+(\w+)", sql, re.IGNORECASE))

    allowed_lower = {t.lower() for t in ALLOWED_TABLES}
    hallucinated = {t for t in referenced if t.lower() not in allowed_lower}

    if hallucinated:
        return f"FAIL: Unknown tables referenced: {sorted(hallucinated)}. Allowed: {sorted(ALLOWED_TABLES)}"
    return f"PASS: All tables are valid — {sorted(referenced)}"


@tool
def sql_safety_check(sql: str) -> str:
    """Check if a SQL query contains any forbidden destructive keywords.

    Blocks: DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE.

    Args:
        sql: The SQL query to verify.

    Returns:
        'PASS: SQL is safe.' or a description of the forbidden keyword found.
    """
    if not sql:
        return "FAIL: Empty SQL."
    sql_upper = sql.upper()
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{kw}\b", sql_upper):
            return f"FAIL: Forbidden keyword detected — {kw}. Only SELECT statements are allowed."
    return "PASS: SQL is safe (read-only SELECT)."


# ══════════════════════════════════════════════════════════════════════════════
#  TOOL FOR EXECUTOR
# ══════════════════════════════════════════════════════════════════════════════

@tool
def sql_execute(sql: str) -> str:
    """Execute a validated, read-only SQL query against the Frammer AI database.

    This tool runs the query with safety protections:
      - Read-only connection (mode=ro)
      - Timeout protection (10s)
      - Row cap at 500

    Args:
        sql: A validated SELECT query to execute.

    Returns:
        A JSON string with columns, rows, row_count, and any error.
    """
    if not sql or not sql.strip():
        return json.dumps({"success": False, "error": "Empty SQL."})

    # final safety guard
    sql_upper = sql.upper()
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{kw}\b", sql_upper):
            return json.dumps({"success": False, "error": f"Dangerous SQL blocked — {kw}"})

    try:
        db_abs = os.path.abspath(DB_PATH)
        conn = sqlite3.connect(f"file:{db_abs}?mode=ro", uri=True, timeout=TIMEOUT_SEC)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(sql)

        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows, truncated = [], False
        for row in cursor:
            if len(rows) >= MAX_ROWS:
                truncated = True
                break
            rows.append(dict(row))
        conn.close()

        # serialize
        clean_rows = []
        for row in rows:
            clean = {}
            for k, v in row.items():
                if isinstance(v, float):
                    clean[k] = round(v, 2)
                else:
                    clean[k] = v
            clean_rows.append(clean)

        return json.dumps({
            "success":   True,
            "columns":   columns,
            "rows":      clean_rows,
            "row_count": len(clean_rows),
            "truncated": truncated,
            "error":     None
        }, default=str)

    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


# ── Convenience: get grouped tool lists ──────────────────────────────────────

def get_table_tools() -> list:
    """Tools for the Table Agent (database introspection)."""
    return [sql_get_tables, sql_get_schema, sql_sample_rows]

def get_validator_tools() -> list:
    """Tools for the SQL Validator Agent."""
    return [sql_syntax_check, sql_table_name_check, sql_safety_check]

def get_executor_tools() -> list:
    """Tools for the Executor node."""
    return [sql_execute]

def get_all_sql_tools() -> list:
    """Return all SQL tools."""
    return get_table_tools() + get_validator_tools() + get_executor_tools()
