"""
tab2_analytics.py
-----------------
FastAPI router for Tab 2 Analytics Engine.

Loads all fact and dimension tables from StarSchemaDB CSVs and computes
KPIs and chart data for all 12 dashboard sub-tabs:
  Overview, Editorial Yield, Publishing Ecosystem, Output Generation Rate,
  Monthly Productivity Index, Duration Footprint, Metadata Health,
  Platform Adoption Velocity, Usage Intensity Score, Channel Productivity,
  Output Diversity, Content Impact.

Endpoint:
  GET /api/tab2/all  — Every metric + chart-ready array in one response
"""

import os
import logging

import numpy as np
import pandas as pd
from fastapi import APIRouter

logger = logging.getLogger("tab2-analytics")

router = APIRouter(prefix="/api/tab2", tags=["Tab2 Analytics"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(os.path.dirname(BASE_DIR), "StarSchemaDB")

_data: dict = {}


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _dur_to_sec(time_str) -> int:
    if pd.isna(time_str) or str(time_str).strip() in ("0", "0:00:00", ""):
        return 0
    try:
        parts = str(time_str).split(":")
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(float(parts[1]))
        return 0
    except Exception:
        return 0


def _safe_int(v):
    try:
        return int(v) if pd.notna(v) else 0
    except (ValueError, TypeError):
        return 0


def _safe_float(v, decimals=1):
    try:
        return round(float(v), decimals) if pd.notna(v) else 0.0
    except (ValueError, TypeError):
        return 0.0


# ═══════════════════════════════════════════════════════════════════════════════
#  Data Loading
# ═══════════════════════════════════════════════════════════════════════════════

def load_tab2_data():
    global _data
    logger.info("Loading StarSchemaDB CSVs for Tab 2 Analytics …")

    _data["fact_monthly"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Monthly.csv"))
    _data["fact_input_type"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Input_Type.csv"))
    _data["fact_output_type"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Output_Type.csv"))
    _data["fact_channel_pub"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Channel_Publishing.csv"))
    _data["fact_user_summary"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_User_Summary.csv"))
    _data["fact_user_monthly"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_User_Monthly.csv"))
    _data["fact_user_channel"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_User_Channel.csv"))
    _data["fact_video"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Video.csv"))

    _data["dim_month"] = pd.read_csv(os.path.join(CSV_DIR, "Dim_Month.csv"))
    _data["dim_input"] = pd.read_csv(os.path.join(CSV_DIR, "Dim_Input_Type.csv"))
    _data["dim_output"] = pd.read_csv(os.path.join(CSV_DIR, "Dim_Output_Type.csv"))
    _data["dim_platform"] = pd.read_csv(os.path.join(CSV_DIR, "Dim_Platform.csv"))
    _data["dim_channel"] = pd.read_csv(os.path.join(CSV_DIR, "Dim_Channel.csv"))
    _data["dim_user"] = pd.read_csv(os.path.join(CSV_DIR, "Dim_User.csv"))

    fm = _data["fact_monthly"]
    for col in ["Total Uploaded Duration", "Total Created Duration", "Total Published Duration"]:
        if col in fm.columns:
            fm[f"{col}_sec"] = fm[col].apply(_dur_to_sec)

    for key in ["fact_input_type", "fact_output_type", "fact_user_summary"]:
        df = _data[key]
        for col in ["Uploaded Duration (hh:mm:ss)", "Created Duration (hh:mm:ss)", "Published Duration (hh:mm:ss)"]:
            if col in df.columns:
                df[f"{col}_sec"] = df[col].apply(_dur_to_sec)

    fcp = _data["fact_channel_pub"]
    if "Published_Duration" in fcp.columns:
        num = pd.to_numeric(fcp["Published_Duration"], errors="coerce")
        if num.isna().all():
            fcp["Published_Duration_sec"] = fcp["Published_Duration"].apply(_dur_to_sec)
        else:
            fcp["Published_Duration_sec"] = num.fillna(0).astype(int)

    logger.info("Tab 2 Analytics data loaded.")


# ═══════════════════════════════════════════════════════════════════════════════
#  Endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/all")
def get_all_tab2():
    """Return every Tab 2 KPI + chart-ready array in one response."""
    if not _data:
        return {"error": "Data not loaded. Restart the server."}

    fm = _data["fact_monthly"]
    fi = _data["fact_input_type"]
    fo = _data["fact_output_type"]
    fcp = _data["fact_channel_pub"]
    fus = _data["fact_user_summary"]
    fum = _data["fact_user_monthly"]
    fuc = _data["fact_user_channel"]
    fv = _data["fact_video"]
    dm = _data["dim_month"]
    di = _data["dim_input"]
    do_ = _data["dim_output"]
    dp = _data["dim_platform"]
    dc = _data["dim_channel"]
    du = _data["dim_user"]

    # ── Shared: monthly merged with dim ───────────────────────────────────
    monthly = fm.merge(dm, on="Month_ID", how="left").sort_values("Month_ID")

    # ═══ 1. OVERVIEW ═════════════════════════════════════════════════════════
    total_uploaded = _safe_int(fm["Total Uploaded"].sum())
    total_created = _safe_int(fm["Total Created"].sum())
    total_published = _safe_int(fm["Total Published"].sum())
    publish_rate = _safe_float(total_published / total_created * 100) if total_created else 0
    active_users = _safe_int(fus["User_ID"].nunique())

    monthly_trend = [
        {
            "name": str(r["Month_Name"]),
            "uploaded": _safe_int(r["Total Uploaded"]),
            "created": _safe_int(r["Total Created"]),
            "published": _safe_int(r["Total Published"]),
        }
        for _, r in monthly.iterrows()
    ]

    input_m = fi.merge(di, on="InputType_ID", how="left")
    input_types = [
        {"name": str(r["Input_Type_Name"]), "uploaded": _safe_int(r["Uploaded Count"]),
         "created": _safe_int(r["Created Count"]), "published": _safe_int(r["Published Count"])}
        for _, r in input_m.iterrows()
    ]

    output_m = fo.merge(do_, on="OutputType_ID", how="left")
    output_types = [
        {"name": str(r["Output_Type_Name"]), "uploaded": _safe_int(r["Uploaded Count"]),
         "created": _safe_int(r["Created Count"]), "published": _safe_int(r["Published Count"])}
        for _, r in output_m.iterrows()
    ]

    overview = {
        "total_uploaded": total_uploaded,
        "total_created": total_created,
        "total_published": total_published,
        "publish_rate": publish_rate,
        "active_users": active_users,
        "monthly_trend": monthly_trend,
        "input_types": input_types,
        "output_types": output_types,
    }

    # ═══ 2. EDITORIAL YIELD ══════════════════════════════════════════════════
    monthly["Publish_Rate_Pct"] = (
        monthly["Total Published"] / monthly["Total Created"].replace(0, np.nan) * 100
    ).fillna(0)
    monthly["Dropoff"] = monthly["Total Created"] - monthly["Total Published"]
    monthly["CEF"] = (
        monthly["Total Created"] / monthly["Total Uploaded"].replace(0, np.nan)
    ).fillna(0)

    if "Total Created Duration_sec" in monthly.columns:
        monthly["Avg_Dur_Min"] = (
            monthly["Total Created Duration_sec"]
            / monthly["Total Created"].replace(0, np.nan)
        ).fillna(0) / 60
    else:
        monthly["Avg_Dur_Min"] = 0

    editorial_yield = [
        {
            "name": str(r["Month_Name"]),
            "created": _safe_int(r["Total Created"]),
            "published": _safe_int(r["Total Published"]),
            "publish_rate_pct": _safe_float(r["Publish_Rate_Pct"]),
            "dropoff": _safe_int(r["Dropoff"]),
            "expansion": _safe_float(r["CEF"], 2),
            "avg_dur_min": _safe_float(r["Avg_Dur_Min"]),
        }
        for _, r in monthly.iterrows()
    ]

    # ═══ 3. PUBLISHING ECOSYSTEM ═════════════════════════════════════════════
    plat_pub = fcp.merge(dp, on="Platform_ID", how="left")
    plat_agg = plat_pub.groupby("Platform_Name")["Published_Count"].sum().reset_index()
    plat_total = _safe_int(plat_agg["Published_Count"].sum()) or 1
    plat_agg["pct"] = (plat_agg["Published_Count"] / plat_total * 100).round(1)
    platform_dist = [
        {"name": str(r["Platform_Name"]), "value": _safe_int(r["Published_Count"]),
         "pct": _safe_float(r["pct"])}
        for _, r in plat_agg.sort_values("Published_Count", ascending=False).iterrows()
    ]

    chan_pub = fcp.merge(dc, on="Channel_ID", how="left").merge(dp, on="Platform_ID", how="left")
    chan_agg = (
        chan_pub.groupby(["Channel_Name", "Platform_Name"])["Published_Count"]
        .sum()
        .reset_index()
    )
    chan_total = _safe_int(chan_agg["Published_Count"].sum()) or 1
    chan_agg["pct"] = (chan_agg["Published_Count"] / chan_total * 100).round(1)
    channel_dist = [
        {"name": str(r["Channel_Name"]), "platform": str(r["Platform_Name"]),
         "value": _safe_int(r["Published_Count"]), "pct": _safe_float(r["pct"])}
        for _, r in chan_agg.sort_values("Published_Count", ascending=False).iterrows()
    ]

    ecosystem = {"platform_dist": platform_dist, "channel_dist": channel_dist}

    # ═══ 4. OUTPUT GENERATION RATE ════════════════════════════════════════════
    output_m["CEF"] = (
        output_m["Created Count"] / output_m["Uploaded Count"].replace(0, np.nan)
    ).fillna(0)
    gen_by_output = [
        {"name": str(r["Output_Type_Name"]), "rate": _safe_float(r["CEF"], 2),
         "created": _safe_int(r["Created Count"]), "uploaded": _safe_int(r["Uploaded Count"])}
        for _, r in output_m.sort_values("CEF", ascending=False).iterrows()
    ]

    avg_gen = _safe_float(output_m["CEF"].mean(), 2)
    peak_idx = output_m["CEF"].idxmax()
    peak_gen = output_m.loc[peak_idx]
    total_gen = _safe_int(output_m["Created Count"].sum())
    total_uploads = _safe_int(output_m["Uploaded Count"].sum())

    input_m["CEF"] = (
        input_m["Created Count"] / input_m["Uploaded Count"].replace(0, np.nan)
    ).fillna(0)
    gen_by_input = [
        {"name": str(r["Input_Type_Name"]), "rate": _safe_float(r["CEF"], 2),
         "created": _safe_int(r["Created Count"]), "uploaded": _safe_int(r["Uploaded Count"])}
        for _, r in input_m.sort_values("CEF", ascending=True).iterrows()
    ]

    monthly_cef = [
        {"name": str(r["Month_Name"]), "rate": _safe_float(r["CEF"], 2)}
        for _, r in monthly.iterrows()
    ]

    generation_rate = {
        "by_output": gen_by_output,
        "by_input": gen_by_input,
        "monthly_cef": monthly_cef,
        "avg_rate": avg_gen,
        "peak_rate": _safe_float(peak_gen["CEF"], 2),
        "peak_format": str(peak_gen["Output_Type_Name"]),
        "total_generated": total_gen,
        "total_uploads": total_uploads,
    }

    # ═══ 5. MONTHLY PRODUCTIVITY ═════════════════════════════════════════════
    users_per_month = fum.groupby("Month_ID")["User_ID"].nunique().reset_index()
    users_per_month.columns = ["Month_ID", "Active_Users"]

    prod = monthly.merge(users_per_month, on="Month_ID", how="left")
    prod["Active_Users"] = prod["Active_Users"].fillna(1).astype(int)
    prod["Productivity"] = (
        prod["Total Published"] / prod["Active_Users"].replace(0, np.nan)
    ).fillna(0)

    avg_prod = _safe_float(prod["Productivity"].mean())
    peak_prod_idx = prod["Productivity"].idxmax()
    peak_prod = prod.loc[peak_prod_idx]

    productivity = {
        "monthly": [
            {
                "name": str(r["Month_Name"]),
                "productivity": _safe_float(r["Productivity"]),
                "users": _safe_int(r["Active_Users"]),
                "videos": _safe_int(r["Total Published"]),
            }
            for _, r in prod.iterrows()
        ],
        "avg_productivity": avg_prod,
        "peak_productivity": _safe_float(peak_prod["Productivity"]),
        "peak_month": str(peak_prod["Month_Name"]),
        "total_published": total_published,
        "total_users": active_users,
    }

    # ═══ 6. DURATION FOOTPRINT ════════════════════════════════════════════════
    up_sec = float(monthly.get("Total Uploaded Duration_sec", pd.Series([0])).sum())
    cr_sec = float(monthly.get("Total Created Duration_sec", pd.Series([0])).sum())
    pb_sec = float(monthly.get("Total Published Duration_sec", pd.Series([0])).sum())

    dur_monthly = []
    for _, r in monthly.iterrows():
        u = float(r.get("Total Uploaded Duration_sec", 0)) / 60
        c = float(r.get("Total Created Duration_sec", 0)) / 60
        p = float(r.get("Total Published Duration_sec", 0)) / 60
        exp = round(c / u, 2) if u else 0
        pub = round(p / c * 100, 1) if c else 0
        dur_monthly.append({
            "name": str(r["Month_Name"]),
            "uploaded": round(u), "created": round(c), "published": round(p),
            "expansion": exp, "publish_rate": pub,
        })

    duration = {
        "monthly": dur_monthly,
        "total_uploaded_min": round(up_sec / 60),
        "total_created_min": round(cr_sec / 60),
        "total_published_min": round(pb_sec / 60),
        "expansion_rate": round(cr_sec / up_sec, 2) if up_sec else 0,
    }

    # ═══ 7. METADATA HEALTH ══════════════════════════════════════════════════
    tv = len(fv)
    if tv > 0:
        url_col = "Published URL" if "Published URL" in fv.columns else fv.columns[-1]
        fields = {
            "Platform Tagged": _safe_float(
                100 - fv["Platform_ID"].isna().sum() / tv * 100
            ),
            "URL Provided": _safe_float(100 - fv[url_col].isna().sum() / tv * 100),
            "Valid User Assigned": _safe_float(
                100 - fv[fv["User_ID"] <= 0].shape[0] / tv * 100
            )
            if "User_ID" in fv.columns
            else 100.0,
            "Has Headline": _safe_float(
                100 - fv["Headline"].isna().sum() / tv * 100
            )
            if "Headline" in fv.columns
            else 100.0,
        }
        avg_health = _safe_float(np.mean(list(fields.values())))
    else:
        fields = {}
        avg_health = 0.0

    metadata_health = {"fields": fields, "avg_health": avg_health, "total_videos": tv}

    # ═══ 8. PLATFORM ADOPTION VELOCITY ════════════════════════════════════════
    first_month = fum.groupby("User_ID")["Month_ID"].min().reset_index()
    first_month.columns = ["User_ID", "First_Month_ID"]
    new_per_month = (
        first_month.groupby("First_Month_ID").size().reset_index(name="new_users")
    )
    new_per_month = new_per_month.rename(columns={"First_Month_ID": "Month_ID"})

    adopt = dm.merge(new_per_month, on="Month_ID", how="left").sort_values("Month_ID")
    adopt["new_users"] = adopt["new_users"].fillna(0).astype(int)
    adopt["cumulative"] = adopt["new_users"].cumsum()
    adopt["velocity"] = (
        adopt["new_users"] / adopt["cumulative"].shift(1).replace(0, np.nan) * 100
    ).fillna(0)

    adoption = {
        "monthly": [
            {
                "name": str(r["Month_Name"]),
                "newUsers": _safe_int(r["new_users"]),
                "cumulative": _safe_int(r["cumulative"]),
                "velocity": _safe_float(r["velocity"]),
            }
            for _, r in adopt.iterrows()
        ],
        "total_users": _safe_int(adopt["cumulative"].iloc[-1]) if len(adopt) else 0,
        "avg_velocity": _safe_float(adopt["velocity"].mean()),
        "current_velocity": _safe_float(adopt["velocity"].iloc[-1]) if len(adopt) else 0,
        "latest_new": _safe_int(adopt["new_users"].iloc[-1]) if len(adopt) else 0,
    }

    # ═══ 9. USAGE INTENSITY SCORE ═════════════════════════════════════════════
    user_df = fus.merge(du, on="User_ID", how="left")
    user_df["UIS"] = user_df["Created Count"]
    user_df = user_df.sort_values("UIS", ascending=False)

    avg_uis = float(user_df["UIS"].mean()) if len(user_df) else 0
    power_thresh = float(user_df["UIS"].quantile(0.75)) if len(user_df) else 0

    uis_users = []
    for _, r in user_df.head(15).iterrows():
        vs = round((float(r["UIS"]) - avg_uis) / avg_uis * 100) if avg_uis else 0
        uis_users.append({
            "name": str(r["User_Name"]),
            "outputs": _safe_int(r["Created Count"]),
            "score": _safe_int(r["UIS"]),
            "category": "Power User" if r["UIS"] >= power_thresh else "Regular User",
            "vs_avg": int(vs),
        })

    usage_intensity = {
        "users": uis_users,
        "avg_uis": int(round(avg_uis)),
        "total_assets": _safe_int(user_df["Created Count"].sum()),
        "active_users": len(user_df),
        "power_users": int((user_df["UIS"] >= power_thresh).sum()),
    }

    # ═══ 10. CHANNEL PRODUCTIVITY ═════════════════════════════════════════════
    chan_users = (
        fuc.groupby("Channel_ID")
        .agg(users=("User_ID", "nunique"), published=("Published Count", "sum"))
        .reset_index()
    )
    chan_users = chan_users.merge(dc, on="Channel_ID", how="left")
    chan_users["productivity"] = (
        chan_users["published"] / chan_users["users"].replace(0, np.nan)
    ).fillna(0)
    chan_users = chan_users.sort_values("productivity", ascending=False)

    channel_productivity = [
        {
            "name": str(r["Channel_Name"]),
            "users": _safe_int(r["users"]),
            "videos": _safe_int(r["published"]),
            "index": _safe_float(r["productivity"]),
        }
        for _, r in chan_users.iterrows()
    ]

    # ═══ 11. OUTPUT DIVERSITY ═════════════════════════════════════════════════
    unique_types = int(output_m["Output_Type_Name"].nunique())
    total_out = _safe_int(output_m["Created Count"].sum()) or 1
    diversity_score = round(unique_types / total_out * 10000, 2)

    od_data = []
    for _, r in output_m.sort_values("Created Count", ascending=False).iterrows():
        pct = round(float(r["Created Count"]) / total_out * 100, 1)
        od_data.append({
            "type": str(r["Output_Type_Name"]),
            "count": _safe_int(r["Created Count"]),
            "percentage": pct,
        })

    output_diversity = {
        "diversity_score": diversity_score,
        "unique_types": unique_types,
        "total_outputs": _safe_int(total_out),
        "output_types": od_data,
    }

    # ═══ 12. CONTENT IMPACT ═══════════════════════════════════════════════════
    if "Total Published Duration_sec" in monthly.columns:
        monthly["Impact"] = monthly["Total Published"] * monthly["Total Published Duration_sec"]
    else:
        monthly["Impact"] = 0

    total_impact = _safe_int(monthly["Impact"].sum())
    avg_impact = round(float(monthly["Impact"].mean()))
    peak_imp_idx = monthly["Impact"].idxmax() if len(monthly) else None

    impact_monthly = [
        {
            "name": str(r["Month_Name"]),
            "videos": _safe_int(r["Total Published"]),
            "duration_sec": _safe_int(r.get("Total Published Duration_sec", 0)),
            "impact": _safe_int(r["Impact"]),
        }
        for _, r in monthly.iterrows()
    ]

    content_impact = {
        "monthly": impact_monthly,
        "total_impact": total_impact,
        "avg_monthly_impact": avg_impact,
        "peak_impact": _safe_int(monthly.loc[peak_imp_idx, "Impact"]) if peak_imp_idx is not None else 0,
        "peak_month": str(monthly.loc[peak_imp_idx, "Month_Name"]) if peak_imp_idx is not None else "—",
    }

    return {
        "overview": overview,
        "editorial_yield": editorial_yield,
        "ecosystem": ecosystem,
        "generation_rate": generation_rate,
        "productivity": productivity,
        "duration": duration,
        "metadata_health": metadata_health,
        "adoption": adoption,
        "usage_intensity": usage_intensity,
        "channel_productivity": channel_productivity,
        "output_diversity": output_diversity,
        "content_impact": content_impact,
    }
