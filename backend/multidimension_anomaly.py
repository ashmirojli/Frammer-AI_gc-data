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
from typing import Any, Dict, List, Optional
from functools import lru_cache

import pandas as pd
import numpy as np
from fastapi import APIRouter, Query
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger("anomaly")

router = APIRouter(prefix="/api/anomaly", tags=["Multidimension & Anomaly"])

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "StarSchemaDB")

# ═══════════════════════════════════════════════════════════════════════════════
#  Data Loading
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

    for extra in ["Fact_Input_Type.csv", "Fact_Language.csv", "Fact_Output_Type.csv"]:
        key = extra.replace("Fact_", "").replace(".csv", "").lower()
        try:
            _data[key] = _load_csv(extra)
        except Exception:
            _data[key] = pd.DataFrame()

    _data["dbscan"] = _run_dbscan()
    logger.info("Anomaly module data loaded.")


# ═══════════════════════════════════════════════════════════════════════════════
#  Dimension config
# ═══════════════════════════════════════════════════════════════════════════════

DIMENSION_META = {
    "user":     {"label": "User",     "id_col": "User_ID",       "dim_key": "user"},
    "channel":  {"label": "Channel",  "id_col": "Channel_ID",    "dim_key": "channel"},
    "platform": {"label": "Platform", "id_col": "Platform_ID",   "dim_key": "platform"},
    "team":     {"label": "Team",     "id_col": "Team_ID",       "dim_key": "team"},
    "inputtype":{"label": "Input Type","id_col": "InputType_ID", "dim_key": "inputtype"},
    "language": {"label": "Language", "id_col": "Language_ID",    "dim_key": "language"},
    "month":    {"label": "Month",    "id_col": "Month_ID",      "dim_key": "month"},
    "outputtype":{"label": "Output Type","id_col":"OutputType_ID","dim_key": "outputtype"},
}


def _dim_name(dim_key: str, dim_id: int) -> str:
    return _data["dims"].get(dim_key, {}).get(dim_id, f"Unknown ({dim_id})")


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
#  Matrix Builder
# ═══════════════════════════════════════════════════════════════════════════════

def _build_matrix(dim1: str, dim2: str, metric_type: str = "count") -> dict:
    """Build cross-tab matrix from Fact_User_Channel (user×channel) or Fact_Video."""
    pair = tuple(sorted([dim1, dim2]))

    if pair == ("channel", "user"):
        return _matrix_from_user_channel(dim1, dim2, metric_type)
    if pair == ("channel", "platform"):
        return _matrix_from_channel_publishing(dim1, dim2)
    return _matrix_from_video(dim1, dim2)


def _matrix_from_user_channel(dim1, dim2, metric_type):
    df = _data["user_channel"]
    col_map = {
        "count": ("Uploaded Count", "Uploaded Duration (hh:mm:ss)"),
        "created": ("Created Count", "Created Duration (hh:mm:ss)"),
        "published": ("Published Count", "Published Duration (hh:mm:ss)"),
    }
    count_col, dur_col = col_map.get(metric_type, col_map["count"])

    dim1_col = "User_ID" if dim1 == "user" else "Channel_ID"
    dim2_col = "Channel_ID" if dim1 == "user" else "User_ID"
    dim1_key = "user" if dim1 == "user" else "channel"
    dim2_key = "channel" if dim1 == "user" else "user"

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = {"count": 0, "duration": 0, "published": 0}

    for _, r in df.iterrows():
        rid = int(r[dim1_col])
        cid = int(r[dim2_col])
        cnt = int(r[count_col]) if count_col in r else 0
        dur = _parse_duration(r.get(dur_col, 0))
        pub = int(r.get("Published Count", 0))

        matrix.setdefault(rid, {})
        cell = matrix[rid].setdefault(cid, {"count": 0, "duration": 0, "published": 0})
        cell["count"] += cnt
        cell["duration"] += dur
        cell["published"] += pub

        rt = row_totals.setdefault(rid, {"count": 0, "duration": 0, "published": 0})
        rt["count"] += cnt; rt["duration"] += dur; rt["published"] += pub

        ct = col_totals.setdefault(cid, {"count": 0, "duration": 0, "published": 0})
        ct["count"] += cnt; ct["duration"] += dur; ct["published"] += pub

        grand["count"] += cnt; grand["duration"] += dur; grand["published"] += pub

    return _format_matrix_response(matrix, row_totals, col_totals, grand, dim1_key, dim2_key, "Pre-Aggregated")


def _matrix_from_channel_publishing(dim1, dim2):
    df = _data["channel_publishing"]
    dim1_col = "Channel_ID" if dim1 == "channel" else "Platform_ID"
    dim2_col = "Platform_ID" if dim1 == "channel" else "Channel_ID"
    dim1_key = dim1
    dim2_key = dim2

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = {"count": 0, "duration": 0, "published": 0}

    for _, r in df.iterrows():
        rid = int(r[dim1_col])
        cid = int(r[dim2_col])
        cnt = int(r.get("Published_Count", 0))
        dur = _parse_duration(r.get("Published_Duration", 0))

        matrix.setdefault(rid, {})
        cell = matrix[rid].setdefault(cid, {"count": 0, "duration": 0, "published": 0})
        cell["count"] += cnt; cell["duration"] += dur; cell["published"] += cnt

        rt = row_totals.setdefault(rid, {"count": 0, "duration": 0, "published": 0})
        rt["count"] += cnt; rt["duration"] += dur; rt["published"] += cnt

        ct = col_totals.setdefault(cid, {"count": 0, "duration": 0, "published": 0})
        ct["count"] += cnt; ct["duration"] += dur; ct["published"] += cnt

        grand["count"] += cnt; grand["duration"] += dur; grand["published"] += cnt

    return _format_matrix_response(matrix, row_totals, col_totals, grand, dim1_key, dim2_key, "Pre-Aggregated")


def _matrix_from_video(dim1, dim2):
    df = _data["video"]
    vid_dim_map = {
        "user": "User_ID", "channel": None, "platform": "Platform_ID",
        "team": "Team_ID",
    }

    uc = _data["user_channel"]
    user_channel_map = {}
    for _, r in uc.iterrows():
        uid = int(r["User_ID"])
        cid = int(r["Channel_ID"])
        user_channel_map.setdefault(uid, []).append(cid)
    user_ch_idx = {}

    matrix = {}
    row_totals = {}
    col_totals = {}
    grand = {"count": 0, "published": 0}

    for _, r in df.iterrows():
        uid = int(r.get("User_ID", 0)) if not pd.isna(r.get("User_ID")) else 0
        pub = str(r.get("Published", "")).strip().lower() == "yes"

        vid_dims = {
            "user": uid,
            "platform": int(float(r.get("Platform_ID", 0))) if not pd.isna(r.get("Platform_ID")) else 0,
            "team": int(r.get("Team_ID", 0)) if not pd.isna(r.get("Team_ID")) else 0,
        }

        if uid in user_channel_map and user_channel_map[uid]:
            idx = user_ch_idx.get(uid, 0)
            vid_dims["channel"] = user_channel_map[uid][idx % len(user_channel_map[uid])]
            user_ch_idx[uid] = idx + 1
        else:
            vid_dims["channel"] = 0

        rid = vid_dims.get(dim1, 0)
        cid = vid_dims.get(dim2, 0)
        if not rid or not cid:
            continue

        matrix.setdefault(rid, {})
        cell = matrix[rid].setdefault(cid, {"count": 0, "published": 0})
        cell["count"] += 1
        if pub:
            cell["published"] += 1

        rt = row_totals.setdefault(rid, {"count": 0, "published": 0})
        rt["count"] += 1
        if pub:
            rt["published"] += 1

        ct = col_totals.setdefault(cid, {"count": 0, "published": 0})
        ct["count"] += 1
        if pub:
            ct["published"] += 1

        grand["count"] += 1
        if pub:
            grand["published"] += 1

    return _format_matrix_response(matrix, row_totals, col_totals, grand, dim1, dim2, "Video-Level Aggregation")


def _format_matrix_response(matrix, row_totals, col_totals, grand, dim1_key, dim2_key, source_tag):
    row_ids = sorted(row_totals.keys(), key=lambda k: -(row_totals[k].get("count", 0)))
    col_ids = set()
    for r in matrix.values():
        col_ids.update(r.keys())
    col_ids = sorted(col_ids, key=lambda k: -(col_totals.get(k, {}).get("count", 0)))

    max_val = 0
    for rid in row_ids:
        for cid in col_ids:
            cell = matrix.get(rid, {}).get(cid)
            if cell:
                max_val = max(max_val, cell.get("count", 0))

    formatted_matrix = {}
    for rid in row_ids:
        formatted_matrix[str(rid)] = {}
        for cid in col_ids:
            cell = matrix.get(rid, {}).get(cid, {"count": 0, "published": 0})
            formatted_matrix[str(rid)][str(cid)] = {k: _safe(v) for k, v in cell.items()}

    anomalies, alerts = _detect_anomalies(matrix, row_totals, col_totals, row_ids, col_ids, dim1_key, dim2_key)

    return {
        "matrix": formatted_matrix,
        "row_ids": [_safe(r) for r in row_ids],
        "col_ids": [_safe(c) for c in col_ids],
        "row_totals": {str(k): {kk: _safe(vv) for kk, vv in v.items()} for k, v in row_totals.items()},
        "col_totals": {str(k): {kk: _safe(vv) for kk, vv in v.items()} for k, v in col_totals.items()},
        "grand_total": {k: _safe(v) for k, v in grand.items()},
        "max_val": _safe(max_val),
        "dim1_key": dim1_key,
        "dim2_key": dim2_key,
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

    # Row-level anomalies
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

    df["conversion_rate"] = np.where(df["Created Count"] > 0, df["Published Count"] / df["Created Count"], 0)
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
    sorted_c = sorted([c for c in clusters.values() if not c["is_noise"]], key=lambda x: -x["avg_uploaded"])
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

    # Channel clustering
    ch_agg = _data["user_channel"].groupby("Channel_ID").agg({
        "Uploaded Count": "sum", "Created Count": "sum", "Published Count": "sum",
    }).reset_index()
    ch_agg["conversion_rate"] = np.where(ch_agg["Created Count"] > 0, ch_agg["Published Count"] / ch_agg["Created Count"], 0)

    if len(ch_agg) >= 3:
        X_ch = ch_agg[["Uploaded Count", "Created Count", "Published Count", "conversion_rate"]].values
        ch_agg["cluster"] = DBSCAN(eps=1.5, min_samples=2).fit_predict(StandardScaler().fit_transform(X_ch))
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
#  Breakdown
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
            rows.append({"id": uid, "name": _dim_name("user", uid),
                         "uploaded": up, "created": cr, "published": pb, "conversion": conv})
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
            rows.append({"id": cid, "name": _dim_name("channel", cid),
                         "uploaded": up, "created": cr, "published": pb, "conversion": conv})
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
    metric: str = Query("count", description="Metric type: count, created, published"),
):
    return _build_matrix(dim1, dim2, metric)


@router.get("/clusters")
def get_clusters():
    return _data.get("dbscan", {})


@router.get("/breakdown")
def get_breakdown(dim: str = Query("user")):
    return {"dimension": dim, "items": _get_breakdown(dim)}
