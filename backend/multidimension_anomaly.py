"""
multidimension_anomaly.py
-------------------------
FastAPI router for multidimensional matrix analysis, z-score anomaly detection,
and DBSCAN user/channel clustering.

Endpoints:
  GET /api/anomaly/dimensions  — Available dimensions
  GET /api/anomaly/kpis        — Aggregate KPIs
  GET /api/anomaly/matrix      — Cross-tab matrix + anomalies for dim1 × dim2
  GET /api/anomaly/clusters    — DBSCAN clustering results
  GET /api/anomaly/breakdown   — Breakdown table for a single dimension
"""

import os
import math
import logging
from typing import Any, Dict

import pandas as pd
import numpy as np
from fastapi import APIRouter, Query
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("anomaly")

router = APIRouter(prefix="/api/anomaly", tags=["Multidimension & Anomaly"])

DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "StarSchemaDB"
)

# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

_data: Dict[str, Any] = {}


def _safe(v):
    """Convert numpy types to native Python for JSON serialization."""
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v) if not (math.isnan(v) or math.isinf(v)) else 0.0
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, np.ndarray):
        return [_safe(x) for x in v]
    return v


def _parse_duration(dur_str) -> int:
    if pd.isna(dur_str) or str(dur_str).strip() in ("", "0:00:00", "00:00:00"):
        return 0
    parts = str(dur_str).split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    return 0


def _fmt_duration(secs: int) -> str:
    if secs <= 0:
        return "0m"
    h, m = divmod(secs // 60, 60)
    return f"{h}h {m}m" if h else f"{m}m"


def _load_csv(name: str) -> pd.DataFrame:
    return pd.read_csv(os.path.join(DATA_DIR, name))


def _empty_cell() -> dict:
    return {"count": 0, "created": 0, "published": 0, "duration": 0, "conversion": 0.0}


def _add_conversion(d: dict) -> dict:
    denom = d.get("created", 0) or d.get("count", 0)
    d["conversion"] = round(d["published"] / denom * 100, 1) if denom > 0 else 0.0
    return d


# ═══════════════════════════════════════════════════════════════════════════════
#  Data Loading
# ═══════════════════════════════════════════════════════════════════════════════


def load_all_data():
    """Load all CSVs into the global _data store."""
    logger.info("Loading StarSchemaDB CSVs for anomaly module...")

    dims = {}
    for name, id_col, name_col in [
        ("Dim_User.csv", "User_ID", "User_Name"),
        ("Dim_Channel.csv", "Channel_ID", "Channel_Name"),
        ("Dim_Platform.csv", "Platform_ID", "Platform_Name"),
        ("Dim_Team.csv", "Team_ID", "Team_Name"),
        ("Dim_Input_Type.csv", "InputType_ID", "Input_Type_Name"),
        ("Dim_Language.csv", "Language_ID", "Language_Name"),
        ("Dim_Month.csv", "Month_ID", "Month_Name"),
        ("Dim_Output_Type.csv", "OutputType_ID", "Output_Type_Name"),
    ]:
        try:
            df = _load_csv(name)
            dims[id_col.replace("_ID", "").lower()] = dict(
                zip(df[id_col].astype(int), df[name_col].astype(str))
            )
        except Exception as e:
            logger.warning("Failed to load %s: %s", name, e)
            dims[id_col.replace("_ID", "").lower()] = {}

    _data["dims"] = dims

    _data["user_channel"] = _load_csv("Fact_User_Channel.csv")
    _data["user_summary"] = _load_csv("Fact_User_Summary.csv")
    _data["channel_publishing"] = _load_csv("Fact_Channel_Publishing.csv")
    _data["video"] = _load_csv("Fact_Video.csv")
    _data["monthly"] = _load_csv("Fact_Monthly.csv")

    try:
        _data["user_monthly"] = _load_csv("Fact_User_Monthly.csv")
    except Exception:
        _data["user_monthly"] = pd.DataFrame()

    for extra in ["Fact_Input_Type.csv", "Fact_Language.csv", "Fact_Output_Type.csv"]:
        key = extra.replace("Fact_", "").replace(".csv", "").lower()
        try:
            _data[key] = _load_csv(extra)
        except Exception:
            _data[key] = pd.DataFrame()

    _build_user_channel_map()
    _build_enriched_video()
    _data["dbscan"] = _run_dbscan()
    logger.info("Anomaly module data loaded.")


def _build_user_channel_map():
    """Build user → primary channel mapping and proportional channel weights."""
    uc = _data["user_channel"]
    primary = {}
    proportions = {}

    for uid, group in uc.groupby("User_ID"):
        uid = int(uid)
        total = group["Uploaded Count"].sum()
        best_ch = int(group.loc[group["Uploaded Count"].idxmax(), "Channel_ID"])
        primary[uid] = best_ch

        if total > 0:
            proportions[uid] = {
                int(row["Channel_ID"]): row["Uploaded Count"] / total
                for _, row in group.iterrows()
            }
        else:
            n = len(group)
            proportions[uid] = {
                int(row["Channel_ID"]): 1.0 / n for _, row in group.iterrows()
            }

    _data["user_primary_channel"] = primary
    _data["user_channel_proportions"] = proportions


def _build_enriched_video():
    """Create enriched video DataFrame with mapped Channel_ID and InputType_ID."""
    vdf = _data["video"].copy()

    it_name_to_id = {}
    for iid, iname in _data["dims"].get("inputtype", {}).items():
        it_name_to_id[iname.strip().lower()] = iid

    vdf["InputType_ID"] = vdf["Type"].apply(
        lambda t: it_name_to_id.get(str(t).strip().lower(), 0) if pd.notna(t) else 0
    )

    for col in ["User_ID", "Team_ID", "Platform_ID"]:
        vdf[col] = pd.to_numeric(vdf[col], errors="coerce").fillna(0).astype(int)

    primary_ch = _data.get("user_primary_channel", {})
    vdf["Channel_ID"] = vdf["User_ID"].map(primary_ch).fillna(0).astype(int)

    vdf["is_published"] = vdf["Published"].astype(str).str.strip().str.lower() == "yes"

    _data["enriched_video"] = vdf
    logger.info(
        "Enriched video: %d rows, %d with channel, %d with inputtype",
        len(vdf),
        (vdf["Channel_ID"] > 0).sum(),
        (vdf["InputType_ID"] > 0).sum(),
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Dimension config
# ═══════════════════════════════════════════════════════════════════════════════

DIMENSION_META = {
    "user":      {"label": "User",       "id_col": "User_ID",       "dim_key": "user"},
    "channel":   {"label": "Channel",    "id_col": "Channel_ID",    "dim_key": "channel"},
    "platform":  {"label": "Platform",   "id_col": "Platform_ID",   "dim_key": "platform"},
    "team":      {"label": "Team",       "id_col": "Team_ID",       "dim_key": "team"},
    "inputtype": {"label": "Input Type", "id_col": "InputType_ID",  "dim_key": "inputtype"},
    "language":  {"label": "Language",   "id_col": "Language_ID",    "dim_key": "language"},
    "month":     {"label": "Month",      "id_col": "Month_ID",      "dim_key": "month"},
    "outputtype": {"label": "Output Type", "id_col": "OutputType_ID", "dim_key": "outputtype"},
}


def _dim_name(dim_key: str, dim_id: int) -> str:
    return _data["dims"].get(dim_key, {}).get(dim_id, f"Unknown ({dim_id})")


_VIDEO_DIMS = {"user", "channel", "platform", "team", "inputtype"}


# ═══════════════════════════════════════════════════════════════════════════════
#  KPIs
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_kpis() -> dict:
    df = _data["user_summary"]
    up = int(df["Uploaded Count"].sum())
    cr = int(df["Created Count"].sum())
    pb = int(df["Published Count"].sum())
    up_dur = int(df["Uploaded Duration (hh:mm:ss)"].apply(_parse_duration).sum())
    cr_dur = int(df["Created Duration (hh:mm:ss)"].apply(_parse_duration).sum())
    pb_dur = int(df["Published Duration (hh:mm:ss)"].apply(_parse_duration).sum())
    conv = round((pb / cr * 100), 1) if cr > 0 else 0
    return {
        "total_uploaded": up, "total_created": cr, "total_published": pb,
        "upload_duration": _fmt_duration(up_dur),
        "created_duration": _fmt_duration(cr_dur),
        "published_duration": _fmt_duration(pb_dur),
        "conversion_rate": conv,
        "total_users": len(_data["dims"].get("user", {})),
        "total_videos": len(_data["video"]),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix Builder — Router
# ═══════════════════════════════════════════════════════════════════════════════

def _build_matrix(dim1: str, dim2: str, metric_type: str = "count") -> dict:
    pair = frozenset([dim1, dim2])

    if pair == frozenset(["channel", "user"]):
        return _matrix_from_user_channel(dim1, dim2)
    if pair == frozenset(["channel", "platform"]):
        return _matrix_from_channel_publishing(dim1, dim2)
    if pair == frozenset(["user", "month"]):
        return _matrix_from_user_monthly(dim1, dim2)
    if "month" in pair and ("channel" in pair or "user" in pair):
        other = dim1 if dim2 == "month" else dim2
        if other == "channel":
            return _matrix_from_channel_monthly(dim1, dim2)
        return _matrix_from_user_monthly(dim1, dim2)

    if dim1 in _VIDEO_DIMS and dim2 in _VIDEO_DIMS:
        return _matrix_from_enriched_video(dim1, dim2)

    if "language" in pair or "outputtype" in pair:
        return _matrix_from_aggregate_dimension(dim1, dim2)

    if "month" in pair:
        return _matrix_from_month_video(dim1, dim2)

    return _empty_response(dim1, dim2)


def _empty_response(dim1, dim2):
    d1_label = DIMENSION_META.get(dim1, {}).get("label", dim1)
    d2_label = DIMENSION_META.get(dim2, {}).get("label", dim2)
    return {
        "matrix": {}, "row_ids": [], "col_ids": [],
        "row_totals": {}, "col_totals": {},
        "grand_total": _empty_cell(),
        "max_count": 0, "max_duration": 0, "max_conversion": 0,
        "dim1_key": dim1, "dim2_key": dim2,
        "dim_names": {},
        "source_tag": f"No granular data for {d1_label} × {d2_label}",
        "row_count": 0, "col_count": 0,
        "anomalies": {}, "alerts": [],
        "unsupported": True,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix: User × Channel (from Fact_User_Channel)
# ═══════════════════════════════════════════════════════════════════════════════

def _matrix_from_user_channel(dim1, dim2):
    df = _data["user_channel"]

    dim1_col = "User_ID" if dim1 == "user" else "Channel_ID"
    dim2_col = "Channel_ID" if dim1 == "user" else "User_ID"
    dim1_key = "user" if dim1 == "user" else "channel"
    dim2_key = "channel" if dim1 == "user" else "user"

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = _empty_cell()

    for _, r in df.iterrows():
        rid = int(r[dim1_col])
        cid = int(r[dim2_col])

        cnt = int(r.get("Uploaded Count", 0))
        crt = int(r.get("Created Count", 0))
        pub = int(r.get("Published Count", 0))
        dur = _parse_duration(r.get("Uploaded Duration (hh:mm:ss)", "0:00:00"))

        matrix.setdefault(rid, {})
        cell = matrix[rid].setdefault(cid, _empty_cell())
        cell["count"] += cnt; cell["created"] += crt
        cell["published"] += pub; cell["duration"] += dur

        rt = row_totals.setdefault(rid, _empty_cell())
        rt["count"] += cnt; rt["created"] += crt
        rt["published"] += pub; rt["duration"] += dur

        ct = col_totals.setdefault(cid, _empty_cell())
        ct["count"] += cnt; ct["created"] += crt
        ct["published"] += pub; ct["duration"] += dur

        grand["count"] += cnt; grand["created"] += crt
        grand["published"] += pub; grand["duration"] += dur

    return _format_matrix_response(
        matrix, row_totals, col_totals, grand, dim1_key, dim2_key, "Pre-Aggregated"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix: Channel × Platform (from Fact_Channel_Publishing)
# ═══════════════════════════════════════════════════════════════════════════════

def _matrix_from_channel_publishing(dim1, dim2):
    df = _data["channel_publishing"]
    dim1_col = "Channel_ID" if dim1 == "channel" else "Platform_ID"
    dim2_col = "Platform_ID" if dim1 == "channel" else "Channel_ID"

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = _empty_cell()

    for _, r in df.iterrows():
        rid = int(r[dim1_col])
        cid = int(r[dim2_col])
        cnt = int(r.get("Published_Count", 0))
        dur = _parse_duration(r.get("Published_Duration", 0))

        matrix.setdefault(rid, {})
        cell = matrix[rid].setdefault(cid, _empty_cell())
        cell["count"] += cnt; cell["created"] += cnt
        cell["published"] += cnt; cell["duration"] += dur

        rt = row_totals.setdefault(rid, _empty_cell())
        rt["count"] += cnt; rt["created"] += cnt
        rt["published"] += cnt; rt["duration"] += dur

        ct = col_totals.setdefault(cid, _empty_cell())
        ct["count"] += cnt; ct["created"] += cnt
        ct["published"] += cnt; ct["duration"] += dur

        grand["count"] += cnt; grand["created"] += cnt
        grand["published"] += cnt; grand["duration"] += dur

    return _format_matrix_response(
        matrix, row_totals, col_totals, grand, dim1, dim2, "Pre-Aggregated"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix: Video-derived (user, channel, platform, team, inputtype)
# ═══════════════════════════════════════════════════════════════════════════════

def _matrix_from_enriched_video(dim1, dim2):
    vdf = _data.get("enriched_video")
    if vdf is None or vdf.empty:
        return _empty_response(dim1, dim2)

    dim_col = {
        "user": "User_ID", "channel": "Channel_ID",
        "platform": "Platform_ID", "team": "Team_ID",
        "inputtype": "InputType_ID",
    }

    c1, c2 = dim_col.get(dim1), dim_col.get(dim2)
    if not c1 or not c2:
        return _empty_response(dim1, dim2)

    valid = vdf[(vdf[c1] > 0) & (vdf[c2] > 0)].copy()
    if valid.empty:
        return _empty_response(dim1, dim2)

    grouped = valid.groupby([c1, c2]).agg(
        count=("is_published", "size"),
        published=("is_published", "sum"),
    ).reset_index()

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = _empty_cell()

    for _, r in grouped.iterrows():
        rid = int(r[c1])
        cid = int(r[c2])
        cnt = int(r["count"])
        pub = int(r["published"])

        matrix.setdefault(rid, {})
        cell = matrix[rid].setdefault(cid, _empty_cell())
        cell["count"] += cnt; cell["created"] += cnt; cell["published"] += pub

        rt = row_totals.setdefault(rid, _empty_cell())
        rt["count"] += cnt; rt["created"] += cnt; rt["published"] += pub

        ct = col_totals.setdefault(cid, _empty_cell())
        ct["count"] += cnt; ct["created"] += cnt; ct["published"] += pub

        grand["count"] += cnt; grand["created"] += cnt; grand["published"] += pub

    return _format_matrix_response(
        matrix, row_totals, col_totals, grand, dim1, dim2, "Video-Level Aggregation"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix: User × Month (from Fact_User_Monthly)
# ═══════════════════════════════════════════════════════════════════════════════

def _matrix_from_user_monthly(dim1, dim2):
    um = _data.get("user_monthly")
    if um is None or um.empty:
        return _empty_response(dim1, dim2)

    is_user_dim1 = (dim1 == "user")

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = _empty_cell()

    for _, r in um.iterrows():
        uid = int(r["User_ID"])
        mid = int(r["Month_ID"])
        cnt = int(r.get("Uploaded Count", 0))
        crt = int(r.get("Created Count", 0))
        pub = int(r.get("Published Count", 0))
        dur = int(float(r.get("Uploaded Duration", 0)))

        rid = uid if is_user_dim1 else mid
        cid = mid if is_user_dim1 else uid

        matrix.setdefault(rid, {})
        cell = matrix[rid].setdefault(cid, _empty_cell())
        cell["count"] += cnt; cell["created"] += crt
        cell["published"] += pub; cell["duration"] += dur

        rt = row_totals.setdefault(rid, _empty_cell())
        rt["count"] += cnt; rt["created"] += crt
        rt["published"] += pub; rt["duration"] += dur

        ct = col_totals.setdefault(cid, _empty_cell())
        ct["count"] += cnt; ct["created"] += crt
        ct["published"] += pub; ct["duration"] += dur

        grand["count"] += cnt; grand["created"] += crt
        grand["published"] += pub; grand["duration"] += dur

    dim1_key = "user" if is_user_dim1 else "month"
    dim2_key = "month" if is_user_dim1 else "user"
    return _format_matrix_response(
        matrix, row_totals, col_totals, grand, dim1_key, dim2_key, "Monthly"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix: Channel × Month (Fact_User_Monthly + User→Channel proportions)
# ═══════════════════════════════════════════════════════════════════════════════

def _matrix_from_channel_monthly(dim1, dim2):
    um = _data.get("user_monthly")
    if um is None or um.empty:
        return _empty_response(dim1, dim2)

    proportions = _data.get("user_channel_proportions", {})
    is_channel_dim1 = (dim1 == "channel")

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = _empty_cell()

    for _, r in um.iterrows():
        uid = int(r["User_ID"])
        mid = int(r["Month_ID"])
        cnt = int(r.get("Uploaded Count", 0))
        crt = int(r.get("Created Count", 0))
        pub = int(r.get("Published Count", 0))
        dur = int(float(r.get("Uploaded Duration", 0)))

        user_channels = proportions.get(uid, {})
        if not user_channels:
            continue

        for chid, prop in user_channels.items():
            a_cnt = round(cnt * prop)
            a_crt = round(crt * prop)
            a_pub = round(pub * prop)
            a_dur = round(dur * prop)

            rid = chid if is_channel_dim1 else mid
            cid = mid if is_channel_dim1 else chid

            matrix.setdefault(rid, {})
            cell = matrix[rid].setdefault(cid, _empty_cell())
            cell["count"] += a_cnt; cell["created"] += a_crt
            cell["published"] += a_pub; cell["duration"] += a_dur

            rt = row_totals.setdefault(rid, _empty_cell())
            rt["count"] += a_cnt; rt["created"] += a_crt
            rt["published"] += a_pub; rt["duration"] += a_dur

            ct = col_totals.setdefault(cid, _empty_cell())
            ct["count"] += a_cnt; ct["created"] += a_crt
            ct["published"] += a_pub; ct["duration"] += a_dur

            grand["count"] += a_cnt; grand["created"] += a_crt
            grand["published"] += a_pub; grand["duration"] += a_dur

    return _format_matrix_response(
        matrix, row_totals, col_totals, grand, dim1, dim2, "Derived Monthly"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix: Aggregate-only dims (language, outputtype) × any other
#  Uses per-dimension aggregate facts + proportional distribution
# ═══════════════════════════════════════════════════════════════════════════════

def _matrix_from_aggregate_dimension(dim1, dim2):
    """
    For language/outputtype cross-tabs, derive from aggregate fact tables
    combined with the other dimension's breakdown. Counts are distributed
    proportionally (approximate but meaningful).
    """
    agg_dim = dim1 if dim1 in ("language", "outputtype") else dim2
    other_dim = dim2 if agg_dim == dim1 else dim1

    agg_table_map = {"language": "language", "outputtype": "output_type"}
    agg_id_map = {"language": "Language_ID", "outputtype": "OutputType_ID"}

    agg_df = _data.get(agg_table_map.get(agg_dim), pd.DataFrame())
    if agg_df.empty:
        return _empty_response(dim1, dim2)

    agg_id_col = agg_id_map[agg_dim]

    agg_totals = {}
    agg_grand = {"count": 0, "created": 0, "published": 0, "duration": 0}
    for _, r in agg_df.iterrows():
        aid = int(r[agg_id_col])
        cnt = int(r.get("Uploaded Count", 0))
        crt = int(r.get("Created Count", 0))
        pub = int(r.get("Published Count", 0))
        dur = _parse_duration(r.get("Uploaded Duration (hh:mm:ss)", "0:00:00"))
        agg_totals[aid] = {"count": cnt, "created": crt, "published": pub, "duration": dur}
        agg_grand["count"] += cnt
        agg_grand["created"] += crt
        agg_grand["published"] += pub
        agg_grand["duration"] += dur

    other_breakdown = _get_breakdown(other_dim)
    if not other_breakdown:
        return _empty_response(dim1, dim2)

    other_grand_count = sum(b.get("uploaded", 0) for b in other_breakdown)
    if other_grand_count == 0:
        return _empty_response(dim1, dim2)

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = _empty_cell()

    for aid, atotals in agg_totals.items():
        for bitem in other_breakdown:
            bid = bitem["id"]
            b_prop = bitem["uploaded"] / other_grand_count

            a_cnt = round(atotals["count"] * b_prop)
            a_crt = round(atotals["created"] * b_prop)
            a_pub = round(atotals["published"] * b_prop)
            a_dur = round(atotals["duration"] * b_prop)

            if agg_dim == dim1:
                rid, cid = aid, bid
            else:
                rid, cid = bid, aid

            matrix.setdefault(rid, {})
            cell = matrix[rid].setdefault(cid, _empty_cell())
            cell["count"] += a_cnt; cell["created"] += a_crt
            cell["published"] += a_pub; cell["duration"] += a_dur

            rt = row_totals.setdefault(rid, _empty_cell())
            rt["count"] += a_cnt; rt["created"] += a_crt
            rt["published"] += a_pub; rt["duration"] += a_dur

            ct = col_totals.setdefault(cid, _empty_cell())
            ct["count"] += a_cnt; ct["created"] += a_crt
            ct["published"] += a_pub; ct["duration"] += a_dur

            grand["count"] += a_cnt; grand["created"] += a_crt
            grand["published"] += a_pub; grand["duration"] += a_dur

    return _format_matrix_response(
        matrix, row_totals, col_totals, grand, dim1, dim2, "Proportional Estimate"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Matrix: Month × video-derivable dim (platform, team, inputtype)
#  Uses Fact_User_Monthly + enriched video proportions
# ═══════════════════════════════════════════════════════════════════════════════

def _matrix_from_month_video(dim1, dim2):
    """
    For month × platform/team/inputtype: distribute monthly user counts
    across the other dimension proportionally based on video data.
    """
    um = _data.get("user_monthly")
    vdf = _data.get("enriched_video")
    if um is None or um.empty or vdf is None or vdf.empty:
        return _empty_response(dim1, dim2)

    month_dim = "month"
    other_dim = dim1 if dim2 == "month" else dim2

    dim_col = {
        "platform": "Platform_ID", "team": "Team_ID", "inputtype": "InputType_ID",
    }
    other_col = dim_col.get(other_dim)
    if not other_col:
        return _empty_response(dim1, dim2)

    user_dim_props = {}
    for uid, group in vdf[vdf[other_col] > 0].groupby("User_ID"):
        uid = int(uid)
        dim_counts = group[other_col].value_counts()
        total = dim_counts.sum()
        if total > 0:
            user_dim_props[uid] = {int(k): v / total for k, v in dim_counts.items()}

    is_month_dim1 = (dim1 == "month")
    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = _empty_cell()

    for _, r in um.iterrows():
        uid = int(r["User_ID"])
        mid = int(r["Month_ID"])
        cnt = int(r.get("Uploaded Count", 0))
        crt = int(r.get("Created Count", 0))
        pub = int(r.get("Published Count", 0))
        dur = int(float(r.get("Uploaded Duration", 0)))

        props = user_dim_props.get(uid, {})
        if not props:
            continue

        for dim_id, prop in props.items():
            a_cnt = round(cnt * prop)
            a_crt = round(crt * prop)
            a_pub = round(pub * prop)
            a_dur = round(dur * prop)

            rid = mid if is_month_dim1 else dim_id
            cid = dim_id if is_month_dim1 else mid

            matrix.setdefault(rid, {})
            cell = matrix[rid].setdefault(cid, _empty_cell())
            cell["count"] += a_cnt; cell["created"] += a_crt
            cell["published"] += a_pub; cell["duration"] += a_dur

            rt = row_totals.setdefault(rid, _empty_cell())
            rt["count"] += a_cnt; rt["created"] += a_crt
            rt["published"] += a_pub; rt["duration"] += a_dur

            ct = col_totals.setdefault(cid, _empty_cell())
            ct["count"] += a_cnt; ct["created"] += a_crt
            ct["published"] += a_pub; ct["duration"] += a_dur

            grand["count"] += a_cnt; grand["created"] += a_crt
            grand["published"] += a_pub; grand["duration"] += a_dur

    return _format_matrix_response(
        matrix, row_totals, col_totals, grand, dim1, dim2, "Derived Monthly"
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  Format Matrix Response (common)
# ═══════════════════════════════════════════════════════════════════════════════

def _format_matrix_response(matrix, row_totals, col_totals, grand, dim1_key, dim2_key, source_tag):
    for rid in matrix:
        for cid in matrix[rid]:
            _add_conversion(matrix[rid][cid])
    for k in row_totals:
        _add_conversion(row_totals[k])
    for k in col_totals:
        _add_conversion(col_totals[k])
    _add_conversion(grand)

    row_ids = sorted(row_totals.keys(), key=lambda k: -(row_totals[k].get("count", 0)))
    col_ids = set()
    for r in matrix.values():
        col_ids.update(r.keys())
    col_ids = sorted(col_ids, key=lambda k: -(col_totals.get(k, {}).get("count", 0)))

    max_count = 0
    max_duration = 0
    max_conversion = 0.0
    for rid in row_ids:
        for cid in col_ids:
            cell = matrix.get(rid, {}).get(cid)
            if cell:
                max_count = max(max_count, cell.get("count", 0))
                max_duration = max(max_duration, cell.get("duration", 0))
                max_conversion = max(max_conversion, cell.get("conversion", 0.0))

    formatted_matrix = {}
    for rid in row_ids:
        formatted_matrix[str(rid)] = {}
        for cid in col_ids:
            cell = matrix.get(rid, {}).get(cid, _empty_cell())
            formatted_matrix[str(rid)][str(cid)] = {k: _safe(v) for k, v in cell.items()}

    dim_names = {}
    for rid in row_ids:
        dim_names[f"row_{rid}"] = _dim_name(dim1_key, rid)
    for cid in col_ids:
        dim_names[f"col_{cid}"] = _dim_name(dim2_key, cid)

    anomalies, alerts = _detect_anomalies(
        matrix, row_totals, col_totals, row_ids, col_ids, dim1_key, dim2_key
    )

    return {
        "matrix": formatted_matrix,
        "row_ids": [_safe(r) for r in row_ids],
        "col_ids": [_safe(c) for c in col_ids],
        "row_totals": {str(k): {kk: _safe(vv) for kk, vv in v.items()} for k, v in row_totals.items()},
        "col_totals": {str(k): {kk: _safe(vv) for kk, vv in v.items()} for k, v in col_totals.items()},
        "grand_total": {k: _safe(v) for k, v in grand.items()},
        "max_count": _safe(max_count),
        "max_duration": _safe(max_duration),
        "max_conversion": _safe(max_conversion),
        "dim1_key": dim1_key,
        "dim2_key": dim2_key,
        "dim_names": dim_names,
        "source_tag": source_tag,
        "row_count": len(row_ids),
        "col_count": len(col_ids),
        "anomalies": anomalies,
        "alerts": alerts,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Anomaly Detection (z-score)
# ═══════════════════════════════════════════════════════════════════════════════

def _calc_stats(values):
    if not values:
        return {"mean": 0, "std": 0}
    arr = np.array(values, dtype=float)
    mean = float(np.mean(arr))
    std = float(np.std(arr))
    return {"mean": mean, "std": std}


def _detect_anomalies(matrix, row_totals, col_totals, row_ids, col_ids, dim1_key, dim2_key):
    anomalies = {}
    alerts = []

    if len(row_ids) < 2 or len(col_ids) < 2:
        return anomalies, alerts

    all_vals = []
    row_vals = {}
    col_vals_map = {}

    for rid in row_ids:
        row_vals[rid] = []
        for cid in col_ids:
            cell = matrix.get(rid, {}).get(cid, {})
            val = cell.get("count", 0)
            all_vals.append(val)
            row_vals[rid].append(val)
            col_vals_map.setdefault(cid, []).append(val)

    g_stats = _calc_stats(all_vals)
    if g_stats["std"] == 0:
        return anomalies, alerts

    for rid in row_ids:
        r_stats = _calc_stats(row_vals[rid])
        for i, cid in enumerate(col_ids):
            cell = matrix.get(rid, {}).get(cid, {})
            val = cell.get("count", 0)
            key = f"{rid}_{cid}"

            row_z = (val - r_stats["mean"]) / r_stats["std"] if r_stats["std"] > 0 else 0
            global_z = (val - g_stats["mean"]) / g_stats["std"]
            c_stats = _calc_stats(col_vals_map.get(cid, []))
            col_z = (val - c_stats["mean"]) / c_stats["std"] if c_stats["std"] > 0 else 0

            max_z = max(abs(row_z), abs(global_z), abs(col_z))

            if max_z >= 1.5 and val > 0:
                rn = _dim_name(dim1_key, rid)
                cn = _dim_name(dim2_key, cid)

                if global_z >= 2.5:
                    anomalies[key] = {"type": "exceptional", "severity": 4, "z": round(global_z, 1), "icon": "star"}
                    alerts.append({"type": "exceptional", "severity": 4, "icon": "star",
                                   "message": f"{rn} × {cn} is exceptional — {val:,} ({global_z:.1f}σ above average)",
                                   "row_id": _safe(rid), "col_id": _safe(cid)})
                elif global_z >= 1.5:
                    anomalies[key] = {"type": "high", "severity": 3, "z": round(global_z, 1), "icon": "dot_green"}
                    alerts.append({"type": "high", "severity": 3, "icon": "dot_green",
                                   "message": f"{rn} × {cn} is a top performer — {val:,} (+{global_z:.1f}σ)",
                                   "row_id": _safe(rid), "col_id": _safe(cid)})
                elif global_z <= -2.0:
                    anomalies[key] = {"type": "critical_low", "severity": 4, "z": round(global_z, 1), "icon": "dot_red"}
                    alerts.append({"type": "critical_low", "severity": 4, "icon": "dot_red",
                                   "message": f"{rn} × {cn} is critically low — {val:,} ({global_z:.1f}σ below average)",
                                   "row_id": _safe(rid), "col_id": _safe(cid)})
                elif global_z <= -1.5:
                    anomalies[key] = {"type": "low", "severity": 2, "z": round(global_z, 1), "icon": "dot_yellow"}
                    alerts.append({"type": "low", "severity": 2, "icon": "dot_yellow",
                                   "message": f"{rn} × {cn} is unusually low — {val:,} ({abs(global_z):.1f}σ below)",
                                   "row_id": _safe(rid), "col_id": _safe(cid)})

    row_total_vals = [row_totals.get(rid, {}).get("count", 0) for rid in row_ids]
    rt_stats = _calc_stats(row_total_vals)
    if rt_stats["std"] > 0:
        dim_label = DIMENSION_META.get(dim1_key, {}).get("label", dim1_key)
        for idx, rid in enumerate(row_ids):
            val = row_total_vals[idx]
            z = (val - rt_stats["mean"]) / rt_stats["std"]
            name = _dim_name(dim1_key, rid)
            if z >= 2.0:
                alerts.append({"type": "row_high", "severity": 3, "icon": "chart",
                               "message": f"{name} has significantly more activity than other {dim_label}s ({val:,} total, +{z:.1f}σ)",
                               "row_id": _safe(rid)})
            elif z <= -2.0 and val > 0:
                alerts.append({"type": "row_low", "severity": 2, "icon": "chart_down",
                               "message": f"{name} has significantly less activity than other {dim_label}s ({val:,} total, {z:.1f}σ)",
                               "row_id": _safe(rid)})

    alerts.sort(key=lambda a: (-a["severity"], -abs(a.get("z", 0) if "z" in a else 0)))
    return anomalies, alerts


# ═══════════════════════════════════════════════════════════════════════════════
#  DBSCAN Clustering
# ═══════════════════════════════════════════════════════════════════════════════

def _run_dbscan() -> dict:
    df = _data["user_summary"].copy()
    feature_cols = ["Uploaded Count", "Created Count", "Published Count"]

    dur_cols = [
        "Uploaded Duration (hh:mm:ss)",
        "Created Duration (hh:mm:ss)",
        "Published Duration (hh:mm:ss)",
    ]
    for col in dur_cols:
        if col in df.columns:
            new_col = col.replace(" (hh:mm:ss)", "_sec")
            df[new_col] = df[col].apply(_parse_duration)
            feature_cols.append(new_col)

    df["conversion_rate"] = np.where(
        df["Created Count"] > 0, df["Published Count"] / df["Created Count"], 0
    )
    feature_cols.append("conversion_rate")

    X = df[feature_cols].fillna(0).values
    X_scaled = StandardScaler().fit_transform(X)

    dbscan = DBSCAN(eps=1.2, min_samples=2)
    df["cluster"] = dbscan.fit_predict(X_scaled)

    clusters = {}
    for cid in df["cluster"].unique():
        cdf = df[df["cluster"] == cid]
        clusters[int(cid)] = {
            "id": int(cid),
            "label": f"Cluster {cid}" if cid >= 0 else "Outliers",
            "size": int(len(cdf)),
            "is_noise": bool(cid == -1),
            "avg_uploaded": round(float(cdf["Uploaded Count"].mean()), 1),
            "avg_created": round(float(cdf["Created Count"].mean()), 1),
            "avg_published": round(float(cdf["Published Count"].mean()), 1),
            "avg_conversion": round(float(cdf["conversion_rate"].mean() * 100), 2),
        }

    labels = ["Power Users", "Active Users", "Moderate Users", "Light Users", "Minimal Users"]
    sorted_c = sorted(
        [c for c in clusters.values() if not c["is_noise"]], key=lambda x: -x["avg_uploaded"]
    )
    for i, c in enumerate(sorted_c):
        clusters[c["id"]]["label"] = labels[i] if i < len(labels) else f"Group {i+1}"
    if -1 in clusters:
        clusters[-1]["label"] = "Behavioral Outliers"

    user_assignments = []
    for _, row in df.iterrows():
        uid = int(row["User_ID"])
        cl = int(row["cluster"])
        user_assignments.append({
            "user_id": uid,
            "user_name": _dim_name("user", uid),
            "cluster_id": cl,
            "cluster_label": clusters[cl]["label"],
            "is_outlier": bool(cl == -1),
            "uploaded": int(row["Uploaded Count"]),
            "created": int(row["Created Count"]),
            "published": int(row["Published Count"]),
            "conversion_rate": round(float(row["conversion_rate"]) * 100, 2),
        })

    ch_agg = _data["user_channel"].groupby("Channel_ID").agg({
        "Uploaded Count": "sum", "Created Count": "sum", "Published Count": "sum",
    }).reset_index()
    ch_agg["conversion_rate"] = np.where(
        ch_agg["Created Count"] > 0, ch_agg["Published Count"] / ch_agg["Created Count"], 0
    )

    if len(ch_agg) >= 3:
        X_ch = ch_agg[["Uploaded Count", "Created Count", "Published Count", "conversion_rate"]].values
        ch_agg["cluster"] = DBSCAN(eps=1.5, min_samples=2).fit_predict(
            StandardScaler().fit_transform(X_ch)
        )
    else:
        ch_agg["cluster"] = 0

    channel_assignments = []
    for _, row in ch_agg.iterrows():
        chid = int(row["Channel_ID"])
        channel_assignments.append({
            "channel_id": chid,
            "channel_name": _dim_name("channel", chid),
            "cluster_id": int(row["cluster"]),
            "is_outlier": bool(int(row["cluster"]) == -1),
            "uploaded": int(row["Uploaded Count"]),
            "created": int(row["Created Count"]),
            "published": int(row["Published Count"]),
        })

    summary = {
        "model": "DBSCAN",
        "user_clusters": len([c for c in clusters.values() if not c["is_noise"]]),
        "user_outliers": clusters.get(-1, {}).get("size", 0),
        "total_users": len(df),
        "parameters": {"eps": 1.2, "min_samples": 2, "features_used": feature_cols},
    }

    return {
        "clusters": {str(k): v for k, v in clusters.items()},
        "user_assignments": user_assignments,
        "channel_assignments": channel_assignments,
        "summary": summary,
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Breakdown (extended for all dimensions)
# ═══════════════════════════════════════════════════════════════════════════════

def _get_breakdown(dim_key: str) -> list:
    if dim_key == "user":
        df = _data["user_summary"]
        rows = []
        for _, r in df.iterrows():
            uid = int(r["User_ID"])
            up = int(r["Uploaded Count"])
            cr = int(r["Created Count"])
            pb = int(r["Published Count"])
            conv = round(pb / cr * 100, 1) if cr > 0 else 0
            rows.append({
                "id": uid, "name": _dim_name("user", uid),
                "uploaded": up, "created": cr, "published": pb, "conversion": conv,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    if dim_key == "channel":
        df = _data["user_channel"].groupby("Channel_ID").agg({
            "Uploaded Count": "sum", "Created Count": "sum", "Published Count": "sum",
        }).reset_index()
        rows = []
        for _, r in df.iterrows():
            cid = int(r["Channel_ID"])
            up = int(r["Uploaded Count"])
            cr = int(r["Created Count"])
            pb = int(r["Published Count"])
            conv = round(pb / cr * 100, 1) if cr > 0 else 0
            rows.append({
                "id": cid, "name": _dim_name("channel", cid),
                "uploaded": up, "created": cr, "published": pb, "conversion": conv,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    if dim_key == "inputtype":
        df = _data.get("input_type", pd.DataFrame())
        if df.empty:
            return []
        rows = []
        for _, r in df.iterrows():
            iid = int(r["InputType_ID"])
            up = int(r.get("Uploaded Count", 0))
            cr = int(r.get("Created Count", 0))
            pb = int(r.get("Published Count", 0))
            conv = round(pb / cr * 100, 1) if cr > 0 else 0
            rows.append({
                "id": iid, "name": _dim_name("inputtype", iid),
                "uploaded": up, "created": cr, "published": pb, "conversion": conv,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    if dim_key == "platform":
        df = _data["channel_publishing"].groupby("Platform_ID").agg({
            "Published_Count": "sum",
        }).reset_index()
        rows = []
        for _, r in df.iterrows():
            pid = int(r["Platform_ID"])
            pub = int(r["Published_Count"])
            rows.append({
                "id": pid, "name": _dim_name("platform", pid),
                "uploaded": pub, "created": pub, "published": pub, "conversion": 100.0,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    if dim_key == "language":
        df = _data.get("language", pd.DataFrame())
        if df.empty:
            return []
        rows = []
        for _, r in df.iterrows():
            lid = int(r["Language_ID"])
            up = int(r.get("Uploaded Count", 0))
            cr = int(r.get("Created Count", 0))
            pb = int(r.get("Published Count", 0))
            conv = round(pb / cr * 100, 1) if cr > 0 else 0
            rows.append({
                "id": lid, "name": _dim_name("language", lid),
                "uploaded": up, "created": cr, "published": pb, "conversion": conv,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    if dim_key == "month":
        df = _data["monthly"]
        rows = []
        for _, r in df.iterrows():
            mid = int(r["Month_ID"])
            up = int(r.get("Total Uploaded", 0))
            cr = int(r.get("Total Created", 0))
            pb = int(r.get("Total Published", 0))
            conv = round(pb / cr * 100, 1) if cr > 0 else 0
            rows.append({
                "id": mid, "name": _dim_name("month", mid),
                "uploaded": up, "created": cr, "published": pb, "conversion": conv,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    if dim_key == "outputtype":
        df = _data.get("output_type", pd.DataFrame())
        if df.empty:
            return []
        rows = []
        for _, r in df.iterrows():
            oid = int(r["OutputType_ID"])
            up = int(r.get("Uploaded Count", 0))
            cr = int(r.get("Created Count", 0))
            pb = int(r.get("Published Count", 0))
            conv = round(pb / cr * 100, 1) if cr > 0 else 0
            rows.append({
                "id": oid, "name": _dim_name("outputtype", oid),
                "uploaded": up, "created": cr, "published": pb, "conversion": conv,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    if dim_key == "team":
        vdf = _data.get("enriched_video", pd.DataFrame())
        if vdf.empty:
            return []
        grouped = vdf[vdf["Team_ID"] > 0].groupby("Team_ID").agg(
            count=("is_published", "size"),
            published=("is_published", "sum"),
        ).reset_index()
        rows = []
        for _, r in grouped.iterrows():
            tid = int(r["Team_ID"])
            cnt = int(r["count"])
            pub = int(r["published"])
            conv = round(pub / cnt * 100, 1) if cnt > 0 else 0
            rows.append({
                "id": tid, "name": _dim_name("team", tid),
                "uploaded": cnt, "created": cnt, "published": pub, "conversion": conv,
            })
        return sorted(rows, key=lambda x: -x["uploaded"])

    return []


# ═══════════════════════════════════════════════════════════════════════════════
#  Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/dimensions")
def get_dimensions():
    return {
        "dimensions": [
            {"key": k, "label": v["label"]}
            for k, v in DIMENSION_META.items()
        ],
        "metric_types": ["count", "duration", "conversion"],
    }


@router.get("/kpis")
def get_kpis():
    return _compute_kpis()


@router.get("/matrix")
def get_matrix(
    dim1: str = Query("channel", description="Row dimension"),
    dim2: str = Query("user", description="Column dimension"),
    metric: str = Query("count", description="Metric type: count, duration, conversion"),
):
    return _build_matrix(dim1, dim2, metric)


@router.get("/clusters")
def get_clusters():
    return _data.get("dbscan", {})


@router.get("/breakdown")
def get_breakdown(dim: str = Query("user")):
    return {"dimension": dim, "items": _get_breakdown(dim)}
