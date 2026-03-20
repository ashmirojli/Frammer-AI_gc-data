"""
tab3_analytics.py
-----------------
FastAPI router that loads StarSchemaDB CSV files and computes all KPIs,
charts, and data panels for the Tab 3 "Analysis" dashboard.

Covers two sub-pages:
  1. User Analysis  – KPIs, leaderboard, loyalty tiers, scatter, top 12 charts
  2. Channel Analysis – KPIs, comparison, publish rate, drilldown, users/channel,
                        creation efficiency, spotlight badges

Single endpoint:  GET /api/tab3/all
"""

from __future__ import annotations

import logging
import os
import pathlib

import numpy as np
import pandas as pd
from fastapi import APIRouter

logger = logging.getLogger("tab3")

router = APIRouter(prefix="/api/tab3", tags=["Tab 3 – Analysis"])

_DATA: dict = {}

TIER_COLORS = {
    "Power User": "#006d44",
    "Frequent": "#00bfa5",
    "Active": "#00c864",
    "Regular": "#f97316",
    "One-Timer": "#8b5cf6",
    "Zero-Upload": "#ff4d6d",
}


def _safe_div(a, b, default=0.0):
    try:
        return a / b if b else default
    except Exception:
        return default


# ─────────────────────────────────────────────────────────────────────────────
#  Data loading
# ─────────────────────────────────────────────────────────────────────────────

def load_tab3_data():
    global _DATA

    base = pathlib.Path(os.path.dirname(os.path.abspath(__file__))).parent / "StarSchemaDB"

    dim_user = pd.read_csv(base / "Dim_User.csv")
    dim_channel = pd.read_csv(base / "Dim_Channel.csv")
    fact_user_sum = pd.read_csv(base / "Fact_User_Summary.csv")
    fact_user_chan = pd.read_csv(base / "Fact_User_Channel.csv")

    _DATA = {
        "dim_user": dim_user,
        "dim_channel": dim_channel,
        "fact_user_sum": fact_user_sum,
        "fact_user_chan": fact_user_chan,
    }
    logger.info(
        "Tab 3 data loaded – %d users, %d user-channel rows",
        len(dim_user), len(fact_user_chan),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _compute_user_analysis() -> dict:
    fus = _DATA["fact_user_sum"].copy()
    dim_user = _DATA["dim_user"]
    fus = fus.merge(dim_user, on="User_ID", how="left")

    total_users = int(fus["User_ID"].nunique())
    active_users = int(fus[fus["Uploaded Count"] > 0]["User_ID"].nunique())
    repeat_users = int(fus[fus["Uploaded Count"] > 1]["User_ID"].nunique())
    repeatability_rate = round(_safe_div(repeat_users, total_users) * 100, 1)
    avg_uploads = round(fus["Uploaded Count"].mean(), 1)

    fus_sorted = fus.sort_values("Published Count", ascending=False)
    total_published = int(fus["Published Count"].sum())
    top_10_limit = max(1, int(np.ceil(0.10 * total_users)))
    top_10_pub = int(fus_sorted.head(top_10_limit)["Published Count"].sum())
    top_10_pct = round(_safe_div(top_10_pub, total_published) * 100, 1)

    # --- KPIs ---
    user_kpis = {
        "total_users": total_users,
        "active_users": active_users,
        "repeatability_rate": f"{repeatability_rate}%",
        "repeat_users": repeat_users,
        "avg_uploads": avg_uploads,
        "top_10_pct": f"{top_10_pct}%",
        "top_10_limit": top_10_limit,
        "top_10_pub": top_10_pub,
        "total_published": total_published,
    }

    # --- Leaderboard ---
    fus["Creation_Efficiency"] = fus.apply(
        lambda r: round(_safe_div(r["Created Count"], r["Uploaded Count"]), 2), axis=1
    )
    fus["Publish_Rate"] = fus.apply(
        lambda r: round(_safe_div(r["Published Count"], r["Created Count"]) * 100, 1), axis=1
    )

    def _tier(row):
        if row["Uploaded Count"] == 0:
            return "Zero-Upload"
        if row["Uploaded Count"] == 1:
            return "One-Timer"
        if row["Uploaded Count"] <= 10:
            return "Regular"
        if row["Uploaded Count"] <= 50:
            return "Active"
        if row["Uploaded Count"] <= 100:
            return "Frequent"
        return "Power User"

    fus["Tier"] = fus.apply(_tier, axis=1)

    leaderboard_df = fus.sort_values(
        ["Published Count", "Creation_Efficiency"], ascending=False
    ).reset_index(drop=True)

    leaderboard = []
    for i, (_, r) in enumerate(leaderboard_df.iterrows()):
        tier = r["Tier"]
        leaderboard.append({
            "id": i + 1,
            "name": str(r.get("User_Name", f"User_{r['User_ID']}")),
            "uploaded": int(r["Uploaded Count"]),
            "created": int(r["Created Count"]),
            "published": int(r["Published Count"]),
            "pubRate": f"{r['Publish_Rate']}%",
            "crEff": f"{r['Creation_Efficiency']}x",
            "tier": tier,
            "tierCol": TIER_COLORS.get(tier, "#888"),
        })

    # --- Loyalty Tiers (donut chart) ---
    tier_counts = fus["Tier"].value_counts()
    loyalty_tiers = []
    for tier_name in ["Power User", "Frequent", "Active", "Regular", "One-Timer", "Zero-Upload"]:
        loyalty_tiers.append({
            "name": tier_name,
            "value": int(tier_counts.get(tier_name, 0)),
            "color": TIER_COLORS.get(tier_name, "#888"),
        })

    # --- Scatter: Uploaded vs Published ---
    scatter = []
    for _, r in fus.iterrows():
        u = int(r["Uploaded Count"])
        p = int(r["Published Count"])
        if u > 0:
            scatter.append({"uploaded": u, "published": p})

    # --- Top 12 Users by Published Count ---
    top12_pub = fus.sort_values("Published Count", ascending=False).head(12)
    top12_published = []
    for i, (_, r) in enumerate(top12_pub.iterrows()):
        top12_published.append({
            "name": str(r.get("User_Name", f"User_{r['User_ID']}")),
            "val": int(r["Published Count"]),
            "fill": "#00c864" if i < 3 else "#ff4d6d",
        })

    # --- Top 12 Users by Publish Rate ---
    fus_pub = fus[fus["Published Count"] > 0].copy()
    top12_rate = fus_pub.sort_values("Publish_Rate", ascending=False).head(12)
    top12_publish_rate = []
    for _, r in top12_rate.iterrows():
        top12_publish_rate.append({
            "name": str(r.get("User_Name", f"User_{r['User_ID']}")),
            "val": float(r["Publish_Rate"]),
        })

    return {
        "kpis": user_kpis,
        "leaderboard": leaderboard,
        "loyaltyTiers": loyalty_tiers,
        "scatter": scatter,
        "top12Published": top12_published,
        "top12PublishRate": top12_publish_rate,
    }


def _compute_channel_analysis() -> dict:
    fuc = _DATA["fact_user_chan"].copy()
    dim_ch = _DATA["dim_channel"]
    fuc = fuc.merge(dim_ch, on="Channel_ID", how="left")

    channel_stats = fuc.groupby("Channel_Name").agg({
        "User_ID": "nunique",
        "Uploaded Count": "sum",
        "Created Count": "sum",
        "Published Count": "sum",
    }).reset_index()
    channel_stats.rename(columns={"User_ID": "Users"}, inplace=True)

    channel_stats["Creation_Efficiency"] = channel_stats.apply(
        lambda r: round(_safe_div(r["Created Count"], r["Uploaded Count"]), 2), axis=1
    )
    channel_stats["Publish_Rate"] = channel_stats.apply(
        lambda r: round(_safe_div(r["Published Count"], r["Uploaded Count"]) * 100, 2), axis=1
    )

    total_channels = len(channel_stats)
    publishing_channels = int((channel_stats["Published Count"] > 0).sum())
    zero_pub_channels = total_channels - publishing_channels

    best = channel_stats.sort_values("Publish_Rate", ascending=False).iloc[0]
    best_name = str(best["Channel_Name"])
    best_rate = float(best["Publish_Rate"])
    best_published = int(best["Published Count"])

    avg_creation_eff = round(channel_stats["Creation_Efficiency"].mean(), 2)

    ch_kpis = {
        "total_channels": total_channels,
        "publishing_channels": publishing_channels,
        "zero_pub_channels": zero_pub_channels,
        "best_channel": best_name,
        "best_rate": f"{best_rate}%",
        "best_published": best_published,
        "avg_creation_eff": f"{avg_creation_eff}x",
    }

    # --- Channel Comparison (bar chart) ---
    ch_sorted = channel_stats.sort_values("Uploaded Count", ascending=False)
    comparison = []
    for _, r in ch_sorted.iterrows():
        comparison.append({
            "name": str(r["Channel_Name"]),
            "uploaded": int(r["Uploaded Count"]),
            "created": int(r["Created Count"]),
            "published": int(r["Published Count"]),
        })

    # --- Channel Publish Rate (bar chart) ---
    ch_by_rate = channel_stats.sort_values("Publish_Rate", ascending=False)
    publish_rate_data = []
    for _, r in ch_by_rate.iterrows():
        rate = float(r["Publish_Rate"])
        color = "#00c864" if rate >= 3 else ("#f97316" if rate > 0 else "#ff4d6d")
        publish_rate_data.append({
            "name": str(r["Channel_Name"]),
            "rate": rate,
            "color": color,
        })

    # --- Channel × User Drilldown ---
    dim_user = _DATA["dim_user"]
    drill = fuc.merge(dim_user, on="User_ID", how="left")
    drill["Rate"] = drill.apply(
        lambda r: f"{round(_safe_div(r['Published Count'], r['Uploaded Count']) * 100, 1)}%", axis=1
    )
    drill = drill.sort_values(["Channel_Name", "Published Count"], ascending=[True, False])
    drill_top = drill[drill["Published Count"] > 0].head(30)

    drilldown = []
    for _, r in drill_top.iterrows():
        drilldown.append({
            "channel": str(r["Channel_Name"]),
            "user": str(r.get("User_Name", f"User_{r['User_ID']}")),
            "uploaded": int(r["Uploaded Count"]),
            "created": int(r["Created Count"]),
            "published": int(r["Published Count"]),
            "rate": r["Rate"],
        })

    # --- Users per Channel (bar chart) ---
    upc = channel_stats.sort_values("Users", ascending=False)
    users_per_channel = []
    for _, r in upc.iterrows():
        users_per_channel.append({
            "name": str(r["Channel_Name"]),
            "val": int(r["Users"]),
        })

    # --- Channel Creation Efficiency (bar chart) ---
    ch_eff_sorted = channel_stats.sort_values("Creation_Efficiency", ascending=False)
    max_eff = float(ch_eff_sorted["Creation_Efficiency"].max()) if len(ch_eff_sorted) else 1
    creation_efficiency = []
    for _, r in ch_eff_sorted.iterrows():
        eff = float(r["Creation_Efficiency"])
        creation_efficiency.append({
            "name": str(r["Channel_Name"]),
            "val": eff,
            "highlight": eff >= max_eff,
        })

    # --- Channel Spotlight Badges ---
    spotlight = []
    for _, r in ch_by_rate.iterrows():
        spotlight.append({
            "id": str(r["Channel_Name"]),
            "users": int(r["Users"]),
            "uploaded": f"{int(r['Uploaded Count']):,}",
            "rate": f"{float(r['Publish_Rate']):.2f}%",
            "eff": f"{float(r['Creation_Efficiency']):.2f}x",
            "color": "#ff4d6d",
        })

    return {
        "kpis": ch_kpis,
        "comparison": comparison,
        "publishRate": publish_rate_data,
        "drilldown": drilldown,
        "usersPerChannel": users_per_channel,
        "creationEfficiency": creation_efficiency,
        "spotlight": spotlight,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/all")
def get_tab3_all():
    return {
        "user_analysis": _compute_user_analysis(),
        "channel_analysis": _compute_channel_analysis(),
    }
