import pandas as pd
import sqlite3
import os
import json
import re

# Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(os.path.dirname(BASE_DIR), "StarSchemaDB")
DB_PATH = os.path.join(BASE_DIR, "data", "frammer.db")
METADATA_PATH = os.path.join(BASE_DIR, "data", "schema_metadata.json")

def clean_column_name(col):
    """Clean column names: lower case, replace spaces/special chars with underscores."""
    c = col.strip().lower()
    c = re.sub(r'[^a-z0-9_]', '_', c)
    c = re.sub(r'_+', '_', c).strip('_')
    return c

def hms_to_seconds(hms_str):
    """Convert hh:mm:ss or mm:ss duration string to total seconds."""
    if pd.isna(hms_str) or not str(hms_str).strip() or hms_str == '0':
        return 0
    try:
        parts = str(hms_str).strip().split(':')
        if len(parts) == 3:
            h, m, s = map(int, parts)
            return h * 3600 + m * 60 + s
        elif len(parts) == 2:
            m, s = map(int, parts)
            return m * 60 + s
        return int(float(hms_str))
    except (ValueError, TypeError):
        return 0

def parse_month_name(month_name):
    """Parse 'Apr, 2025' into (month_num, year, quarter)."""
    match = re.match(r'(\w+),\s*(\d{4})', str(month_name))
    if not match:
        return None, None, None
    
    month_str, year = match.groups()
    months = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    }
    month_num = months.get(month_str[:3].title())
    if not month_num:
        return None, None, None
    
    year = int(year)
    quarter = (month_num - 1) // 3 + 1
    return month_num, year, quarter

def get_schema_metadata(conn):
    """Extract schema metadata using PRAGMA introspection."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    
    metadata = {}
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [{"name": c[1], "type": c[2], "pk": bool(c[5])} for c in cursor.fetchall()]
        
        cursor.execute(f"PRAGMA foreign_key_list({table})")
        fks = [{"table": f[2], "from": f[3], "to": f[4]} for f in cursor.fetchall()]
        
        metadata[table] = {
            "columns": columns,
            "foreign_keys": fks
        }
    return metadata

def etl():
    print(f"Starting ETL: {SOURCE_DIR} -> {DB_PATH}")
    
    if not os.path.exists(os.path.dirname(DB_PATH)):
        os.makedirs(os.path.dirname(DB_PATH))

    conn = sqlite3.connect(DB_PATH)
    
    # --- 1. Load Dimensions ---
    print("Loading dimensions...")
    dimensions = {
        'dim_channel': 'Dim_Channel.csv',
        'dim_user': 'Dim_User.csv',
        'dim_input_type': 'Dim_Input_Type.csv',
        'dim_output_type': 'Dim_Output_Type.csv',
        'dim_language': 'Dim_Language.csv',
        'dim_platform': 'Dim_Platform.csv',
        'dim_team': 'Dim_Team.csv',
        'dim_month': 'Dim_Month.csv'
    }

    # Pre-load Input Types for Fact_Video mapping
    df_it = pd.read_csv(os.path.join(SOURCE_DIR, dimensions['dim_input_type']))
    type_to_id = dict(zip(df_it['Input_Type_Name'], df_it['InputType_ID']))

    for table_name, csv_file in dimensions.items():
        df = pd.read_csv(os.path.join(SOURCE_DIR, csv_file))
        df.columns = [clean_column_name(c) for c in df.columns]
        
        if table_name == 'dim_month':
            # Add synthetic columns
            month_parts = df['month_name'].apply(lambda x: pd.Series(parse_month_name(x)))
            df['month_num'] = month_parts[0]
            df['year'] = month_parts[1]
            df['quarter'] = month_parts[2]
            
        df.to_sql(table_name, conn, if_exists='replace', index=False)
        print(f"  Loaded {table_name}")

    # --- 2. Load Facts ---
    print("Loading facts...")
    facts = {
        'fact_video': 'Fact_Video.csv',
        'fact_user_channel': 'Fact_User_Channel.csv',
        'fact_user_summary': 'Fact_User_Summary.csv',
        'fact_monthly': 'Fact_Monthly.csv',
        'fact_channel_publishing': 'Fact_Channel_Publishing.csv',
        'fact_input_type': 'Fact_Input_Type.csv',
        'fact_language': 'Fact_Language.csv',
        'fact_output_type': 'Fact_Output_Type.csv',
        'fact_user_monthly': 'Fact_User_Monthly.csv'
    }

    for table_name, csv_file in facts.items():
        df = pd.read_csv(os.path.join(SOURCE_DIR, csv_file))
        df.columns = [clean_column_name(c) for c in df.columns]

        # Table-specific logic
        if table_name == 'fact_video':
            # Handle Published mapping
            if 'published' in df.columns:
                df['published'] = df['published'].map({'Yes': 1, 'No': 0}).fillna(0).astype(int)
            # Handle Platform_ID cleaning
            if 'platform_id' in df.columns:
                df['platform_id'] = pd.to_numeric(df['platform_id'], errors='coerce')
            # Handle Type to InputType_ID mapping
            if 'type' in df.columns:
                df['inputtype_id'] = df['type'].map(type_to_id)
        
        # Duration parsing for all fact tables
        for col in df.columns:
            if 'duration' in col:
                df[col] = df[col].apply(hms_to_seconds)

        df.to_sql(table_name, conn, if_exists='replace', index=False)
        print(f"  Loaded {table_name}")

    # --- 3. Export Metadata ---
    print("Exporting schema metadata...")
    metadata = get_schema_metadata(conn)
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"  Metadata saved to {METADATA_PATH}")

    conn.close()
    print("\nETL COMPLETE.")

if __name__ == "__main__":
    etl()
