from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import io
import sys
import os

from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(__file__))
from data_loader import load_master_df

# ── App setup ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Frammer AI — Tab 5 API",
    description="Backend API for Video Explorer dashboard",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load data once on startup ─────────────────────────────────────────────
df = load_master_df()
print(f"✓ Loaded {len(df):,} videos")

# ─────────────────────────────────────────────────────────────────────────
# HELPER — apply all filters
# ─────────────────────────────────────────────────────────────────────────
def apply_filters(
    search:    str,
    published: str,
    types:     list,
    teams:     list,
    users:     list,
    platforms: list
) -> pd.DataFrame:

    filtered = df.copy()

    # Global search across 4 columns
    if search:
        q = search.lower()
        mask = (
            filtered["Headline"].str.lower().str.contains(q, na=False) |
            filtered["Source"].str.lower().str.contains(q, na=False) |
            filtered["User_Name"].str.lower().str.contains(q, na=False) |
            filtered["Team_Name"].str.lower().str.contains(q, na=False)
        )
        filtered = filtered[mask]

    # Published status
    if published and published != "All":
        val = "Yes" if published == "Published" else "No"
        filtered = filtered[filtered["Published"] == val]

    # Multiselect filters
    if types:     filtered = filtered[filtered["Type"].isin(types)]
    if teams:     filtered = filtered[filtered["Team_Name"].isin(teams)]
    if users:     filtered = filtered[filtered["User_Name"].isin(users)]
    if platforms: filtered = filtered[filtered["Platform_Name"].isin(platforms)]

    return filtered


# ─────────────────────────────────────────────────────────────────────────
# GET /api/filters
# Returns all dropdown options (users cascade on team selection)
# ─────────────────────────────────────────────────────────────────────────
@app.get("/api/filters")
def get_filters(
    teams: list[str] = Query(default=[])
):
    # Cascade users based on selected teams
    cascaded = df[df["Team_Name"].isin(teams)] if teams else df

    pub_df    = df[df["Published"] == "Yes"]
    platforms = sorted(
        pub_df[pub_df["Platform_Name"] != "—"]["Platform_Name"]
        .unique().tolist()
    )

    return {
        "types":     sorted(df["Type"].dropna().unique().tolist()),
        "teams":     sorted(df["Team_Name"].unique().tolist()),
        "users":     sorted(cascaded["User_Name"].unique().tolist()),
        "platforms": platforms,
        "total":     len(df)
    }


# ─────────────────────────────────────────────────────────────────────────
# GET /api/stats
# Returns 5 KPI card values for current filter state
# ─────────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats(
    search:    str       = Query(default=""),
    published: str       = Query(default="All"),
    types:     list[str] = Query(default=[]),
    teams:     list[str] = Query(default=[]),
    users:     list[str] = Query(default=[]),
    platforms: list[str] = Query(default=[])
):
    f = apply_filters(
        search, published, types, teams, users, platforms
    )

    pub_count  = int((f["Published"] == "Yes").sum())
    plat_count = int(
        f[f["Platform_Name"] != "—"]["Platform_Name"].nunique()
    )
    top_type   = (f["Type"].value_counts().index[0]
                  if len(f) > 0 else "—")
    top_user   = (f["User_Name"].value_counts().index[0]
                  if len(f) > 0 else "—")

    return {
        "total":        len(f),
        "total_all":    len(df),
        "published":    pub_count,
        "pub_pct":      round(pub_count / len(f) * 100, 1)
                        if len(f) > 0 else 0,
        "unique_users": int(f["User_Name"].nunique()),
        "unique_types": int(f["Type"].nunique()),
        "platforms":    plat_count,
        "top_type":     top_type,
        "top_user":     top_user,
        "pct_of_total": round(len(f) / len(df) * 100, 1)
                        if len(df) > 0 else 0
    }


# ─────────────────────────────────────────────────────────────────────────
# GET /api/videos
# Returns paginated, sorted, filtered video table
# ─────────────────────────────────────────────────────────────────────────
@app.get("/api/videos")
def get_videos(
    search:    str       = Query(default=""),
    published: str       = Query(default="All"),
    types:     list[str] = Query(default=[]),
    teams:     list[str] = Query(default=[]),
    users:     list[str] = Query(default=[]),
    platforms: list[str] = Query(default=[]),
    page:      int       = Query(default=1,  ge=1),
    page_size: int       = Query(default=20, ge=1, le=100),
    sort_col:  str       = Query(default="Video_ID"),
    sort_dir:  str       = Query(default="asc")
):
    filtered = apply_filters(
        search, published, types, teams, users, platforms
    )

    # Sort
    valid_cols = filtered.columns.tolist()
    if sort_col in valid_cols:
        filtered = filtered.sort_values(
            sort_col,
            ascending=(sort_dir == "asc"),
            na_position="last"
        )

    # Paginate
    total       = len(filtered)
    total_pages = max(1, (total - 1) // page_size + 1)
    page        = min(page, total_pages)
    start       = (page - 1) * page_size
    page_df     = filtered.iloc[start: start + page_size]

    return {
        "data":        page_df.to_dict(orient="records"),
        "total":       total,
        "total_pages": total_pages,
        "page":        page,
        "page_size":   page_size
    }


# ─────────────────────────────────────────────────────────────────────────
# GET /api/charts
# Returns data for all 4 charts
# ─────────────────────────────────────────────────────────────────────────
@app.get("/api/charts")
def get_charts(
    search:    str       = Query(default=""),
    published: str       = Query(default="All"),
    types:     list[str] = Query(default=[]),
    teams:     list[str] = Query(default=[]),
    users:     list[str] = Query(default=[]),
    platforms: list[str] = Query(default=[])
):
    f = apply_filters(
        search, published, types, teams, users, platforms
    )

    # Chart 1 — Output type distribution
    type_dist = f["Type"].value_counts().reset_index()
    type_dist.columns = ["name", "value"]

    # Chart 2 — Top 10 users by video count
    top_users = (
        f.groupby("User_Name").size()
        .reset_index(name="value")
        .rename(columns={"User_Name": "name"})
        .sort_values("value", ascending=False)
        .head(10)
    )

    # Chart 3 — Top 8 teams by video count
    team_dist = (
        f.groupby("Team_Name").size()
        .reset_index(name="value")
        .rename(columns={"Team_Name": "name"})
        .sort_values("value", ascending=False)
        .head(8)
    )

    # Chart 4 — Platform reach (published only)
    pub_only  = f[
        (f["Published"] == "Yes") &
        (f["Platform_Name"] != "—")
    ]
    plat_dist = pub_only["Platform_Name"].value_counts().reset_index()
    plat_dist.columns = ["name", "value"]

    return {
        "type_dist":     type_dist.to_dict(orient="records"),
        "top_users":     top_users.to_dict(orient="records"),
        "team_dist":     team_dist.to_dict(orient="records"),
        "platform_dist": plat_dist.to_dict(orient="records")
    }


# ─────────────────────────────────────────────────────────────────────────
# GET /api/insights
# Returns auto-generated insights + breakdown tables
# ─────────────────────────────────────────────────────────────────────────
@app.get("/api/insights")
def get_insights(
    search:    str       = Query(default=""),
    published: str       = Query(default="All"),
    types:     list[str] = Query(default=[]),
    teams:     list[str] = Query(default=[]),
    users:     list[str] = Query(default=[]),
    platforms: list[str] = Query(default=[])
):
    f = apply_filters(
        search, published, types, teams, users, platforms
    )

    if len(f) == 0:
        return {
            "insights":   [],
            "type_table": [],
            "team_table": []
        }

    top_type     = f["Type"].value_counts().index[0]
    top_type_pct = round(
        f["Type"].value_counts().iloc[0] / len(f) * 100, 1
    )
    top_user     = f["User_Name"].value_counts().index[0]
    top_team     = f["Team_Name"].value_counts().index[0]
    top_team_cnt = int(f["Team_Name"].value_counts().iloc[0])
    unpub        = int((f["Published"] == "No").sum())
    unpub_pct    = round(unpub / len(f) * 100, 1)

    # Type breakdown table
    type_tbl = f["Type"].value_counts().reset_index()
    type_tbl.columns = ["Type", "Count"]
    type_tbl["Share %"] = (
        type_tbl["Count"] / len(f) * 100
    ).round(1)

    # Team breakdown table
    team_tbl = (
        f.groupby("Team_Name")
        .agg(
            Videos    = ("Video_ID",  "count"),
            Users     = ("User_Name", "nunique"),
            Published = ("Published",
                         lambda x: (x == "Yes").sum())
        )
        .reset_index()
        .sort_values("Videos", ascending=False)
    )
    team_tbl["Pub %"] = (
        team_tbl["Published"] / team_tbl["Videos"] * 100
    ).round(1)

    return {
        "insights": [
            f"Most common type is {top_type}, making up {top_type_pct}% of videos in view.",
            f"Top contributor in this view is {top_user}.",
            f"Most active team is {top_team} with {top_team_cnt:,} videos.",
            f"{unpub:,} videos ({unpub_pct}%) are unpublished — potential backlog.",
            f"Current view spans {len(f):,} videos across {f['Type'].nunique()} types and {f['Team_Name'].nunique()} teams."
        ],
        "type_table": type_tbl.to_dict(orient="records"),
        "team_table": team_tbl.to_dict(orient="records")
    }


# ─────────────────────────────────────────────────────────────────────────
# GET /api/video/{video_id}
# Returns single video record for Record Inspector
# ─────────────────────────────────────────────────────────────────────────
@app.get("/api/video/{video_id}")
def get_video(video_id: str):
    row = df[df["Video_ID"].astype(str) == video_id]
    if len(row) == 0:
        return {"error": "Video not found"}
    return row.iloc[0].to_dict()


# ─────────────────────────────────────────────────────────────────────────
# GET /api/export
# Downloads filtered data as CSV
# ─────────────────────────────────────────────────────────────────────────
@app.get("/api/export")
def export_csv(
    search:    str       = Query(default=""),
    published: str       = Query(default="All"),
    types:     list[str] = Query(default=[]),
    teams:     list[str] = Query(default=[]),
    users:     list[str] = Query(default=[]),
    platforms: list[str] = Query(default=[])
):
    filtered = apply_filters(
        search, published, types, teams, users, platforms
    )
    buf = io.StringIO()
    filtered.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition":
                "attachment; filename=frammer_export.csv"
        }
    )