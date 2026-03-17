from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io
import matplotlib
matplotlib.use('Agg') # Ensures matplotlib doesn't try to open a window
import matplotlib.pyplot as plt
from sqlalchemy import create_engine
import os

app = FastAPI(title="Tab 2 KPIs Analytics Engine (Like Tab 1)")

# 1. Setup Database Engine
# Expects tab2.db to be created by create_db.py
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tab2.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Setup Global Theming mirroring Tab 1
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

def dur_to_min(s):
    try:
        parts = str(s).strip().split(":")
        if len(parts) == 3:
            return int(parts[0])*60 + int(parts[1]) + int(parts[2])/60
        elif len(parts) == 2:
            return int(parts[0]) + int(parts[1])/60
        return 0.0
    except:
        return 0.0

# ------------------------------------------------------------------------
# ENDPOINT: Editorial Yield / Pipeline Wastage
# ------------------------------------------------------------------------
@app.get("/api/v2/graphs/01-editorial-yield")
def get_chart_editorial_yield():
    query = """
        SELECT f."Total Created", f."Total Published", f."Total Created Duration", d."Month_Name", d."Month_ID"
        FROM "Fact_Monthly" f JOIN "Dim_Month" d ON f."Month_ID" = d."Month_ID"
    """
    df_eff = pd.read_sql(query, con=engine)
    df_eff['Total Created Duration_min'] = df_eff['Total Created Duration'].apply(dur_to_min)
    df_eff = df_eff.sort_values('Month_ID')
    df_eff['Publish_Rate_Pct'] = (df_eff['Total Published'] / df_eff['Total Created'] * 100).fillna(0)
    df_eff['Avg_Created_Dur_Min'] = (df_eff['Total Created Duration_min'] / df_eff['Total Created']).fillna(0)

    fig, ax = plt.subplots(figsize=(16, 6))
    months = df_eff['Month_Name'].tolist()
    y_pos = np.arange(len(months))

    for idx in range(len(df_eff)):
        row = df_eff.iloc[idx]
        rate = row['Publish_Rate_Pct']
        col = RED if rate < 60 else (YELLOW if rate <= 80 else GREEN)
        ax.plot([row['Total Published'], row['Total Created']], [idx, idx], color=col, lw=3, zorder=1, alpha=0.6)

    sizes = 40 + (df_eff['Avg_Created_Dur_Min'] / df_eff['Avg_Created_Dur_Min'].max() * 300).fillna(0)
    ax.scatter(df_eff['Total Created'], y_pos, s=sizes, color=ACCENT, edgecolor='white', zorder=2, label="Started (Created)")
    ax.scatter(df_eff['Total Published'], y_pos, s=120, color=GREEN, marker='D', edgecolor='white', zorder=3, label="Finished (Published)")

    for idx, rate in enumerate(df_eff['Publish_Rate_Pct']):
        ax.text(df_eff.iloc[idx]['Total Published'] + max(df_eff['Total Created'])*0.02, idx, f"{rate:.1f}% Win Rate", va='center', color=GREEN, fontsize=10, fontweight="bold")

    ax.set_yticks(y_pos); ax.set_yticklabels(months); ax.invert_yaxis()
    ax.set_xlabel("Volume of Content (Units)")
    ax.set_title("The Efficiency Engine: Production Intake vs. Output\n(Line gap = Wastage. Blue size = Avg Video Length)", fontsize=13, color=ACCENT, fontweight="bold", pad=12)
    ax.legend(loc="upper right", facecolor=BG_CARD, edgecolor=BORDER, labelcolor="#C9D1D9")
    ax.grid(axis='x', alpha=0.3)
    plt.tight_layout()
    return _save_to_stream(fig)

# ------------------------------------------------------------------------
# ENDPOINT: Metadata Hygiene 
# ------------------------------------------------------------------------
@app.get("/api/v2/graphs/02-metadata-hygiene")
def get_chart_metadata_hygiene():
    query = 'SELECT * FROM "Fact_Video"'
    fact_video = pd.read_sql(query, con=engine)
    total_videos = len(fact_video)
    
    if total_videos > 0:
        url_col = 'Published URL' if 'Published URL' in fact_video.columns else fact_video.columns[-1]
        comp = {
            'Platform Tagged': 100 - ((fact_video['Platform_ID'].isna().sum() / total_videos) * 100),
            'URL Provided': 100 - ((fact_video[url_col].isna().sum() / total_videos) * 100),
            'Valid User Assigned': 100 - ((fact_video[fact_video['User_ID'] <= 0].shape[0] / total_videos) * 100) if 'User_ID' in fact_video.columns else 100,
            'Has Headline': 100 - ((fact_video['Headline'].isna().sum() / total_videos) * 100) if 'Headline' in fact_video.columns else 100
        }
        avg_health = np.mean(list(comp.values()))

        fig, ax = plt.subplots(figsize=(10, 5))
        categories = list(comp.keys())
        values = list(comp.values())
        colors = [GREEN if v > 90 else (YELLOW if v > 70 else RED) for v in values]
        bars = ax.barh(categories, values, color=colors, edgecolor=BG_DARK, height=0.55)
        for bar, val in zip(bars, values):
             ax.text(bar.get_width() + 2, bar.get_y() + bar.get_height()/2, f"{val:.1f}%", va="center", fontsize=10, color="#C9D1D9")

        ax.set_xlim(0, 115); ax.set_xlabel("Completeness (%)")
        ax.set_title(f"Metadata Hygiene & System Health Score\nAverage Health: {avg_health:.1f}%", fontsize=13, color=ACCENT, fontweight="bold", pad=12)
        ax.grid(axis='x', alpha=0.3)
        plt.tight_layout()
        return _save_to_stream(fig)

# ------------------------------------------------------------------------
# ENDPOINT: Content Expansion Factor
# ------------------------------------------------------------------------
@app.get("/api/v2/graphs/03-content-expansion-factor")
def get_chart_cef():
    query = """
        SELECT f."Total Created", f."Total Uploaded", d."Month_Name", d."Month_ID"
        FROM "Fact_Monthly" f JOIN "Dim_Month" d ON f."Month_ID" = d."Month_ID"
    """
    df_cef = pd.read_sql(query, con=engine).sort_values('Month_ID')
    df_cef['CEF'] = (df_cef['Total Created'] / df_cef['Total Uploaded'].replace(0, np.nan)).fillna(0)
    avg_cef = df_cef['CEF'].mean()

    fig, ax = plt.subplots(figsize=(16, 6))
    x_cef = np.arange(len(df_cef))
    bar_colors = [ORANGE if v >= avg_cef else PINK for v in df_cef['CEF']]
    bars_cef = ax.bar(x_cef, df_cef['CEF'], color=bar_colors, edgecolor=BG_DARK, width=0.6)

    for bar, val in zip(bars_cef, df_cef['CEF']):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1, f"{val:.2f}x", ha="center", color="#C9D1D9", fontsize=9)

    ax.axhline(avg_cef, color=YELLOW, linestyle='--', linewidth=2, label=f"Avg: {avg_cef:.2f}x")
    ax.set_xticks(x_cef); ax.set_xticklabels(df_cef['Month_Name'], rotation=35, ha="right")
    ax.set_title("Content Expansion Factor — AI Leverage Multiplier", fontsize=13, color=ACCENT, fontweight="bold", pad=12)
    ax.set_ylabel("CEF (Outputs per Upload)")
    ax.legend(facecolor=BG_CARD, edgecolor=BORDER, labelcolor="#C9D1D9")
    ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    return _save_to_stream(fig)

# ------------------------------------------------------------------------
# ENDPOINT: CEF By Input & Output
# ------------------------------------------------------------------------
@app.get("/api/v2/graphs/04-cef-in-out")
def get_chart_cef_in_out():
    query_in = 'SELECT f."Created Count", f."Uploaded Count", d."Input_Type_Name" FROM "Fact_Input_Type" f JOIN "Dim_Input_Type" d ON f."InputType_ID" = d."InputType_ID"'
    df_in = pd.read_sql(query_in, con=engine)
    df_in['CEF'] = (df_in['Created Count'] / df_in['Uploaded Count'].replace(0, np.nan)).fillna(0)
    df_in = df_in.sort_values(by='CEF', ascending=True)

    query_out = 'SELECT f."Created Count", f."Uploaded Count", d."Output_Type_Name" FROM "Fact_Output_Type" f JOIN "Dim_Output_Type" d ON f."OutputType_ID" = d."OutputType_ID"'
    df_out = pd.read_sql(query_out, con=engine)
    df_out['CEF'] = (df_out['Created Count'] / df_out['Uploaded Count'].replace(0, np.nan)).fillna(0)
    df_out = df_out.sort_values(by='CEF', ascending=True)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 6))
    
    # Input
    bars_in = ax1.barh(df_in['Input_Type_Name'], df_in['CEF'], color=ACCENT, edgecolor=BG_DARK, height=0.6)
    for bar, val in zip(bars_in, df_in['CEF']):
        ax1.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2, f"{val:.2f}x", va="center", color="#C9D1D9", fontsize=9)
    avg_in = df_in['CEF'].mean()
    ax1.axvline(avg_in, color=YELLOW, linestyle='--', linewidth=2, label=f"Avg: {avg_in:.2f}x")
    ax1.set_title("Input Efficiency (Outputs per Upload)", fontsize=12, color=ACCENT, fontweight="bold")
    ax1.set_xlim(0, df_in['CEF'].max() * 1.2); ax1.legend(loc="lower right", facecolor=BG_CARD, edgecolor=BORDER, labelcolor="#C9D1D9"); ax1.grid(axis='x', alpha=0.3)

    # Output
    bars_out = ax2.barh(df_out['Output_Type_Name'], df_out['CEF'], color=PURPLE, edgecolor=BG_DARK, height=0.6)
    for bar, val in zip(bars_out, df_out['CEF']):
        ax2.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2, f"{val:.2f}x", va="center", color="#C9D1D9", fontsize=9)
    ax2.set_title("Output Generation Format Density", fontsize=12, color=ACCENT, fontweight="bold")
    ax2.set_xlim(0, df_out['CEF'].max() * 1.2); ax2.grid(axis='x', alpha=0.3)

    plt.tight_layout()
    return _save_to_stream(fig)

# ------------------------------------------------------------------------
# ENDPOINT: Productivity and Duration Matrix
# ------------------------------------------------------------------------
@app.get("/api/v2/graphs/05-productivity-and-duration")
def get_chart_productivity_duration():
    query = 'SELECT f."Total Published", f."Total Uploaded Duration", f."Total Created Duration", f."Total Published Duration", d."Month_Name", d."Month_ID" FROM "Fact_Monthly" f JOIN "Dim_Month" d ON f."Month_ID" = d."Month_ID"'
    df_prod = pd.read_sql(query, con=engine).sort_values('Month_ID')
    total_users = int(pd.read_sql('SELECT COUNT(DISTINCT "User_ID") FROM "Fact_User_Summary"', engine).iloc[0, 0])
    
    df_prod['Active_Users'] = total_users
    df_prod['Productivity_Index'] = (df_prod['Total Published'] / df_prod['Active_Users']).fillna(0)
    df_prod['Uploaded_hr'] = df_prod['Total Uploaded Duration'].apply(dur_to_min) / 60
    df_prod['Created_hr'] = df_prod['Total Created Duration'].apply(dur_to_min) / 60
    df_prod['Published_hr'] = df_prod['Total Published Duration'].apply(dur_to_min) / 60

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 6))
    x_months = np.arange(len(df_prod))

    # Productivity
    bars_prod = ax1.bar(x_months, df_prod['Productivity_Index'], color=TEAL, edgecolor=BG_DARK, width=0.6)
    for bar, val in zip(bars_prod, df_prod['Productivity_Index']):
         ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02, f"{val:.2f}", ha='center', color="#C9D1D9", fontsize=9)
    ax1.set_xticks(x_months); ax1.set_xticklabels(df_prod['Month_Name'], rotation=35, ha='right')
    ax1.set_title("Monthly Productivity Index", fontsize=12, color=ACCENT, fontweight='bold'); ax1.grid(axis='y', alpha=0.3)

    # Duration footprint
    ax2.stackplot(x_months, df_prod['Uploaded_hr'], df_prod['Created_hr'], df_prod['Published_hr'], labels=['Uploaded', 'Created', 'Published'], colors=[ACCENT, YELLOW, GREEN], alpha=0.8)
    ax2.set_xticks(x_months); ax2.set_xticklabels(df_prod['Month_Name'], rotation=35, ha='right')
    ax2.set_title("Monthly Duration Footprint (Hours)", fontsize=12, color=ACCENT, fontweight='bold')
    ax2.legend(loc='upper left', facecolor=BG_CARD, edgecolor=BORDER, labelcolor="#C9D1D9"); ax2.grid(axis='y', alpha=0.3)

    plt.tight_layout()
    return _save_to_stream(fig)

@app.get("/")
def home():
    return {"message": "Welcome to Tab 2 API. Explore the graphs at /api/v2/graphs/* endpoints!"}
