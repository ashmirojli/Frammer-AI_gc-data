"""
tab1_analytics.py
-----------------
FastAPI router that loads StarSchemaDB CSV files and computes all KPIs,
charts, and data panels for the Tab 1 "Analytics Overview" dashboard.

Endpoints (all GET, prefix /api/tab1):
  /kpis             – Top 10 KPI cards with MoM deltas
  /trend            – Monthly trend (uploaded, created, published)
  /funnel           – Publishing funnel totals
  /input-breakdown  – Input-type donut + table
  /output-breakdown – Output-type donut + table
  /platform-ranking – Platform ranking by published count
  /top-channels     – Top channels by published count
  /language         – Language analysis
  /users            – User activity summary + top 10
  /alerts           – Auto-generated system alerts
"""

from __future__ import annotations

import logging
import os
import pathlib

import numpy as np
import pandas as pd
from fastapi import APIRouter

logger = logging.getLogger("tab1")

router = APIRouter(prefix="/api/tab1", tags=["Tab 1 – Analytics Overview"])

_DATA: dict = {}

PALETTE = [
    "#ff4d6d", "#fbbf24", "#3b82f6", "#a855f7",
    "#f97316", "#10b981", "#2dd4bf", "#818cf8",
    "#f472b6", "#ef4444", "#14b8a6", "#eab308",
]

MONTH_ORDER = {
    "Mar, 2025": 1, "Apr, 2025": 2, "May, 2025": 3,
    "Jun, 2025": 4, "Jul, 2025": 5, "Aug, 2025": 6,
    "Sep, 2025": 7, "Oct, 2025": 8, "Nov, 2025": 9,
    "Dec, 2025": 10, "Jan, 2026": 11, "Feb, 2026": 12,
}


def _dur_to_min(s) -> float:
    try:
        parts = str(s).strip().split(":")
        if len(parts) == 3:
            return int(parts[0]) * 60 + int(parts[1]) + int(parts[2]) / 60
        return 0.0
    except Exception:
        return 0.0


def _fmt_duration_hm(total_min: float) -> str:
    h = int(total_min // 60)
    m = int(round(total_min % 60))
    return f"{h:,}h {m:02d}m"


def _pct_change(cur, prv):
    if prv == 0:
        return cur, "+∞%", "up" if cur > 0 else "flat"
    delta = cur - prv
    pct = (delta / prv) * 100
    sign = "+" if pct >= 0 else ""
    direction = "up" if pct >= 0 else "down"
    return delta, f"{sign}{pct:.1f}%", direction


def _safe_int(v, default=0):
    try:
        return int(v)
    except (ValueError, TypeError):
        return default


# ─────────────────────────────────────────────────────────────────────────────
#  Data loading
# ─────────────────────────────────────────────────────────────────────────────

def load_tab1_data():
    global _DATA

    base = pathlib.Path(os.path.dirname(os.path.abspath(__file__))).parent / "StarSchemaDB"

    dim_channel = pd.read_csv(base / "Dim_Channel.csv")
    dim_platform = pd.read_csv(base / "Dim_Platform.csv")
    dim_month = pd.read_csv(base / "Dim_Month.csv")
    dim_language = pd.read_csv(base / "Dim_Language.csv")
    dim_input = pd.read_csv(base / "Dim_Input_Type.csv")
    dim_output = pd.read_csv(base / "Dim_Output_Type.csv")
    dim_user = pd.read_csv(base / "Dim_User.csv")

    fact_monthly = pd.read_csv(base / "Fact_Monthly.csv")
    fact_video = pd.read_csv(base / "Fact_Video.csv")
    fact_user_sum = pd.read_csv(base / "Fact_User_Summary.csv")
    fact_user_chan = pd.read_csv(base / "Fact_User_Channel.csv")
    fact_output_t = pd.read_csv(base / "Fact_Output_Type.csv")
    fact_language = pd.read_csv(base / "Fact_Language.csv")
    fact_input_t = pd.read_csv(base / "Fact_Input_Type.csv")
    fact_chan_pub = pd.read_csv(base / "Fact_Channel_Publishing.csv")

    dim_month["Sort_Order"] = dim_month["Month_Name"].map(MONTH_ORDER)
    dim_month = dim_month.sort_values("Sort_Order").reset_index(drop=True)

    monthly = (
        fact_monthly.merge(dim_month, on="Month_ID")
        .sort_values("Sort_Order")
        .reset_index(drop=True)
    )
    monthly.rename(columns={
        "Total Uploaded": "Uploaded",
        "Total Created": "Created",
        "Total Published": "Published",
    }, inplace=True)

    for col in ["Total Uploaded Duration", "Total Created Duration", "Total Published Duration"]:
        if col in monthly.columns:
            monthly[col + "_min"] = monthly[col].apply(_dur_to_min)

    _DATA = {
        "dim_channel": dim_channel,
        "dim_platform": dim_platform,
        "dim_month": dim_month,
        "dim_language": dim_language,
        "dim_input": dim_input,
        "dim_output": dim_output,
        "dim_user": dim_user,
        "monthly": monthly,
        "fact_video": fact_video,
        "fact_user_sum": fact_user_sum,
        "fact_user_chan": fact_user_chan,
        "fact_output_t": fact_output_t,
        "fact_language": fact_language,
        "fact_input_t": fact_input_t,
        "fact_chan_pub": fact_chan_pub,
    }
    logger.info("Tab 1 data loaded – %d monthly rows, %d videos", len(monthly), len(fact_video))


# ─────────────────────────────────────────────────────────────────────────────
#  Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/kpis")
def get_kpis():
    m = _DATA["monthly"]
    cur = m.iloc[-1]
    prv = m.iloc[-2]
    cur_name = cur["Month_Name"]

    tot_uploaded = int(m["Uploaded"].sum())
    tot_created = int(m["Created"].sum())
    tot_published = int(m["Published"].sum())

    kpi1_cur, kpi1_prv = int(cur["Uploaded"]), int(prv["Uploaded"])
    _, kpi1_pct, kpi1_dir = _pct_change(kpi1_cur, kpi1_prv)

    kpi2_cur, kpi2_prv = int(cur["Created"]), int(prv["Created"])
    _, kpi2_pct, kpi2_dir = _pct_change(kpi2_cur, kpi2_prv)

    kpi3_cur, kpi3_prv = int(cur["Published"]), int(prv["Published"])
    _, kpi3_pct, kpi3_dir = _pct_change(kpi3_cur, kpi3_prv)

    kpi4_cur = round((kpi3_cur / kpi2_cur * 100) if kpi2_cur else 0, 2)
    kpi4_prv = round((kpi3_prv / kpi2_prv * 100) if kpi2_prv else 0, 2)
    _, kpi4_pct, kpi4_dir = _pct_change(kpi4_cur, kpi4_prv)

    kpi5_cur = round(kpi2_cur / kpi1_cur, 2) if kpi1_cur else 0
    kpi5_prv = round(kpi2_prv / kpi1_prv, 2) if kpi1_prv else 0
    _, kpi5_pct, kpi5_dir = _pct_change(kpi5_cur, kpi5_prv)

    kpi6_cur = round(((kpi2_cur - kpi3_cur) / kpi2_cur * 100) if kpi2_cur else 0, 2)
    kpi6_prv = round(((kpi2_prv - kpi3_prv) / kpi2_prv * 100) if kpi2_prv else 0, 2)
    _, kpi6_pct, kpi6_dir = _pct_change(kpi6_cur, kpi6_prv)

    fus = _DATA["fact_user_sum"]
    active_users = int(fus[fus["Uploaded Count"] > 0]["User_ID"].nunique())
    total_users = int(_DATA["dim_user"]["User_ID"].nunique())

    kpi8_cur = round(tot_uploaded / active_users, 1) if active_users else 0

    kpi9_cur = round((kpi3_cur / kpi1_cur * 100) if kpi1_cur else 0, 2)
    kpi9_prv = round((kpi3_prv / kpi1_prv * 100) if kpi1_prv else 0, 2)
    _, kpi9_pct, kpi9_dir = _pct_change(kpi9_cur, kpi9_prv)

    all_time_pub_rate = round((tot_published / tot_uploaded * 100) if tot_uploaded else 0, 2)

    kpis = [
        {
            "label": "Total Upload Volume",
            "value": f"{kpi1_cur:,}",
            "subtext": cur_name,
            "trend": kpi1_pct,
            "trendLabel": "vs prev",
            "type": kpi1_dir,
        },
        {
            "label": "AI Content Created",
            "value": f"{kpi2_cur:,}",
            "subtext": cur_name,
            "trend": kpi2_pct,
            "trendLabel": "vs prev",
            "type": kpi2_dir,
        },
        {
            "label": "Total Published Outputs",
            "value": f"{kpi3_cur:,}",
            "subtext": cur_name,
            "trend": kpi3_pct,
            "trendLabel": "vs prev",
            "type": kpi3_dir,
        },
        {
            "label": "Editorial Yield %",
            "value": f"{kpi4_cur}%",
            "subtext": "Published / Created",
            "trend": kpi4_pct,
            "trendLabel": "vs prev",
            "type": kpi4_dir,
        },
        {
            "label": "Content Expansion Factor",
            "value": f"{kpi5_cur}x",
            "subtext": f"Created / Uploaded · {cur_name.split(',')[0]}",
            "trend": kpi5_pct,
            "trendLabel": "vs prev",
            "type": kpi5_dir,
        },
        {
            "label": "Orphan Content Rate",
            "value": f"{kpi6_cur}%",
            "subtext": f"AI outputs unpublished · {cur_name.split(',')[0]}",
            "trend": "CRITICAL" if kpi6_cur > 90 else kpi6_pct,
            "trendLabel": "" if kpi6_cur > 90 else "vs prev",
            "type": "critical" if kpi6_cur > 90 else ("down" if kpi6_dir == "up" else "up"),
        },
        {
            "label": "Active Users",
            "value": str(active_users),
            "subtext": f"of {total_users} total registered",
            "trend": f"- {round(active_users / total_users * 100, 1)}%",
            "trendLabel": "active rate",
            "type": "neutral",
        },
        {
            "label": "Avg Uploads / Active User",
            "value": str(kpi8_cur),
            "subtext": "all-time average",
            "trend": "- All-time",
            "trendLabel": "",
            "type": "neutral",
        },
        {
            "label": "Publish Rate",
            "value": f"{kpi9_cur}%",
            "subtext": f"Published / Uploaded · {cur_name.split(',')[0]}",
            "trend": kpi9_pct,
            "trendLabel": "vs prev",
            "type": kpi9_dir,
        },
        {
            "label": "All-Time Publish Rate",
            "value": f"{all_time_pub_rate}%",
            "subtext": f"{tot_published:,} published / {tot_uploaded:,} uploaded",
            "trend": "- All-time",
            "trendLabel": "",
            "type": "neutral",
        },
    ]
    return kpis


@router.get("/trend")
def get_trend():
    m = _DATA["monthly"]
    result = []
    for _, row in m.iterrows():
        short_month = str(row["Month_Name"]).split(",")[0]
        result.append({
            "month": short_month,
            "uploaded": int(row["Uploaded"]),
            "created": int(row["Created"]),
            "published": int(row["Published"]),
        })
    return result


@router.get("/funnel")
def get_funnel():
    m = _DATA["monthly"]
    tot_up = int(m["Uploaded"].sum())
    tot_cr = int(m["Created"].sum())
    tot_pub = int(m["Published"].sum())
    pub_rate = round((tot_pub / tot_up * 100) if tot_up else 0, 2)

    resp: dict = {
        "Uploaded": f"{tot_up:,}",
        "Created": f"{tot_cr:,}",
        "Published": f"{tot_pub:,}",
        "Publish Rate (%)": f"{pub_rate}%",
    }

    up_dur_col = "Total Uploaded Duration_min"
    cr_dur_col = "Total Created Duration_min"
    pub_dur_col = "Total Published Duration_min"
    if up_dur_col in m.columns:
        up_min = m[up_dur_col].sum()
        cr_min = m[cr_dur_col].sum()
        pub_min = m[pub_dur_col].sum()
        dur_rate = round((pub_min / up_min * 100) if up_min else 0, 2)
        resp["Uploaded_Duration"] = _fmt_duration_hm(up_min)
        resp["Created_Duration"] = _fmt_duration_hm(cr_min)
        resp["Published_Duration"] = _fmt_duration_hm(pub_min)
        resp["Duration_Rate"] = f"{dur_rate}%"

    return resp


@router.get("/input-breakdown")
def get_input_breakdown():
    fact_in = _DATA["fact_input_t"].merge(_DATA["dim_input"], on="InputType_ID")
    fact_in["Publish_Rate"] = (
        fact_in["Published Count"] /
        fact_in["Created Count"].replace(0, np.nan) * 100
    ).round(2).fillna(0)
    fact_in = fact_in.sort_values("Uploaded Count", ascending=False).reset_index(drop=True)

    result = []
    for i, (_, row) in enumerate(fact_in.iterrows()):
        result.append({
            "type": row["Input_Type_Name"],
            "uploaded": int(row["Uploaded Count"]),
            "created": int(row["Created Count"]),
            "published": int(row["Published Count"]),
            "rate": f"{row['Publish_Rate']:.2f}%",
            "color": PALETTE[i % len(PALETTE)],
        })
    return result


@router.get("/output-breakdown")
def get_output_breakdown():
    fact_out = _DATA["fact_output_t"].merge(_DATA["dim_output"], on="OutputType_ID")
    fact_out["Publish_Rate"] = (
        fact_out["Published Count"] /
        fact_out["Created Count"].replace(0, np.nan) * 100
    ).round(2).fillna(0)
    fact_out = fact_out.sort_values("Created Count", ascending=False).reset_index(drop=True)

    result = []
    for i, (_, row) in enumerate(fact_out.iterrows()):
        result.append({
            "type": row["Output_Type_Name"],
            "created": int(row["Created Count"]),
            "published": int(row["Published Count"]),
            "rate": f"{row['Publish_Rate']:.2f}%",
            "color": PALETTE[i % len(PALETTE)],
        })
    return result


@router.get("/platform-ranking")
def get_platform_ranking():
    chan_pub = _DATA["fact_chan_pub"].merge(_DATA["dim_platform"], on="Platform_ID")
    plat_grp = (
        chan_pub.groupby("Platform_Name")["Published_Count"]
        .sum()
        .reset_index()
        .sort_values("Published_Count", ascending=False)
        .reset_index(drop=True)
    )

    n = len(plat_grp)
    result = []
    for i, (_, row) in enumerate(plat_grp.iterrows()):
        if i == 0:
            color = "#00c864"
        elif i == n - 1:
            color = "#333" if row["Published_Count"] == 0 else "#ff4d6d"
        elif row["Published_Count"] == 0:
            color = "#333"
        else:
            color = PALETTE[i % len(PALETTE)]
        result.append({
            "name": row["Platform_Name"],
            "value": int(row["Published_Count"]),
            "color": color,
        })
    return result


@router.get("/top-channels")
def get_top_channels():
    chan_pub = _DATA["fact_chan_pub"].merge(_DATA["dim_channel"], on="Channel_ID")
    chan_total = (
        chan_pub.groupby(["Channel_ID", "Channel_Name"])["Published_Count"]
        .sum()
        .reset_index()
        .sort_values("Published_Count", ascending=False)
    )

    total_published = int(chan_total["Published_Count"].sum())
    active_channels = int((chan_total["Published_Count"] > 0).sum())
    total_channels = int(_DATA["dim_channel"]["Channel_ID"].nunique())

    top = chan_total.head(8)
    top_channel_val = int(top.iloc[0]["Published_Count"]) if len(top) > 0 else 0
    top_share = round((top_channel_val / total_published * 100) if total_published else 0, 1)

    channels = []
    for _, row in top.iterrows():
        channels.append({
            "name": f"Channel {row['Channel_Name']}",
            "value": int(row["Published_Count"]),
        })

    return {
        "channels": channels,
        "activeChannels": active_channels,
        "totalChannels": total_channels,
        "totalPublished": total_published,
        "topChannelShare": f"{top_share}%",
    }


@router.get("/language")
def get_language():
    fact_lang = _DATA["fact_language"].merge(_DATA["dim_language"], on="Language_ID")
    fact_lang["Publish_Rate"] = (
        fact_lang["Published Count"] /
        fact_lang["Uploaded Count"].replace(0, np.nan) * 100
    ).round(2).fillna(0)

    best_idx = fact_lang["Publish_Rate"].idxmax()
    best_lang = fact_lang.loc[best_idx, "Language_Name"]
    best_uploads = int(fact_lang.loc[best_idx, "Uploaded Count"])
    best_published = int(fact_lang.loc[best_idx, "Published Count"])

    languages = []
    for _, row in fact_lang.iterrows():
        languages.append({
            "lang": row["Language_Name"],
            "rate": f"{row['Publish_Rate']:.2f}%",
            "uploaded": int(row["Uploaded Count"]),
            "created": int(row["Created Count"]),
            "published": int(row["Published Count"]),
        })

    return {
        "languages": languages,
        "best": best_lang,
        "bestUploads": best_uploads,
        "bestPublished": best_published,
    }


@router.get("/users")
def get_users():
    fus = _DATA["fact_user_sum"]
    dim_user = _DATA["dim_user"]
    m = _DATA["monthly"]

    user_act = fus.merge(dim_user, on="User_ID")[
        ["User_ID", "User_Name", "Uploaded Count", "Created Count", "Published Count"]
    ]
    user_act.columns = ["User_ID", "User", "Uploaded", "Created", "Published"]
    user_act["Active"] = user_act["Uploaded"] > 0
    active_df = user_act[user_act["Active"]].sort_values("Uploaded", ascending=False)
    inactive_df = user_act[~user_act["Active"]]

    active_users = len(active_df)
    total_users = int(dim_user["User_ID"].nunique())
    inactive = len(inactive_df)
    active_ratio = round((active_users / total_users * 100) if total_users else 0, 1)

    tot_uploaded = int(m["Uploaded"].sum())
    tot_created = int(m["Created"].sum())
    tot_published = int(m["Published"].sum())
    avg_uploads = round(tot_uploaded / active_users, 1) if active_users else 0
    orphaned = tot_created - tot_published
    all_time_pub_rate = round((tot_published / tot_uploaded * 100) if tot_uploaded else 0, 2)

    user_colors = PALETTE
    top10 = active_df.head(10).reset_index(drop=True)
    top_users = []
    for i, (_, row) in enumerate(top10.iterrows()):
        name = str(row["User"])
        initial = name[0].upper() if name else "?"
        if " " in name:
            parts = name.split()
            initial = parts[0][0].upper()
        top_users.append({
            "id": int(row["User_ID"]),
            "name": name,
            "initial": initial,
            "color": user_colors[i % len(user_colors)],
            "uploads": int(row["Uploaded"]),
            "created": int(row["Created"]),
            "published": int(row["Published"]),
        })

    return {
        "topUsers": top_users,
        "activeUsers": active_users,
        "totalUsers": total_users,
        "activeRatio": f"{active_ratio}%",
        "inactive": inactive,
        "avgUploads": avg_uploads,
        "orphanedOutputs": f"{orphaned:,}",
        "allTimePublishRate": f"{all_time_pub_rate}%",
    }


@router.get("/alerts")
def get_alerts():
    m = _DATA["monthly"]
    cur = m.iloc[-1]
    prv = m.iloc[-2]

    kpi1_cur = int(cur["Uploaded"])
    kpi1_prv = int(prv["Uploaded"])
    kpi2_cur = int(cur["Created"])
    kpi2_prv = int(prv["Created"])
    kpi3_cur = int(cur["Published"])
    kpi3_prv = int(prv["Published"])

    kpi6_cur = round(((kpi2_cur - kpi3_cur) / kpi2_cur * 100) if kpi2_cur else 0, 2)
    kpi9_cur = round((kpi3_cur / kpi1_cur * 100) if kpi1_cur else 0, 2)
    kpi9_prv = round((kpi3_prv / kpi1_prv * 100) if kpi1_prv else 0, 2)
    _, kpi1_pct, _ = _pct_change(kpi1_cur, kpi1_prv)
    _, kpi2_pct, _ = _pct_change(kpi2_cur, kpi2_prv)
    kpi5_cur = round(kpi2_cur / kpi1_cur, 2) if kpi1_cur else 0

    cur_name = cur["Month_Name"]
    prv_name = prv["Month_Name"]

    alerts = []

    if kpi6_cur > 90:
        alerts.append({
            "level": "critical",
            "text": (
                f"Orphan rate {kpi6_cur}% in {cur_name} — "
                f"{kpi2_cur - kpi3_cur:,} of {kpi2_cur:,} created outputs never published. "
                f"Pipeline review required."
            ),
        })

    if kpi9_cur < 5:
        _, pub_pct, _ = _pct_change(kpi9_cur, kpi9_prv)
        alerts.append({
            "level": "critical",
            "text": (
                f"Publish rate dropped to {kpi9_cur}% in {cur_name} "
                f"(vs {kpi9_prv}% in {prv_name}, {pub_pct}). "
                f"Only {kpi3_cur} of {kpi1_cur} uploads published."
            ),
        })

    chan_pub = _DATA["fact_chan_pub"].merge(_DATA["dim_channel"], on="Channel_ID")
    chan_total = (
        chan_pub.groupby("Channel_Name")["Published_Count"]
        .sum()
        .sort_values(ascending=False)
    )
    total_pub = chan_total.sum()
    active_ch = int((chan_total > 0).sum())
    total_ch = int(_DATA["dim_channel"]["Channel_ID"].nunique())
    if len(chan_total) > 0 and total_pub > 0:
        top_ch_name = chan_total.index[0]
        top_ch_val = int(chan_total.iloc[0])
        top_share = round(top_ch_val / total_pub * 100, 1)
        if top_share > 50:
            alerts.append({
                "level": "warning",
                "text": (
                    f"Channel {top_ch_name} dominates with {top_ch_val} of {total_pub} "
                    f"all-time published videos ({top_share}%). "
                    f"Only {active_ch} of {total_ch} channels have any publishing activity."
                ),
            })

    if kpi1_cur > kpi1_prv or kpi2_cur > kpi2_prv:
        alerts.append({
            "level": "healthy",
            "text": (
                f"Upload volume {kpi1_pct} MoM ({kpi1_cur:,} vs {kpi1_prv:,}). "
                f"AI content creation {kpi2_pct} ({kpi2_cur:,} vs {kpi2_prv:,}). "
                f"AI expansion factor at {kpi5_cur}x."
            ),
        })

    if kpi3_cur == 0:
        alerts.append({
            "level": "critical",
            "text": f"ZERO published outputs in {cur_name} — full publishing blackout!",
        })

    if not alerts:
        alerts.append({
            "level": "healthy",
            "text": "No critical threshold breaches detected this month.",
        })

    return alerts
