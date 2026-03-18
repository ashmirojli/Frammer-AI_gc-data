import pandas as pd
import os

BASE = os.path.join(os.path.dirname(__file__), "StarSchemaDB")

def load_master_df():

    # ── Load fact table ───────────────────────────────────────────────
    df = pd.read_csv(os.path.join(BASE, "Fact_Video.csv"))

    # ── Load dimensions ───────────────────────────────────────────────
    dim_user     = pd.read_csv(os.path.join(BASE, "Dim_User.csv"))
    dim_team     = pd.read_csv(os.path.join(BASE, "Dim_Team.csv"))
    dim_platform = pd.read_csv(os.path.join(BASE, "Dim_Platform.csv"))

    # ── Join ──────────────────────────────────────────────────────────
    df = df.merge(dim_user,     on="User_ID",     how="left")
    df = df.merge(dim_team,     on="Team_ID",     how="left")
    df = df.merge(dim_platform, on="Platform_ID", how="left")

    # ── Rename columns ────────────────────────────────────────────────
    df = df.rename(columns={"Video ID": "Video_ID"})

    # ── Fill nulls with readable values ──────────────────────────────
    df["Headline"]      = df["Headline"].fillna("(No Headline)")
    df["Type"]          = df["Type"].fillna("Unknown")
    df["User_Name"]     = df["User_Name"].fillna("Unknown User")
    df["Team_Name"]     = df["Team_Name"].fillna("Unknown Team")
    df["Platform_Name"] = df["Platform_Name"].fillna("—")
    df["Published URL"] = df["Published URL"].fillna("—")

    # ── Rename Published URL ──────────────────────────────────────────
    df = df.rename(columns={"Published URL": "Published_URL"})

    # ── Drop raw ID columns ───────────────────────────────────────────
    df = df.drop(
        columns=["User_ID", "Team_ID", "Platform_ID"],
        errors="ignore"
    )

    # ── Final column order ────────────────────────────────────────────
    df = df[[
        "Video_ID",
        "Headline",
        "Type",
        "Published",
        "User_Name",
        "Team_Name",
        "Platform_Name",
        "Source",
        "Published_URL",
    ]]

    return df