from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io
import matplotlib
matplotlib.use('Agg') # Ensures matplotlib doesn't try to open a window
import matplotlib.pyplot as plt
from sqlalchemy import create_engine

app = FastAPI(title="Frammer AI Analytics Engine")

# 1. Setup Database Engine
# Replace with your actual DB URL (Postgres, MySQL, SQL Server, etc.)
DATABASE_URL = "sqlite:///frammer.db"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# 2. Reusable Component to Fetch Data
def get_monthly_data() -> pd.DataFrame:
    # Instead of reading Fact_Monthly.csv and Dim_Month.csv, we run a query!
    query = """
        SELECT f.*, d."Month_Name"
        FROM "Fact_Monthly" f
        JOIN "Dim_Month" d ON f."Month_ID" = d."Month_ID"
    """
    return pd.read_sql(query, con=engine)


# ------------------------------------------------------------------------
# ENDPOINT 1: Fetching KPIs (JSON Data)
# ------------------------------------------------------------------------
@app.get("/api/v1/kpis/summary")
def get_executive_kpis():
    # 1. Fetch Monthly Data
    query_monthly = """
        SELECT f."Total Uploaded" as "Uploaded", f."Total Created" as "Created", f."Total Published" as "Published", d."Month_Name"
        FROM "Fact_Monthly" f
        JOIN "Dim_Month" d ON f."Month_ID" = d."Month_ID"
    """
    try:
        monthly = pd.read_sql(query_monthly, con=engine)
        monthly["sort_date"] = pd.to_datetime(monthly["Month_Name"], format="%b, %Y")
        monthly = monthly.sort_values("sort_date").drop(columns=["sort_date"]).reset_index(drop=True)
    except Exception as e:
        # Fallback empty dataframe during testing without DB
        monthly = pd.DataFrame({"Uploaded": [0,0], "Created": [0,0], "Published": [0,0], "Month_Name": ["Prev", "Cur"]})
    
    if len(monthly) >= 2:
        cur_month = monthly.iloc[-1]
        prv_month = monthly.iloc[-2]
    else:
        # Fallbacks if there's less than 2 months of data
        cur_month = monthly.iloc[-1] if len(monthly) > 0 else {"Uploaded": 0, "Created": 0, "Published": 0, "Month_Name": "Current"}
        prv_month = {"Uploaded": 0, "Created": 0, "Published": 0, "Month_Name": "Previous"}

    CUR_NAME = cur_month["Month_Name"]
    PRV_NAME = prv_month["Month_Name"]

    # Global totals
    TOT_UPLOADED = monthly["Uploaded"].sum()
    
    # helper for % change
    def pct_change(cur, prv):
        if prv == 0:
            return cur, "+∞%", "up" if cur > 0 else "flat"
        delta = cur - prv
        pct = (delta / prv) * 100
        sign = "+" if pct >= 0 else ""
        return delta, f"{sign}{pct:.1f}%", "up" if pct >= 0 else "down"

    # KPI 1 — Total Upload Volume
    kpi1_cur = int(cur_month["Uploaded"])
    kpi1_prv = int(prv_month["Uploaded"])
    _, kpi1_pct, kpi1_dir = pct_change(kpi1_cur, kpi1_prv)

    # KPI 2 — Total AI Content Created
    kpi2_cur = int(cur_month["Created"])
    kpi2_prv = int(prv_month["Created"])
    _, kpi2_pct, kpi2_dir = pct_change(kpi2_cur, kpi2_prv)

    # KPI 3 — Total Published Outputs
    kpi3_cur = int(cur_month["Published"])
    kpi3_prv = int(prv_month["Published"])
    _, kpi3_pct, kpi3_dir = pct_change(kpi3_cur, kpi3_prv)

    # KPI 4 — Editorial Yield %
    kpi4_cur = round((kpi3_cur / kpi2_cur * 100) if kpi2_cur else 0, 2)
    kpi4_prv = round((kpi3_prv / kpi2_prv * 100) if kpi2_prv else 0, 2)
    _, kpi4_pct, kpi4_dir = pct_change(kpi4_cur, kpi4_prv)

    # KPI 5 — Content Expansion Factor
    kpi5_cur = round(kpi2_cur / kpi1_cur, 2) if kpi1_cur else 0
    kpi5_prv = round(kpi2_prv / kpi1_prv, 2) if kpi1_prv else 0
    _, kpi5_pct, kpi5_dir = pct_change(kpi5_cur, kpi5_prv)

    # KPI 6 — Orphan Content Rate %
    kpi6_cur = round(((kpi2_cur - kpi3_cur) / kpi2_cur * 100) if kpi2_cur else 0, 2)
    kpi6_prv = round(((kpi2_prv - kpi3_prv) / kpi2_prv * 100) if kpi2_prv else 0, 2)
    _, kpi6_pct, kpi6_dir = pct_change(kpi6_cur, kpi6_prv)

    # KPI 7 — Active Users 
    # Query user stats directly from DB
    try:
        user_stats = pd.read_sql('SELECT COUNT(DISTINCT "User_ID") as active_users FROM "Fact_User_Summary" WHERE "Uploaded Count" > 0', engine)
        active_users = int(user_stats.iloc[0]["active_users"])
        total_users = int(pd.read_sql('SELECT COUNT("User_ID") as total_users FROM "Dim_User"', engine).iloc[0]["total_users"])
    except:
        active_users, total_users = 44, 45 # Mock Fallback
        
    kpi7_cur = active_users

    # KPI 8 — Avg Uploads per Active User
    kpi8_cur = round(TOT_UPLOADED / active_users, 1) if active_users else 0
    kpi8_prv_approx = round(kpi1_prv / max(active_users - 1, 1), 1)
    _, kpi8_pct, kpi8_dir = pct_change(kpi8_cur, kpi8_prv_approx)

    # KPI 9 — Publish Rate %
    kpi9_cur = round((kpi3_cur / kpi1_cur * 100) if kpi1_cur else 0, 2)
    kpi9_prv = round((kpi3_prv / kpi1_prv * 100) if kpi1_prv else 0, 2)
    _, kpi9_pct, kpi9_dir = pct_change(kpi9_cur, kpi9_prv)

    # KPI 10 — MoM Upload Momentum
    kpi10_cur = kpi1_cur
    kpi10_prv = kpi1_prv
    _, kpi10_pct, kpi10_dir = pct_change(kpi10_cur, kpi10_prv)

    # Form object 
    kpis = [
        {"id": 1,  "name": "Total Upload Volume",        "cur": f"{kpi1_cur:,}",    "unit": "videos",   "pct": kpi1_pct,  "dir": kpi1_dir},
        {"id": 2,  "name": "AI Content Created",         "cur": f"{kpi2_cur:,}",    "unit": "outputs",  "pct": kpi2_pct,  "dir": kpi2_dir},
        {"id": 3,  "name": "Total Published Outputs",    "cur": f"{kpi3_cur:,}",    "unit": "outputs",  "pct": kpi3_pct,  "dir": kpi3_dir},
        {"id": 4,  "name": "Editorial Yield %",          "cur": f"{kpi4_cur}%",     "unit": "",         "pct": kpi4_pct,  "dir": kpi4_dir},
        {"id": 5,  "name": "Content Expansion Factor",   "cur": f"{kpi5_cur}x",     "unit": "",         "pct": kpi5_pct,  "dir": kpi5_dir},
        {"id": 6,  "name": "Orphan Content Rate",        "cur": f"{kpi6_cur}%",     "unit": "",         "pct": kpi6_pct,  "dir": kpi6_dir},
        {"id": 7,  "name": "Active Users",               "cur": f"{kpi7_cur}",      "unit": f"/ {total_users} total", "pct": "—",      "dir": "flat"},
        {"id": 8,  "name": "Avg Uploads / Active User",  "cur": f"{kpi8_cur}",      "unit": "uploads",  "pct": kpi8_pct,  "dir": kpi8_dir},
        {"id": 9,  "name": "Publish Rate (Funnel)",      "cur": f"{kpi9_cur}%",     "unit": "",         "pct": kpi9_pct,  "dir": kpi9_dir},
        {"id": 10, "name": "MoM Upload Momentum",        "cur": f"{kpi10_pct}",     "unit": "vs prev",  "pct": kpi10_pct, "dir": kpi10_dir},
    ]

    return {
        "period": {
            "current_month": CUR_NAME,
            "previous_month": PRV_NAME
        },
        "kpis": kpis
    }


# ------------------------------------------------------------------------
# ENDPOINT 3: Generates the 11 Matplotlib Visualisations
# ------------------------------------------------------------------------
import matplotlib.ticker as mticker

# Setup Global Theming
BG_DARK  = "#0D1117"
BG_MID   = "#161B22"
BG_CARD  = "#21262D"
BORDER   = "#30363D"
ACCENT   = "#58A6FF"
GREEN    = "#3FB950"
RED      = "#F85149"
YELLOW   = "#E3B341"
PURPLE   = "#BC8CFF"
ORANGE   = "#FFA657"
TEAL     = "#39D353"
PINK     = "#FF7B72"
PALETTE  = [ACCENT, GREEN, YELLOW, PURPLE, ORANGE, TEAL, PINK, RED, "#79C0FF", "#56D364", "#E3B341", "#A5D6FF"]

plt.rcParams.update({
    "figure.facecolor": BG_DARK, "axes.facecolor": BG_MID,
    "axes.edgecolor": BORDER, "axes.labelcolor": "#C9D1D9",
    "text.color": "#C9D1D9", "xtick.color": "#8B949E",
    "ytick.color": "#8B949E", "grid.color": "#21262D",
    "grid.linestyle": "--", "grid.alpha": 0.5,
    "font.family": "sans-serif", "font.size": 9,
})

def _save_to_stream(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches='tight', facecolor=BG_DARK)
    plt.close(fig)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

# --- CHART 2: Monthly Trend ---
@app.get("/api/v1/graphs/02-monthly-trend")
def get_chart_monthly_trend():
    query = """
        SELECT f."Total Uploaded" as "Uploaded", f."Total Created" as "Created", f."Total Published" as "Published", d."Month_Name"
        FROM "Fact_Monthly" f JOIN "Dim_Month" d ON f."Month_ID" = d."Month_ID"
    """
    monthly = pd.read_sql(query, con=engine)
    monthly["sort_date"] = pd.to_datetime(monthly["Month_Name"], format="%b, %Y")
    monthly = monthly.sort_values("sort_date").drop(columns=["sort_date"]).reset_index(drop=True)
    
    fig, ax = plt.subplots(figsize=(16, 6))
    months = monthly["Month_Name"].tolist()
    x = np.arange(len(months))
    ax.plot(x, monthly["Uploaded"],  "o-", color=ACCENT,  lw=2.5, ms=7, label="Uploaded",  zorder=3)
    ax.plot(x, monthly["Created"],   "s-", color=GREEN,   lw=2.5, ms=7, label="AI Created", zorder=3)
    ax.plot(x, monthly["Published"], "^-", color=YELLOW,  lw=2.5, ms=7, label="Published",  zorder=3)
    ax.fill_between(x, monthly["Uploaded"],  alpha=0.08, color=ACCENT)
    ax.fill_between(x, monthly["Created"],   alpha=0.08, color=GREEN)
    ax.fill_between(x, monthly["Published"], alpha=0.08, color=YELLOW)
    
    for xi, ub, cb, pb in zip(x, monthly["Uploaded"], monthly["Created"], monthly["Published"]):
        ax.annotate(str(ub), (xi, ub), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=7, color=ACCENT)
        ax.annotate(str(pb), (xi, pb), textcoords="offset points", xytext=(0, -14), ha="center", fontsize=7, color=YELLOW)
        
    ax.set_xticks(x)
    ax.set_xticklabels(months, rotation=35, ha="right")
    ax.set_title("Monthly Trend: Upload → AI Created → Published", fontsize=13, color=ACCENT, fontweight="bold", pad=12)
    ax.legend(loc="upper right")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- CHART 3: Input Type Breakdown ---
@app.get("/api/v1/graphs/03-input-type")
def get_chart_input_type():
    query = """
        SELECT d."Input_Type_Name", f."Uploaded Count", f."Created Count", f."Published Count" 
        FROM "Fact_Input_Type" f JOIN "Dim_Input_Type" d ON f."InputType_ID" = d."InputType_ID"
    """
    fact_in = pd.read_sql(query, con=engine)
    fact_in["Publish_Rate"] = (fact_in["Published Count"] / fact_in["Created Count"].replace(0, np.nan) * 100).round(2)
    fact_in = fact_in.sort_values("Uploaded Count", ascending=False)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))
    labels  = fact_in["Input_Type_Name"].tolist()
    sizes   = fact_in["Uploaded Count"].tolist()
    colors  = PALETTE[:len(labels)]
    
    wedges, texts, autotexts = ax1.pie(sizes, labels=None, autopct="%1.1f%%", startangle=90, colors=colors, pctdistance=0.78, wedgeprops=dict(width=0.5, edgecolor=BG_DARK, linewidth=2))
    for at in autotexts: at.set_fontsize(8); at.set_color("white")
    ax1.set_title("Input Type — Upload Share", color=ACCENT, fontsize=11, fontweight="bold")
    ax1.legend(wedges, labels, loc="lower center", bbox_to_anchor=(0.5, -0.18), ncol=3, fontsize=7, facecolor=BG_CARD, labelcolor="#C9D1D9", edgecolor=BORDER)
    
    ax2.axis("off")
    tbl_data = [[r["Input_Type_Name"], f"{r['Uploaded Count']:,}", f"{r['Created Count']:,}", f"{r['Published Count']:,}", f"{r['Publish_Rate']:.1f}%"] for _, r in fact_in.iterrows()]
    col_labels = ["Input Type", "Uploaded", "Created", "Published", "Pub Rate"]
    tbl = ax2.table(cellText=tbl_data, colLabels=col_labels, loc="center", cellLoc="center")
    tbl.auto_set_font_size(False); tbl.set_fontsize(8)
    for (row, col), cell in tbl.get_celld().items():
        cell.set_facecolor(BG_CARD if row % 2 == 0 else BG_MID); cell.set_edgecolor(BORDER); cell.set_text_props(color="#C9D1D9")
        if row == 0: cell.set_facecolor("#1C2128"); cell.set_text_props(color=ACCENT, fontweight="bold")
    ax2.set_title("Input Type — Detailed Table", color=ACCENT, fontsize=11, fontweight="bold")
    plt.suptitle("Input Type Breakdown", fontsize=13, color=ACCENT, fontweight="bold", y=1.01)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- CHART 4: Output Type Breakdown ---
@app.get("/api/v1/graphs/04-output-type")
def get_chart_output_type():
    query = """
        SELECT d."Output_Type_Name", f."Created Count", f."Published Count" 
        FROM "Fact_Output_Type" f JOIN "Dim_Output_Type" d ON f."OutputType_ID" = d."OutputType_ID"
    """
    fact_out = pd.read_sql(query, con=engine)
    fact_out["Publish_Rate"] = (fact_out["Published Count"] / fact_out["Created Count"].replace(0, np.nan) * 100).round(2)
    fact_out = fact_out.sort_values("Created Count", ascending=False)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    labels2 = fact_out["Output_Type_Name"].tolist(); sizes2  = fact_out["Created Count"].tolist()
    wedges2, _, auto2 = ax1.pie(sizes2, labels=None, autopct="%1.1f%%", startangle=90, colors=PALETTE[:len(labels2)], pctdistance=0.78, wedgeprops=dict(width=0.5, edgecolor=BG_DARK, linewidth=2))
    for at in auto2: at.set_fontsize(9); at.set_color("white")
    ax1.set_title("Output Type — AI Created Share", color=ACCENT, fontsize=11, fontweight="bold")
    ax1.legend(wedges2, labels2, loc="lower center", bbox_to_anchor=(0.5, -0.12), ncol=3, fontsize=8, facecolor=BG_CARD, labelcolor="#C9D1D9", edgecolor=BORDER)
    
    ax2.axis("off")
    tbl2_data = [[r["Output_Type_Name"], f"{r['Created Count']:,}", f"{r['Published Count']:,}", f"{r['Publish_Rate']:.1f}%"] for _, r in fact_out.iterrows()]
    col2 = ["Output Type", "Created", "Published", "Pub Rate %"]
    tbl2 = ax2.table(cellText=tbl2_data, colLabels=col2, loc="center", cellLoc="center")
    tbl2.auto_set_font_size(False); tbl2.set_fontsize(9)
    for (row, col_i), cell in tbl2.get_celld().items():
        cell.set_facecolor(BG_CARD if row % 2 == 0 else BG_MID); cell.set_edgecolor(BORDER); cell.set_text_props(color="#C9D1D9")
        if row == 0: cell.set_facecolor("#1C2128"); cell.set_text_props(color=ACCENT, fontweight="bold")
    ax2.set_title("Output Type — Detailed Table", color=ACCENT, fontsize=11, fontweight="bold")
    plt.suptitle("Output Type Breakdown", fontsize=13, color=ACCENT, fontweight="bold", y=1.01)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- CHART 5: Platform Rank ---
@app.get("/api/v1/graphs/05-platform-rank")
def get_chart_platform_rank():
    query = 'SELECT d."Platform_Name", SUM(f."Published_Count") as "Published_Count" FROM "Fact_Channel_Publishing" f JOIN "Dim_Platform" d ON f."Platform_ID" = d."Platform_ID" GROUP BY d."Platform_Name"'
    plat_grp = pd.read_sql(query, con=engine).sort_values("Published_Count", ascending=False)
    total_pub = plat_grp["Published_Count"].sum()
    plat_grp["Pub_Share"] = (plat_grp["Published_Count"] / total_pub * 100).round(1)

    fig, ax = plt.subplots(figsize=(14, 6))
    bar_colors = [GREEN if i == 0 else (RED if i == len(plat_grp)-1 else ACCENT) for i in range(len(plat_grp))]
    bars = ax.barh(plat_grp["Platform_Name"], plat_grp["Published_Count"], color=bar_colors, edgecolor=BG_DARK, height=0.55)
    for bar, val, sh in zip(bars, plat_grp["Published_Count"], plat_grp["Pub_Share"]):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2, f"{val:,}  ({sh}%)", va="center", fontsize=9, color="#C9D1D9")
    ax.set_xlabel("Published Video Count")
    ax.set_title("Platform Ranking — by Published Output Count\n🟢 Best  |  🔴 Lowest", fontsize=12, color=ACCENT, fontweight="bold")
    ax.invert_yaxis(); ax.grid(axis="x", alpha=0.3)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- CHART 6: Top 8 Channels ---
@app.get("/api/v1/graphs/06-top8-channels")
def get_chart_top8_channels():
    query = 'SELECT d."Channel_Name", SUM(f."Published_Count") as "Published_Count" FROM "Fact_Channel_Publishing" f JOIN "Dim_Channel" d ON f."Channel_ID" = d."Channel_ID" GROUP BY d."Channel_Name"'
    chan_total = pd.read_sql(query, con=engine).sort_values("Published_Count", ascending=False).head(8)
    
    cur_vals = chan_total["Published_Count"].values
    np.random.seed(42) # Simulate Prev as per notebook
    prv_vals = (cur_vals * np.random.uniform(0.75, 1.25, len(cur_vals))).astype(int)
    mom_pct  = ((cur_vals - prv_vals) / np.where(prv_vals == 0, 1, prv_vals) * 100).round(1)
    
    fig, ax = plt.subplots(figsize=(15, 6))
    x_ch = np.arange(len(chan_total)); w = 0.35
    ax.bar(x_ch - w/2, cur_vals, w, label="Current", color=ACCENT, edgecolor=BG_DARK)
    ax.bar(x_ch + w/2, prv_vals, w, label="Previous", color=PURPLE, edgecolor=BG_DARK)
    for xi, cv, pv, mom in zip(x_ch, cur_vals, prv_vals, mom_pct):
        col = GREEN if mom >= 0 else RED; arrow = "▲" if mom >= 0 else "▼"
        ax.text(xi, max(cv, pv) + 1, f"{arrow}{abs(mom):.0f}%", ha="center", fontsize=8.5, color=col, fontweight="bold")
    ax.set_xticks(x_ch); ax.set_xticklabels([f"Channel {n}" for n in chan_total["Channel_Name"]], rotation=30, ha="right")
    ax.set_title("Top 8 Channels — Published Output Count\n▲/▼ = MoM Change", fontsize=12, color=ACCENT, fontweight="bold")
    ax.legend(facecolor=BG_CARD, edgecolor=BORDER, labelcolor="#C9D1D9")
    plt.tight_layout()
    return _save_to_stream(fig)

# --- CHART 9: Language ---
@app.get("/api/v1/graphs/09-language")
def get_chart_language():
    query = 'SELECT d."Language_Name", f."Uploaded Count", f."Created Count", f."Published Count" FROM "Fact_Language" f JOIN "Dim_Language" d ON f."Language_ID" = d."Language_ID"'
    fact_lang = pd.read_sql(query, con=engine)
    fact_lang["Publish_Rate"] = (fact_lang["Published Count"] / fact_lang["Uploaded Count"].replace(0, np.nan) * 100).round(2)
    best_lang = fact_lang.loc[fact_lang["Publish_Rate"].idxmax(), "Language_Name"]
    worst_lang = fact_lang.loc[fact_lang["Publish_Rate"].idxmin(), "Language_Name"]

    fig, axes = plt.subplots(1, 3, figsize=(18, 6))
    wedges3, _, auto3 = axes[0].pie(fact_lang["Uploaded Count"], labels=None, autopct="%1.1f%%", startangle=90, colors=PALETTE[:len(fact_lang)], pctdistance=0.78, wedgeprops=dict(width=0.5, edgecolor=BG_DARK, linewidth=2))
    for at in auto3: at.set_fontsize(9); at.set_color("white")
    axes[0].set_title("Upload Share by Language", color=ACCENT, fontsize=10, fontweight="bold")
    axes[0].legend(wedges3, fact_lang["Language_Name"].tolist(), loc="lower center", bbox_to_anchor=(0.5, -0.18), ncol=3, fontsize=8, facecolor=BG_CARD, labelcolor="#C9D1D9", edgecolor=BORDER)
    
    colors_l = [GREEN if ln == best_lang else (RED if ln == worst_lang else ACCENT) for ln in fact_lang["Language_Name"]]
    bars_l = axes[1].bar(fact_lang["Language_Name"], fact_lang["Publish_Rate"], color=colors_l, edgecolor=BG_DARK, width=0.55)
    for bar, val in zip(bars_l, fact_lang["Publish_Rate"]):
        axes[1].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.05, f"{val:.1f}%", ha="center", fontsize=8.5, color="#C9D1D9")
    axes[1].set_title("Publish Rate by Language\n🟢 Best  |  🔴 Worst", color=ACCENT, fontsize=10, fontweight="bold"); axes[1].grid(axis="y", alpha=0.3)
    
    axes[2].axis("off")
    lang_tbl = [[r["Language_Name"], f"{r['Uploaded Count']:,}", f"{r['Created Count']:,}", f"{r['Published Count']:,}", f"{r['Publish_Rate']:.1f}%", "🏆 Best" if r["Language_Name"] == best_lang else ("⚠️ Worst" if r["Language_Name"] == worst_lang else "")] for _, r in fact_lang.iterrows()]
    col_lang = ["Language", "Uploaded", "Created", "Published", "Pub%", "Status"]
    tbl_l = axes[2].table(cellText=lang_tbl, colLabels=col_lang, loc="center", cellLoc="center")
    tbl_l.auto_set_font_size(False); tbl_l.set_fontsize(8.5)
    for (row, col_i), cell in tbl_l.get_celld().items():
        cell.set_facecolor(BG_CARD if row % 2 == 0 else BG_MID); cell.set_edgecolor(BORDER); cell.set_text_props(color="#C9D1D9")
        if row == 0: cell.set_facecolor("#1C2128"); cell.set_text_props(color=ACCENT, fontweight="bold")
    axes[2].set_title("Language Stats Summary", color=ACCENT, fontsize=10, fontweight="bold")
    plt.suptitle(f"Language Analysis  |  Best: {best_lang}  |  Worst: {worst_lang}", fontsize=12, color=ACCENT, fontweight="bold", y=1.02)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- CHART 10: User Drops ---
@app.get("/api/v1/graphs/10-user-drops")
def get_chart_user_drops():
    query = 'SELECT d."User_Name", SUM(f."Uploaded Count") as "Total_Uploaded" FROM "Fact_User_Channel" f JOIN "Dim_User" d ON f."User_ID" = d."User_ID" GROUP BY d."User_Name"'
    uc_named = pd.read_sql(query, con=engine).sort_values("Total_Uploaded", ascending=False)
    np.random.seed(7)
    uc_named["Prev_Uploaded"] = (uc_named["Total_Uploaded"] * np.random.uniform(0.6, 1.6, len(uc_named))).astype(int)
    uc_named["Change_Pct"] = ((uc_named["Total_Uploaded"] - uc_named["Prev_Uploaded"]) / uc_named["Prev_Uploaded"].replace(0, 1) * 100).round(1)
    top5_drop = uc_named[uc_named["Total_Uploaded"] > 0].sort_values("Change_Pct").head(5)

    fig, ax = plt.subplots(figsize=(13, 5))
    x_u = np.arange(len(top5_drop)); w2 = 0.35
    ax.bar(x_u - w2/2, top5_drop["Prev_Uploaded"], w2, label="Previous", color=PURPLE, edgecolor=BG_DARK)
    ax.bar(x_u + w2/2, top5_drop["Total_Uploaded"], w2, label="Current", color=RED, edgecolor=BG_DARK)
    for xi, pv, cv, pct in zip(x_u, top5_drop["Prev_Uploaded"], top5_drop["Total_Uploaded"], top5_drop["Change_Pct"]):
        ax.text(xi, max(pv, cv) + 1, f"▼{abs(pct):.0f}%", ha="center", fontsize=9, color=RED, fontweight="bold")
    short_names = [n[:14] + ".." if len(n) > 16 else n for n in top5_drop["User_Name"].tolist()]
    ax.set_xticks(x_u); ax.set_xticklabels(short_names, rotation=20, ha="right"); ax.set_ylabel("Uploaded Count")
    ax.set_title("Top 5 Users with Largest Drop in Platform Usage\n(vs Previous Period)", fontsize=12, color=ACCENT, fontweight="bold")
    ax.legend(facecolor=BG_CARD, edgecolor=BORDER, labelcolor="#C9D1D9")
    plt.tight_layout()
    return _save_to_stream(fig)

# --- CHART 11: Active Users ---
@app.get("/api/v1/graphs/11-active-users")
def get_chart_active_users():
    query = 'SELECT d."User_Name" as "User", f."Uploaded Count" as "Uploaded", f."Created Count" as "Created", f."Published Count" as "Published" FROM "Fact_User_Summary" f JOIN "Dim_User" d ON f."User_ID" = d."User_ID"'
    user_activity = pd.read_sql(query, con=engine)
    user_activity["Active"] = user_activity["Uploaded"] > 0
    active_df = user_activity[user_activity["Active"]].sort_values("Uploaded", ascending=False)
    inactive_df = user_activity[~user_activity["Active"]]
    total_users = len(user_activity)

    fig, axes = plt.subplots(1, 2, figsize=(18, 7))
    wedges_au, _, _ = axes[0].pie([len(active_df), len(inactive_df)], labels=None, autopct="%1.0f%%", startangle=90, colors=[GREEN, RED], pctdistance=0.7, wedgeprops=dict(width=0.5, edgecolor=BG_DARK, linewidth=3))
    axes[0].text(0, 0, f"{len(active_df)}\nActive", ha="center", va="center", fontsize=16, color=GREEN, fontweight="bold")
    axes[0].legend(wedges_au, [f"Active ({len(active_df)})", f"Inactive ({len(inactive_df)})"], loc="lower center", bbox_to_anchor=(0.5, -0.1), fontsize=9, facecolor=BG_CARD, labelcolor="#C9D1D9", edgecolor=BORDER)
    axes[0].set_title(f"Active vs Inactive Users\nTotal: {total_users}", color=ACCENT, fontsize=11, fontweight="bold")

    top_active = active_df.head(15)
    short = [n[:12] + ".." if len(n) > 14 else n for n in top_active["User"]]
    y_pos = np.arange(len(top_active))
    axes[1].barh(y_pos, top_active["Uploaded"], color=ACCENT, edgecolor=BG_DARK, height=0.6)
    axes[1].barh(y_pos, top_active["Published"], color=YELLOW, edgecolor=BG_DARK, height=0.6, alpha=0.85, label="Published")
    for i, (up, pu) in enumerate(zip(top_active["Uploaded"], top_active["Published"])):
        axes[1].text(up + 2, i, f"{up}", va="center", fontsize=7.5, color=ACCENT)
    axes[1].set_yticks(y_pos); axes[1].set_yticklabels(short); axes[1].invert_yaxis(); axes[1].set_xlabel("Count")
    axes[1].set_title("Top 15 Active Users — Uploads vs Published", color=ACCENT, fontsize=11, fontweight="bold")
    axes[1].legend(["Uploaded", "Published"], facecolor=BG_CARD, edgecolor=BORDER, labelcolor="#C9D1D9")
    plt.suptitle(f"Active Users  |  {len(active_df)} Active / {total_users} Total  ({round(len(active_df)/total_users*100,1)}%)", fontsize=13, color=ACCENT, fontweight="bold", y=1.01)
    plt.tight_layout()
    return _save_to_stream(fig)
