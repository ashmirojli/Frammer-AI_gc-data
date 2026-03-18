import sqlite3
import pandas as pd
import json
import os
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "frammer.db")
BASELINE_MODEL_PATH = os.path.join(BASE_DIR, "models", "historical_baseline.json")

def generate_historical_baseline():
    """
    Phase 1: Generates a baseline probability distribution based on real historical aggregates.
    
    Since we don't have video-level OutputType labels, we calculate a global 
    'prior' distribution from Fact_Output_Type (overall platform success) and
    Fact_Input_Type (to identify input volume). 
    """
    if not os.path.exists(os.path.dirname(BASELINE_MODEL_PATH)):
        os.makedirs(os.path.dirname(BASELINE_MODEL_PATH))
        
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    
    # 1. Get the aggregate 'Published Count' for each Output Type across the entire platform.
    # We use this as our global 'Wisdom of the Crowd' prior.
    query_output = """
    SELECT outputtype_id, published_count
    FROM fact_output_type
    WHERE outputtype_id IS NOT NULL
    """
    df_out = pd.read_sql(query_output, conn)
    conn.close()
    
    if len(df_out) == 0:
        print("Error: No aggregate output type data found.")
        return
        
    # Calculate the global probability distribution for output types
    total_published = df_out['published_count'].sum()
    
    baseline_probs = {}
    
    if total_published > 0:
        for _, row in df_out.iterrows():
            out_id = int(row['outputtype_id'])
            # Laplace smoothing (+1) to ensure no output type starts with exactly 0.0 probability
            prob = (row['published_count'] + 1) / (total_published + len(df_out))
            baseline_probs[out_id] = float(prob)
    else:
        # Fallback to uniform distribution if no historical publishes exist
        print("Warning: Total published count is 0. Falling back to uniform baseline.")
        num_types = len(df_out)
        for _, row in df_out.iterrows():
            baseline_probs[int(row['outputtype_id'])] = 1.0 / num_types

    # Ensure probabilities strictly sum to 1.0
    total_prob = sum(baseline_probs.values())
    for k in baseline_probs:
        baseline_probs[k] = baseline_probs[k] / total_prob
        
    print("Global Baseline Probabilities Calculated:")
    for out_id, prob in baseline_probs.items():
        print(f"  OutputType {out_id}: {prob:.2%}")
        
    with open(BASELINE_MODEL_PATH, 'w') as f:
        json.dump(baseline_probs, f, indent=4)
        
    print(f"Saved baseline model to {BASELINE_MODEL_PATH}")

if __name__ == "__main__":
    generate_historical_baseline()
