"""
tab4_kpis.py
------------
FastAPI router for Tab 4 KPI calculations.

Loads data from StarSchemaDB CSVs and computes:
  KPI 1  Content Efficiency Index (CEI)
  KPI 2  Duration Amplification Ratio
  KPI 3  Input Mix Health (Simpson's Diversity)
  KPI 4  Platform Diversity Index (Shannon Entropy)
  KPI 5  Gini Coefficient (Channel Concentration)
  KPI 6  Latency (monthly, platform, input-type)
  KPI 7  Consistency Index (Coefficient of Variation)
  KPI 8  Output Mix Health (Simpson's Diversity)

Endpoint:
  GET /api/tab4/kpis  — All KPIs + chart-ready data in a single response
"""

import os
import logging
import numpy as np
import pandas as pd
from fastapi import APIRouter

logger = logging.getLogger("tab4-kpis")

router = APIRouter(prefix="/api/tab4", tags=["Tab4 KPIs"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(os.path.dirname(BASE_DIR), "StarSchemaDB")

_data: dict = {}


# ═══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════════════════

def _dur_to_sec(time_str) -> int:
    """Convert hh:mm:ss duration string to total seconds."""
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


def _simpson(counts: pd.Series) -> float:
    """Simpson's Diversity Index: 1 - Σ(p²)."""
    total = counts.sum()
    if total == 0:
        return 0.0
    p = counts / total
    return float(1 - (p ** 2).sum())


def _shannon(counts: pd.Series) -> float:
    """Shannon Entropy: -Σ(p·ln(p))."""
    total = counts.sum()
    if total == 0:
        return 0.0
    p = counts / total
    p = p[p > 0]
    return float(-(p * np.log(p)).sum())


def _gini(x: np.ndarray) -> float:
    """Gini coefficient for measuring concentration/inequality."""
    x = np.sort(x)
    n = len(x)
    if n == 0 or np.sum(x) == 0:
        return 0.0
    return float((n + 1 - 2 * np.sum(np.cumsum(x)) / np.sum(x)) / n)


# ═══════════════════════════════════════════════════════════════════════════════
#  Data Loading
# ═══════════════════════════════════════════════════════════════════════════════

def load_tab4_data():
    """Load all CSV files needed for Tab 4 KPIs and pre-process durations."""
    global _data
    logger.info("Loading StarSchemaDB CSVs for Tab 4 KPIs...")

    _data["fact_monthly"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Monthly.csv"))
    _data["fact_input_type"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Input_Type.csv"))
    _data["fact_output_type"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Output_Type.csv"))
    _data["fact_channel_pub"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_Channel_Publishing.csv"))
    _data["fact_user_summary"] = pd.read_csv(os.path.join(CSV_DIR, "Fact_User_Summary.csv"))

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

    fi = _data["fact_input_type"]
    for col in [
        "Uploaded Duration (hh:mm:ss)",
        "Created Duration (hh:mm:ss)",
        "Published Duration (hh:mm:ss)",
    ]:
        if col in fi.columns:
            fi[f"{col}_sec"] = fi[col].apply(_dur_to_sec)

    logger.info("Tab 4 KPI data loaded.")


# ═══════════════════════════════════════════════════════════════════════════════
#  Endpoint
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/kpis")
def get_all_kpis():
    """Return every Tab 4 KPI + chart-ready arrays in one response."""
    if not _data:
        return {"error": "Data not loaded. Restart the server."}

    fm = _data["fact_monthly"]
    fi = _data["fact_input_type"]
    fo = _data["fact_output_type"]
    fcp = _data["fact_channel_pub"]
    dm = _data["dim_month"]
    di = _data["dim_input"]
    do_ = _data["dim_output"]
    dp = _data["dim_platform"]

    # ── Executive Summary totals (from Fact_Monthly) ───────────────────────
    total_uploaded = int(fm["Total Uploaded"].sum())
    total_created = int(fm["Total Created"].sum())
    total_published = int(fm["Total Published"].sum())
    conversion_rate = round(total_published / total_uploaded * 100, 2) if total_uploaded else 0

    # ── KPI 1: Content Efficiency Index ────────────────────────────────────
    inp_created = int(fi["Created Count"].sum())
    inp_published = int(fi["Published Count"].sum())
    cei = round(inp_published / inp_created * 100, 1) if inp_created else 0

    # ── KPI 2: Duration Amplification Ratio ────────────────────────────────
    created_dur = fi["Created Duration (hh:mm:ss)_sec"].sum()
    uploaded_dur = fi["Uploaded Duration (hh:mm:ss)_sec"].sum()
    dur_amp = round(created_dur / uploaded_dur, 2) if uploaded_dur else 0

    # ── KPI 3: Input Mix Health (Simpson's Diversity) ──────────────────────
    input_m = pd.merge(fi, di, on="InputType_ID", how="left")
    input_health = round(_simpson(input_m["Published Count"]) * 100, 1)
    input_mix = [
        {
            "name": str(r["Input_Type_Name"]),
            "uploaded": int(r["Uploaded Count"]),
            "created": int(r["Created Count"]),
            "published": int(r["Published Count"]),
        }
        for _, r in input_m.iterrows()
    ]

    # ── KPI 8: Output Mix Health (Simpson's Diversity) ─────────────────────
    output_m = pd.merge(fo, do_, on="OutputType_ID", how="left")
    output_health = round(_simpson(output_m["Published Count"]) * 100, 1)
    output_mix = [
        {"name": str(r["Output_Type_Name"]), "value": int(r["Published Count"])}
        for _, r in output_m.iterrows()
    ]

    # ── KPI 4: Platform Diversity Index (Shannon Entropy) ──────────────────
    plat_counts = fcp.groupby("Platform_ID")["Published_Count"].sum()
    pdi = round(_shannon(plat_counts), 2) if len(plat_counts) else 0

    df_plat = (
        plat_counts.reset_index()
        .merge(dp, on="Platform_ID", how="left")
        .sort_values("Published_Count", ascending=False)
    )
    df_plat["cumulative"] = round(
        df_plat["Published_Count"].cumsum() / df_plat["Published_Count"].sum() * 100, 1
    )
    platform_dist = [
        {
            "platform": str(r["Platform_Name"]),
            "volume": int(r["Published_Count"]),
            "cumulative": round(float(r["cumulative"]), 1),
        }
        for _, r in df_plat.iterrows()
    ]

    # ── KPI 5: Gini Coefficient ────────────────────────────────────────────
    chan_vals = fcp.groupby("Channel_ID")["Published_Count"].sum().values
    gini = round(_gini(chan_vals), 3)

    xs = np.sort(chan_vals)
    lorenz = np.cumsum(xs) / np.sum(xs) if np.sum(xs) > 0 else np.array([])
    lorenz = np.insert(lorenz, 0, 0)
    ideal = np.linspace(0, 100, len(lorenz))
    lorenz_pts = [
        {
            "x": round(float(ideal[i]), 1),
            "actual": round(float(lorenz[i]) * 100, 1),
            "perfect": round(float(ideal[i]), 1),
        }
        for i in range(len(lorenz))
    ]

    # ── KPI 6: Latency ────────────────────────────────────────────────────
    monthly = pd.merge(fm, dm, on="Month_ID", how="left").sort_values("Month_ID")
    monthly["latency"] = (
        (monthly["Total Published Duration_sec"] - monthly["Total Created Duration_sec"])
        / monthly["Total Published"].replace(0, np.nan)
    ) / 60
    avg_lat = (
        round(float(monthly["latency"].mean()), 2)
        if not monthly["latency"].isna().all()
        else 0
    )
    latency_monthly = [
        {"month": str(r["Month_Name"]), "latency": round(float(r["latency"]), 2)}
        for _, r in monthly.dropna(subset=["latency"]).iterrows()
    ]

    plat_lat = pd.merge(fcp, dp, on="Platform_ID", how="left")
    if "Published_Duration" in plat_lat.columns:
        plat_lat["Published_Duration_sec"] = pd.to_numeric(
            plat_lat["Published_Duration"], errors="coerce"
        )
        if plat_lat["Published_Duration_sec"].isna().all():
            plat_lat["Published_Duration_sec"] = plat_lat["Published_Duration"].apply(
                _dur_to_sec
            )
        plat_lat_agg = (
            plat_lat.groupby("Platform_Name")["Published_Duration_sec"]
            .mean()
            .reset_index()
            .sort_values("Published_Duration_sec", ascending=False)
        )
        delivery_lat = [
            {
                "platform": str(r["Platform_Name"]),
                "latency": round(float(r["Published_Duration_sec"]), 1),
            }
            for _, r in plat_lat_agg.iterrows()
        ]
    else:
        delivery_lat = []

    # ── Content Type Distribution ──────────────────────────────────────────
    content_dist = input_m[["Input_Type_Name", "Uploaded Count"]].sort_values(
        "Uploaded Count", ascending=False
    )
    content_type = [
        {"type": str(r["Input_Type_Name"]), "count": int(r["Uploaded Count"])}
        for _, r in content_dist.iterrows()
    ]

    # ── KPI 7: Consistency Index (CV) ──────────────────────────────────────
    pub_counts = monthly["Total Published"]
    mu = float(pub_counts.mean())
    sigma = float(pub_counts.std()) if len(pub_counts) > 1 else 0.0
    cv = round(sigma / mu, 2) if mu else 0

    # ── Monthly trend data ─────────────────────────────────────────────────
    trend = [
        {
            "month": str(r["Month_Name"]),
            "uploaded": int(r["Total Uploaded"]),
            "published": int(r["Total Published"]),
        }
        for _, r in monthly.iterrows()
    ]

    # ── Top Users ──────────────────────────────────────────────────────────
    try:
        fus = _data["fact_user_summary"]
        du = _data["dim_user"]
        user_m = pd.merge(fus, du, on="User_ID", how="left")
        top_users = (
            user_m.sort_values("Uploaded Count", ascending=False)
            .head(10)[["User_Name", "Uploaded Count"]]
        )
        top_users_data = [
            {"name": str(r["User_Name"]), "count": int(r["Uploaded Count"])}
            for _, r in top_users.iterrows()
        ]
    except Exception:
        top_users_data = []

    return {
        "summary": {
            "total_uploaded": total_uploaded,
            "total_created": total_created,
            "total_published": total_published,
            "conversion_rate": conversion_rate,
        },
        "kpi1_cei": {
            "cei": cei,
            "total_created": inp_created,
            "total_published": inp_published,
        },
        "kpi2_duration_amp": {"value": dur_amp},
        "kpi3_input_mix": {"health_pct": input_health, "data": input_mix},
        "kpi4_pdi": {"pdi": pdi, "platform_dist": platform_dist},
        "kpi5_gini": {"gini": gini, "lorenz": lorenz_pts},
        "kpi6_latency": {
            "avg_latency_min": avg_lat,
            "monthly": latency_monthly,
            "by_platform": delivery_lat,
        },
        "kpi7_consistency": {
            "cv": cv,
            "mean": round(mu, 1),
            "stability_y1": round(max(0, mu - sigma), 1),
            "stability_y2": round(mu + sigma, 1),
        },
        "kpi8_output_mix": {"health_pct": output_health, "data": output_mix},
        "charts": {
            "trend": trend,
            "content_type_dist": content_type,
            "top_users": top_users_data,
        },
    }
