"""
main.py
-------
FastAPI application for the NL-to-SQL Parallel Multi-Agent Pipeline.

Endpoints:
  GET  /health  — Health check
  POST /query   — Run the full pipeline for a single NL question
  POST /chat    — Multi-turn chat (maintains conversation history server-side)
"""

import os
import sys
import logging
import uuid
from typing import Any, Dict, List, Optional
from collections import defaultdict

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Ensure backend/ is on sys.path ───────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from orchestrator import run_pipeline, stream_pipeline  # noqa: E402
from multidimension_anomaly import router as anomaly_router, load_all_data as load_anomaly_data  # noqa: E402
from recommendation import router as recommend_router, init_recommendation_service  # noqa: E402
from tab4_kpis import router as tab4_router, load_tab4_data  # noqa: E402
from tab5_explorer import router as tab5_router, load_tab5_data  # noqa: E402
from tab2_analytics import router as tab2_router, load_tab2_data  # noqa: E402
from tab1_analytics import router as tab1_router, load_tab1_data  # noqa: E402
from tab3_analytics import router as tab3_router, load_tab3_data  # noqa: E402

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("nlq-api")


# ═══════════════════════════════════════════════════════════════════════════════
#  Pydantic Schemas
# ═══════════════════════════════════════════════════════════════════════════════

# ── Request Models ────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    """Single-shot query — no conversation context."""
    question: str = Field(
        ...,
        min_length=1,
        description="The natural-language question to ask the pipeline.",
        json_schema_extra={"example": "Which channel has the most uploads?"},
    )


class ChatRequest(BaseModel):
    """Multi-turn chat — server maintains history per session_id."""
    question: str = Field(
        ...,
        min_length=1,
        description="The user's follow-up or new question.",
        json_schema_extra={"example": "What about for channel B?"},
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Session identifier. Omit to start a new session.",
    )

# ── Response Models ───────────────────────────────────────────────────────────

class PipelineMeta(BaseModel):
    short_circuit: bool = False
    total_latency_ms: float = 0.0
    node_latencies: Dict[str, float] = {}
    sql_retries: int = 0
    validation_checks: Dict[str, bool] = {}
    tables_used: List[str] = []
    row_count: int = 0
    candidates_evaluated: int = 0
    winning_strategy: Optional[str] = None
    candidate_scores: List[Any] = []
    query_cost: Optional[str] = None
    total_tokens: int = 0
    total_cost: float = 0.0


class QueryResponse(BaseModel):
    answer: str
    intent: Optional[str] = None
    sql: Optional[str] = None
    confidence: float = 0.0
    chart_type: Optional[str] = None
    chart_data: Dict[str, Any] = {}
    applied_filters: Dict[str, Any] = {}
    follow_ups: List[str] = []
    warnings: List[str] = []
    insights: List[str] = []
    pipeline_meta: PipelineMeta = PipelineMeta()


class ChatResponse(QueryResponse):
    session_id: str = Field(description="The session ID to use for follow-up messages.")


# ═══════════════════════════════════════════════════════════════════════════════
#  FastAPI App
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="NL-to-SQL Pipeline API",
    description=(
        "Parallel Multi-Agent pipeline that converts natural language questions "
        "into SQL, executes them, and returns formatted answers with insights."
    ),
    version="2.0.0",
)

# ── CORS (allow frontend from any origin during dev) ─────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Anomaly / Multidimension router ──────────────────────────────────────────
app.include_router(anomaly_router)

# ── Recommendation router ────────────────────────────────────────────────────
app.include_router(recommend_router)

# ── Tab 4 KPI router ─────────────────────────────────────────────────────────
app.include_router(tab4_router)

# ── Tab 5 Video Explorer router ──────────────────────────────────────────────
app.include_router(tab5_router)

# ── Tab 2 Analytics router ───────────────────────────────────────────────────
app.include_router(tab2_router)

# ── Tab 1 Analytics Overview router ─────────────────────────────────────────
app.include_router(tab1_router)

# ── Tab 3 Analysis router ──────────────────────────────────────────────────
app.include_router(tab3_router)


@app.on_event("startup")
def _startup_load_modules():
    try:
        load_anomaly_data()
        logger.info("Anomaly module data loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load anomaly data: %s", exc)

    try:
        init_recommendation_service()
        logger.info("Recommendation service initialised successfully.")
    except Exception as exc:
        logger.error("Failed to init recommendation service: %s", exc)

    try:
        load_tab4_data()
        logger.info("Tab 4 KPI data loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load Tab 4 KPI data: %s", exc)

    try:
        load_tab5_data()
        logger.info("Tab 5 Explorer data loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load Tab 5 Explorer data: %s", exc)

    try:
        load_tab2_data()
        logger.info("Tab 2 Analytics data loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load Tab 2 Analytics data: %s", exc)

    try:
        load_tab1_data()
        logger.info("Tab 1 Analytics Overview data loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load Tab 1 Analytics Overview data: %s", exc)

    try:
        load_tab3_data()
        logger.info("Tab 3 Analysis data loaded successfully.")
    except Exception as exc:
        logger.error("Failed to load Tab 3 Analysis data: %s", exc)


# ── In-memory chat sessions ─────────────────────────────────────────────────
_sessions: Dict[str, List[Dict[str, str]]] = defaultdict(list)


# ═══════════════════════════════════════════════════════════════════════════════
#  Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    """Main landing page to redirect users to documentation."""
    return {
        "message": "Welcome to the NL-to-SQL Parallel Pipeline API",
        "status": "Online",
        "documentation": "/docs",
        "health": "/health",
        "endpoints": {
            "query": "/query (POST)",
            "chat": "/chat (POST)"
        }
    }


@app.get("/health")
def health():
    """Lightweight liveness / readiness probe."""
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
def single_query(req: QueryRequest):
    """
    Run the full NL→SQL pipeline for a **single** question.

    No conversation history is maintained.
    """
    logger.info("POST /query  question=%s", req.question[:80])

    try:
        result = run_pipeline(
            user_question=req.question,
            conversation_history=[],
        )
        return _build_response(result)

    except Exception as exc:
        logger.exception("Pipeline failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """
    Multi-turn chat endpoint.

    - Omit `session_id` to start a **new** session.
    - Pass `session_id` from a previous response to continue the conversation.

    The server keeps the last 6 messages of history per session.
    """
    session_id = req.session_id or str(uuid.uuid4())
    history = _sessions[session_id]

    logger.info(
        "POST /chat  session=%s  turns=%d  question=%s",
        session_id,
        len(history),
        req.question[:80],
    )

    try:
        result = run_pipeline(
            user_question=req.question,
            conversation_history=history,
        )

        # Append to session history (keep last 6 turns)
        history.append({"role": "user", "content": req.question})
        history.append({"role": "assistant", "content": result.get("answer", "")})
        _sessions[session_id] = history[-6:]

        resp = _build_response(result)
        return ChatResponse(**resp.model_dump(), session_id=session_id)

    except Exception as exc:
        logger.exception("Pipeline failed")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/query/stream")
def single_query_stream(req: QueryRequest):
    """Run the pipeline and stream progress as SSE."""
    logger.info("POST /query/stream  question=%s", req.question[:80])
    return StreamingResponse(
        stream_pipeline(req.question, conversation_history=[]),
        media_type="text/event-stream"
    )


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """Run the pipeline and stream progress as SSE."""
    session_id = req.session_id or str(uuid.uuid4())
    history = _sessions[session_id]
    
    logger.info("POST /chat/stream  session=%s  question=%s", session_id, req.question[:80])
    
    # We yield events, but we also need to save the final answer to history.
    # Since stream_pipeline doesn't automatically inject the result into this variable,
    # we'll just intercept the stream minimally or let the client handle history.
    # Actually, the simplest way is to wrap stream_pipeline to append history at the end.
    def history_wrapper():
        final_data = None
        for chunk in stream_pipeline(req.question, conversation_history=history):
            if '"type": "final"' in chunk:
                import json
                try:
                    data = json.loads(chunk.replace("data: ", "").strip())
                    final_data = data.get("data", {})
                    data["session_id"] = session_id
                    chunk = f"data: {json.dumps(data)}\n\n"
                except Exception:
                    pass
            yield chunk

        if final_data:
            history.append({"role": "user", "content": req.question})
            history.append({"role": "assistant", "content": final_data.get("answer", "")})
            _sessions[session_id] = history[-6:]
            
    return StreamingResponse(
        history_wrapper(),
        media_type="text/event-stream"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _build_response(raw: dict) -> QueryResponse:
    """Normalise the orchestrator dict into a Pydantic QueryResponse."""
    meta_raw = raw.get("pipeline_meta", {})
    return QueryResponse(
        answer=raw.get("answer", "No answer available."),
        intent=raw.get("intent"),
        sql=raw.get("sql"),
        confidence=raw.get("confidence", 0.0),
        chart_type=raw.get("chart_type"),
        chart_data=raw.get("chart_data", {}),
        applied_filters=raw.get("applied_filters", {}),
        follow_ups=raw.get("follow_ups", []),
        warnings=raw.get("warnings", []),
        insights=raw.get("insights", []),
        pipeline_meta=PipelineMeta(
            short_circuit=meta_raw.get("short_circuit", False),
            total_latency_ms=meta_raw.get("total_latency_ms", 0.0),
            node_latencies=meta_raw.get("node_latencies", {}),
            sql_retries=meta_raw.get("sql_retries", 0),
            validation_checks=meta_raw.get("validation_checks", {}),
            tables_used=meta_raw.get("tables_used", []),
            row_count=meta_raw.get("row_count", 0),
            candidates_evaluated=meta_raw.get("candidates_evaluated", 0),
            winning_strategy=meta_raw.get("winning_strategy"),
            candidate_scores=meta_raw.get("candidate_scores", []),
            query_cost=meta_raw.get("query_cost"),
            total_tokens=meta_raw.get("total_tokens", 0),
            total_cost=meta_raw.get("total_cost", 0.0),
        ),
    )
