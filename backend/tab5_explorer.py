"""
tab5_explorer.py
----------------
FastAPI router for Tab 5 Video Explorer.

Loads Fact_Video + dimension tables from StarSchemaDB CSVs and provides
filterable, paginated, sorted access to the video catalogue along with
aggregate stats, chart data, auto-generated insights, and CSV export.

Endpoints
  GET /api/tab5/filters          Dropdown options (cascading)
  GET /api/tab5/stats            5 KPI stat-card values
  GET /api/tab5/videos           Paginated + sorted table
  GET /api/tab5/charts           4 chart datasets
  GET /api/tab5/insights         Auto insights + breakdown tables
  GET /api/tab5/video/{video_id} Single video record
  GET /api/tab5/export           CSV download
"""

import io
import os
import logging
from typing import List

import pandas as pd
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

logger = logging.getLogger("tab5-explorer")

router = APIRouter(prefix="/api/tab5", tags=["Tab5 Explorer"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(os.path.dirname(BASE_DIR), "StarSchemaDB")

_df: pd.DataFrame = pd.DataFrame()


# ═══════════════════════════════════════════════════════════════════════════════
#  Data Loading
# ═══════════════════════════════════════════════════════════════════════════════

def load_tab5_data():
    """Load Fact_Video + dimension CSVs, join, clean, and store globally."""
    global _df
    logger.info("Loading StarSchemaDB CSVs for Tab 5 Explorer …")

    df = pd.read_csv(os.path.join(CSV_DIR, "Fact_Video.csv"))
    dim_user = pd.read_csv(os.path.join(CSV_DIR, "Dim_User.csv"))
    dim_team = pd.read_csv(os.path.join(CSV_DIR, "Dim_Team.csv"))
    dim_platform = pd.read_csv(os.path.join(CSV_DIR, "Dim_Platform.csv"))

    df = df.merge(dim_user, on="User_ID", how="left")
    df = df.merge(dim_team, on="Team_ID", how="left")
    df = df.merge(dim_platform, on="Platform_ID", how="left")

    df = df.rename(columns={"Video ID": "Video_ID", "Published URL": "Published_URL"})

    df["Headline"] = df["Headline"].fillna("(No Headline)")
    df["Type"] = df["Type"].fillna("Unknown")
    df["User_Name"] = df["User_Name"].fillna("Unknown User")
    df["Team_Name"] = df["Team_Name"].fillna("Unknown Team")
    df["Platform_Name"] = df["Platform_Name"].fillna("—")
    df["Published_URL"] = df["Published_URL"].fillna("—")
    df["Source"] = df["Source"].fillna("—")

    df = df.drop(columns=["User_ID", "Team_ID", "Platform_ID"], errors="ignore")

    df = df[
        [
            "Video_ID",
            "Headline",
            "Type",
            "Published",
            "User_Name",
            "Team_Name",
            "Platform_Name",
            "Source",
            "Published_URL",
        ]
    ]

    _df = df
    logger.info("Tab 5 Explorer data loaded: %d videos", len(_df))


# ═══════════════════════════════════════════════════════════════════════════════
#  Filter helper
# ═══════════════════════════════════════════════════════════════════════════════

def _apply_filters(
    search: str,
    published: str,
    types: list,
    teams: list,
    users: list,
    platforms: list,
) -> pd.DataFrame:
    filtered = _df.copy()

    if search:
        q = search.lower()
        mask = (
            filtered["Headline"].str.lower().str.contains(q, na=False)
            | filtered["Source"].str.lower().str.contains(q, na=False)
            | filtered["User_Name"].str.lower().str.contains(q, na=False)
            | filtered["Team_Name"].str.lower().str.contains(q, na=False)
        )
        filtered = filtered[mask]

    if published and published != "All":
        val = "Yes" if published == "Published" else "No"
        filtered = filtered[filtered["Published"] == val]

    if types:
        filtered = filtered[filtered["Type"].isin(types)]
    if teams:
        filtered = filtered[filtered["Team_Name"].isin(teams)]
    if users:
        filtered = filtered[filtered["User_Name"].isin(users)]
    if platforms:
        filtered = filtered[filtered["Platform_Name"].isin(platforms)]

    return filtered


# ═══════════════════════════════════════════════════════════════════════════════
#  Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/filters")
def get_filters(teams: List[str] = Query(default=[])):
    """Dropdown options. Users cascade when teams are selected."""
    if _df.empty:
        return {"types": [], "teams": [], "users": [], "platforms": [], "total": 0}

    cascaded = _df[_df["Team_Name"].isin(teams)] if teams else _df

    pub_df = _df[_df["Published"] == "Yes"]
    platforms = sorted(
        pub_df[pub_df["Platform_Name"] != "—"]["Platform_Name"].unique().tolist()
    )

    return {
        "types": sorted(_df["Type"].dropna().unique().tolist()),
        "teams": sorted(_df["Team_Name"].unique().tolist()),
        "users": sorted(cascaded["User_Name"].unique().tolist()),
        "platforms": platforms,
        "total": len(_df),
    }


@router.get("/stats")
def get_stats(
    search: str = Query(default=""),
    published: str = Query(default="All"),
    types: List[str] = Query(default=[]),
    teams: List[str] = Query(default=[]),
    users: List[str] = Query(default=[]),
    platforms: List[str] = Query(default=[]),
):
    """5 KPI card values for the current filter state."""
    f = _apply_filters(search, published, types, teams, users, platforms)

    pub_count = int((f["Published"] == "Yes").sum())
    plat_count = int(f[f["Platform_Name"] != "—"]["Platform_Name"].nunique())
    top_type = f["Type"].value_counts().index[0] if len(f) > 0 else "—"
    top_user = f["User_Name"].value_counts().index[0] if len(f) > 0 else "—"

    return {
        "total": len(f),
        "total_all": len(_df),
        "published": pub_count,
        "pub_pct": round(pub_count / len(f) * 100, 1) if len(f) > 0 else 0,
        "unique_users": int(f["User_Name"].nunique()),
        "unique_types": int(f["Type"].nunique()),
        "platforms": plat_count,
        "top_type": top_type,
        "top_user": top_user,
        "pct_of_total": round(len(f) / len(_df) * 100, 1) if len(_df) > 0 else 0,
    }


@router.get("/videos")
def get_videos(
    search: str = Query(default=""),
    published: str = Query(default="All"),
    types: List[str] = Query(default=[]),
    teams: List[str] = Query(default=[]),
    users: List[str] = Query(default=[]),
    platforms: List[str] = Query(default=[]),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_col: str = Query(default="Video_ID"),
    sort_dir: str = Query(default="asc"),
):
    """Paginated, sorted, filtered video table."""
    filtered = _apply_filters(search, published, types, teams, users, platforms)

    if sort_col in filtered.columns:
        filtered = filtered.sort_values(
            sort_col, ascending=(sort_dir == "asc"), na_position="last"
        )

    total = len(filtered)
    total_pages = max(1, (total - 1) // page_size + 1)
    page = min(page, total_pages)
    start = (page - 1) * page_size
    page_df = filtered.iloc[start : start + page_size]

    return {
        "data": page_df.to_dict(orient="records"),
        "total": total,
        "total_pages": total_pages,
        "page": page,
        "page_size": page_size,
    }


@router.get("/charts")
def get_charts(
    search: str = Query(default=""),
    published: str = Query(default="All"),
    types: List[str] = Query(default=[]),
    teams: List[str] = Query(default=[]),
    users: List[str] = Query(default=[]),
    platforms: List[str] = Query(default=[]),
):
    """Data for the 4 chart panels."""
    f = _apply_filters(search, published, types, teams, users, platforms)

    type_dist = f["Type"].value_counts().reset_index()
    type_dist.columns = ["name", "value"]

    top_users = (
        f.groupby("User_Name")
        .size()
        .reset_index(name="value")
        .rename(columns={"User_Name": "name"})
        .sort_values("value", ascending=False)
        .head(10)
    )

    team_dist = (
        f.groupby("Team_Name")
        .size()
        .reset_index(name="value")
        .rename(columns={"Team_Name": "name"})
        .sort_values("value", ascending=False)
        .head(8)
    )

    pub_only = f[(f["Published"] == "Yes") & (f["Platform_Name"] != "—")]
    plat_dist = pub_only["Platform_Name"].value_counts().reset_index()
    plat_dist.columns = ["name", "value"]

    return {
        "type_dist": type_dist.to_dict(orient="records"),
        "top_users": top_users.to_dict(orient="records"),
        "team_dist": team_dist.to_dict(orient="records"),
        "platform_dist": plat_dist.to_dict(orient="records"),
    }


@router.get("/insights")
def get_insights(
    search: str = Query(default=""),
    published: str = Query(default="All"),
    types: List[str] = Query(default=[]),
    teams: List[str] = Query(default=[]),
    users: List[str] = Query(default=[]),
    platforms: List[str] = Query(default=[]),
):
    """Auto-generated insights + breakdown tables."""
    f = _apply_filters(search, published, types, teams, users, platforms)

    if len(f) == 0:
        return {"insights": [], "type_table": [], "team_table": []}

    top_type = f["Type"].value_counts().index[0]
    top_type_pct = round(f["Type"].value_counts().iloc[0] / len(f) * 100, 1)
    top_user = f["User_Name"].value_counts().index[0]
    top_team = f["Team_Name"].value_counts().index[0]
    top_team_cnt = int(f["Team_Name"].value_counts().iloc[0])
    unpub = int((f["Published"] == "No").sum())
    unpub_pct = round(unpub / len(f) * 100, 1)

    type_tbl = f["Type"].value_counts().reset_index()
    type_tbl.columns = ["Type", "Count"]
    type_tbl["Share"] = (type_tbl["Count"] / len(f) * 100).round(1)

    team_tbl = (
        f.groupby("Team_Name")
        .agg(
            Videos=("Video_ID", "count"),
            Users=("User_Name", "nunique"),
            Published=("Published", lambda x: int((x == "Yes").sum())),
        )
        .reset_index()
        .sort_values("Videos", ascending=False)
    )
    team_tbl["Pub_Pct"] = (team_tbl["Published"] / team_tbl["Videos"] * 100).round(1)

    return {
        "insights": [
            f"Most common type is {top_type}, making up {top_type_pct}% of videos in view.",
            f"Top contributor in this view is {top_user}.",
            f"Most active team is {top_team} with {top_team_cnt:,} videos.",
            f"{unpub:,} videos ({unpub_pct}%) are unpublished — potential backlog.",
            f"Current view spans {len(f):,} videos across "
            f"{f['Type'].nunique()} types and {f['Team_Name'].nunique()} teams.",
        ],
        "type_table": type_tbl.to_dict(orient="records"),
        "team_table": team_tbl.to_dict(orient="records"),
    }


@router.get("/video/{video_id}")
def get_video(video_id: str):
    """Single video record for the Record Inspector."""
    row = _df[_df["Video_ID"].astype(str) == video_id]
    if len(row) == 0:
        return {"error": "Video not found"}
    return row.iloc[0].to_dict()


@router.get("/export")
def export_csv(
    search: str = Query(default=""),
    published: str = Query(default="All"),
    types: List[str] = Query(default=[]),
    teams: List[str] = Query(default=[]),
    users: List[str] = Query(default=[]),
    platforms: List[str] = Query(default=[]),
):
    """Download filtered data as CSV."""
    filtered = _apply_filters(search, published, types, teams, users, platforms)
    buf = io.StringIO()
    filtered.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=frammer_export.csv"},
    )
