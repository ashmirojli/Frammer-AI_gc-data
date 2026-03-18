"""
recommendation.py
-----------------
FastAPI router for the Contextual Bandit recommendation engine.

Endpoints:
  GET  /api/recommend/context     — Available input types, platforms, output types
  POST /api/recommend             — Get ranked output-type recommendations
  POST /api/recommend/feedback    — Log user reward to improve the bandit
"""

import os
import sqlite3
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("recommend")

router = APIRouter(prefix="/api/recommend", tags=["Recommendations"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "frammer.db")

OUTPUT_TYPE_NAMES = {
    1: "Full Package",
    2: "Key Moments",
    3: "Chapters",
    4: "My Key Moments",
    5: "Summary",
}

_bandit = None
_context_data = None


# ═══════════════════════════════════════════════════════════════════════════════
#  Initialisation
# ═══════════════════════════════════════════════════════════════════════════════

def init_recommendation_service():
    """Initialise the bandit and load context dimension data."""
    global _bandit, _context_data

    from scripts.vw_bandit_service import ContextualBanditService

    try:
        _bandit = ContextualBanditService()
        logger.info("Contextual bandit service initialised.")
    except Exception as exc:
        logger.error("Failed to init bandit service: %s", exc)
        _bandit = None

    _context_data = _load_context_dimensions()


def _load_context_dimensions() -> dict:
    """Load input-type and platform names from the DB or CSVs for the UI selectors."""
    input_types = {}
    platforms = {}

    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("SELECT inputtype_id, input_type_name FROM dim_input_type")
            for row in cur.fetchall():
                input_types[int(row[0])] = row[1]
            cur.execute("SELECT platform_id, platform_name FROM dim_platform")
            for row in cur.fetchall():
                platforms[int(row[0])] = row[1]
            conn.close()
        except Exception as exc:
            logger.error("Error loading context from DB: %s", exc)

    if not input_types or not platforms:
        csv_dir = os.path.join(os.path.dirname(BASE_DIR), "StarSchemaDB")
        try:
            import pandas as pd
            if not input_types:
                df = pd.read_csv(os.path.join(csv_dir, "Dim_Input_Type.csv"))
                input_types = dict(zip(df["InputType_ID"].astype(int), df["Input_Type_Name"].astype(str)))
            if not platforms:
                df = pd.read_csv(os.path.join(csv_dir, "Dim_Platform.csv"))
                platforms = dict(zip(df["Platform_ID"].astype(int), df["Platform_Name"].astype(str)))
            logger.info("Loaded context dimensions from CSVs.")
        except Exception as exc:
            logger.warning("CSV fallback also failed: %s", exc)

    return {"input_types": input_types, "platforms": platforms}


# ═══════════════════════════════════════════════════════════════════════════════
#  Pydantic models
# ═══════════════════════════════════════════════════════════════════════════════

class RecommendRequest(BaseModel):
    inputtype_id: int = Field(1, description="Input type ID")
    duration_sec: int = Field(600, description="Duration of the content in seconds")
    platform_id: int = Field(1, description="Target platform ID")


class FeedbackRequest(BaseModel):
    inputtype_id: int
    duration_sec: int
    platform_id: int
    action: int = Field(..., description="Output type ID the user selected (1-5)")
    reward: float = Field(..., description="Reward signal: 1.0 = positive, 0.0 = neutral, -1.0 = negative")
    probability: float = Field(..., description="Probability that was shown for this action")


class ChatMessage(BaseModel):
    message: str = Field(..., min_length=1)
    inputtype_id: Optional[int] = None
    duration_sec: Optional[int] = None
    platform_id: Optional[int] = None


# ═══════════════════════════════════════════════════════════════════════════════
#  Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/context")
def get_context():
    """Return available input types, platforms, and output types for UI selectors."""
    ctx = _context_data or {"input_types": {}, "platforms": {}}
    return {
        "input_types": [{"id": k, "name": v} for k, v in ctx["input_types"].items()],
        "platforms": [{"id": k, "name": v} for k, v in ctx["platforms"].items()],
        "output_types": [{"id": k, "name": v} for k, v in OUTPUT_TYPE_NAMES.items()],
    }


@router.post("/")
def get_recommendations(req: RecommendRequest):
    """Return ranked output-type recommendations from the contextual bandit."""
    if _bandit is None:
        raise HTTPException(status_code=503, detail="Recommendation service not available.")

    try:
        recs = _bandit.get_recommendation(req.inputtype_id, req.duration_sec, req.platform_id)
    except Exception as exc:
        logger.exception("Bandit prediction failed")
        raise HTTPException(status_code=500, detail=str(exc))

    for r in recs:
        r["output_type_name"] = OUTPUT_TYPE_NAMES.get(r["output_type_id"], "Unknown")
        r["probability"] = round(r["probability"], 4)

    return {"recommendations": recs, "context": {
        "inputtype_id": req.inputtype_id,
        "duration_sec": req.duration_sec,
        "platform_id": req.platform_id,
    }}


@router.post("/feedback")
def post_feedback(req: FeedbackRequest):
    """Log reward to the bandit so it can learn from user choices."""
    if _bandit is None:
        raise HTTPException(status_code=503, detail="Recommendation service not available.")

    try:
        _bandit.log_reward(
            inputtype_id=req.inputtype_id,
            duration_sec=req.duration_sec,
            platform_id=req.platform_id,
            action=req.action,
            reward=req.reward,
            probability=req.probability,
        )
    except Exception as exc:
        logger.exception("Bandit feedback failed")
        raise HTTPException(status_code=500, detail=str(exc))

    return {"status": "ok", "message": "Feedback recorded."}


@router.post("/chat")
def recommendation_chat(req: ChatMessage):
    """
    Simple recommendation chat — takes a user message plus optional context,
    runs the bandit, and returns a natural-language response with recommendations.
    """
    it = req.inputtype_id or 1
    dur = req.duration_sec or 600
    plat = req.platform_id or 1

    ctx = _context_data or {"input_types": {}, "platforms": {}}
    input_name = ctx["input_types"].get(it, f"Type {it}")
    plat_name = ctx["platforms"].get(plat, f"Platform {plat}")

    if _bandit is None:
        return {
            "reply": "The recommendation engine is currently unavailable. Please ensure the baseline model has been built.",
            "recommendations": [],
        }

    try:
        recs = _bandit.get_recommendation(it, dur, plat)
    except Exception:
        return {
            "reply": "Sorry, I encountered an error generating recommendations. Please try again.",
            "recommendations": [],
        }

    for r in recs:
        r["output_type_name"] = OUTPUT_TYPE_NAMES.get(r["output_type_id"], "Unknown")
        r["probability"] = round(r["probability"], 4)

    top = recs[0]
    second = recs[1] if len(recs) > 1 else None

    dur_label = "short" if dur < 600 else "medium-length" if dur < 1800 else "long-form"
    reply = (
        f"Based on your {dur_label} {input_name} content targeting {plat_name}, "
        f"I recommend **{top['output_type_name']}** as the primary output format "
        f"({top['probability']*100:.1f}% confidence)."
    )
    if second and second["probability"] > 0.15:
        reply += (
            f" As an alternative, consider **{second['output_type_name']}** "
            f"({second['probability']*100:.1f}% confidence) to diversify your output mix."
        )

    reply += (
        " Would you like me to explain why, or would you like to adjust the content context?"
    )

    return {
        "reply": reply,
        "recommendations": recs,
        "context": {
            "inputtype_id": it,
            "duration_sec": dur,
            "platform_id": plat,
            "input_name": input_name,
            "platform_name": plat_name,
        },
    }
