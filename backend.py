"""
ML Backend for Frammer Analytics Dashboard
- DBSCAN: clusters users/channels by behavior patterns
"""

import os
import pandas as pd
import numpy as np
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

import json

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

def sanitize_for_json(obj):
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return [sanitize_for_json(x) for x in obj]
    elif isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(x) for x in obj]
    else:
        return obj

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

# Global variables for data and model results
df_user_channel = None
df_user_summary = None
dim_user = {}
dim_channel = {}
dbscan_results = None

# =================== DATA LOADING ===================

def load_csv(filename):
    path = os.path.join(DATA_DIR, filename)
    return pd.read_csv(path)

def parse_duration(dur_str):
    """Convert 'hh:mm:ss' to total seconds."""
    if pd.isna(dur_str) or dur_str == '0:00:00':
        return 0
    parts = str(dur_str).split(':')
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    return 0

def load_dimensions():
    global dim_user, dim_channel
    df_dim_user = load_csv('Dim_User.csv')
    df_dim_channel = load_csv('Dim_Channel.csv')
    dim_user = dict(zip(df_dim_user['User_ID'].astype(int), df_dim_user['User_Name']))
    dim_channel = dict(zip(df_dim_channel['Channel_ID'].astype(int), df_dim_channel['Channel_Name']))

def load_facts():
    global df_user_channel, df_user_summary
    df_user_channel = load_csv('Fact_User_Channel.csv')
    df_user_summary = load_csv('Fact_User_Summary.csv')

# =================== ML MODELS ===================

def run_dbscan():
    """
    DBSCAN clustering on user behavior.
    Groups users into behavioral clusters based on their aggregate activity.
    """
    df = df_user_summary.copy()
    
    feature_cols = ['Uploaded Count', 'Created Count', 'Published Count']
    duration_cols = [
        'Uploaded Duration (hh:mm:ss)',
        'Created Duration (hh:mm:ss)',
        'Published Duration (hh:mm:ss)',
    ]

    for col in duration_cols:
        if col in df.columns:
            new_col = col.replace(' (hh:mm:ss)', '_sec')
            df[new_col] = df[col].apply(parse_duration)
            feature_cols.append(new_col)

    # Add derived features
    df['conversion_rate'] = np.where(
        df['Created Count'] > 0,
        df['Published Count'] / df['Created Count'],
        0
    )
    feature_cols.append('conversion_rate')

    X = df[feature_cols].fillna(0).values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Run DBSCAN
    # eps controls how close points must be to form a cluster
    # min_samples is the minimum cluster size
    dbscan = DBSCAN(eps=1.2, min_samples=2)
    df['cluster'] = dbscan.fit_predict(X_scaled)

    # Build cluster profiles
    clusters = {}
    for cluster_id in df['cluster'].unique():
        cluster_df = df[df['cluster'] == cluster_id]
        label = f'Cluster {cluster_id}' if cluster_id >= 0 else 'Outliers'
        
        clusters[int(cluster_id)] = {
            'id': int(cluster_id),
            'label': label,
            'size': len(cluster_df),
            'is_noise': bool(cluster_id == -1),
            'avg_uploaded': round(float(cluster_df['Uploaded Count'].mean()), 1),
            'avg_created': round(float(cluster_df['Created Count'].mean()), 1),
            'avg_published': round(float(cluster_df['Published Count'].mean()), 1),
            'avg_conversion': round(float(cluster_df['conversion_rate'].mean() * 100), 2),
            'total_uploaded': int(cluster_df['Uploaded Count'].sum()),
        }

    # Auto-label clusters based on activity level
    sorted_clusters = sorted(
        [c for c in clusters.values() if not c['is_noise']],
        key=lambda x: x['avg_uploaded'],
        reverse=True
    )
    
    activity_labels = ['🔥 Power Users', '⚡ Active Users', '📊 Moderate Users', 
                       '🌱 Light Users', '💤 Minimal Users']
    for i, cluster in enumerate(sorted_clusters):
        lbl = activity_labels[i] if i < len(activity_labels) else f'Group {i+1}'
        clusters[cluster['id']]['label'] = lbl

    if -1 in clusters:
        clusters[-1]['label'] = '🔴 Behavioral Outliers'

    # Build user assignments
    user_assignments = []
    for _, row in df.iterrows():
        user_id = int(row['User_ID'])
        cluster_id = int(row['cluster'])
        user_assignments.append({
            'user_id': user_id,
            'user_name': dim_user.get(user_id, f'User_{user_id}'),
            'cluster_id': cluster_id,
            'cluster_label': clusters[cluster_id]['label'],
            'is_outlier': bool(cluster_id == -1),
            'uploaded': int(row['Uploaded Count']),
            'created': int(row['Created Count']),
            'published': int(row['Published Count']),
            'conversion_rate': round(float(row['conversion_rate']) * 100, 2),
        })

    # Also cluster channels using Fact_User_Channel aggregated by channel
    channel_agg = df_user_channel.groupby('Channel_ID').agg({
        'Uploaded Count': 'sum',
        'Created Count': 'sum',
        'Published Count': 'sum',
    }).reset_index()

    channel_agg['conversion_rate'] = np.where(
        channel_agg['Created Count'] > 0,
        channel_agg['Published Count'] / channel_agg['Created Count'],
        0
    )

    if len(channel_agg) >= 3:
        X_ch = channel_agg[['Uploaded Count', 'Created Count', 'Published Count', 'conversion_rate']].values
        X_ch_scaled = StandardScaler().fit_transform(X_ch)
        ch_dbscan = DBSCAN(eps=1.5, min_samples=2)
        channel_agg['cluster'] = ch_dbscan.fit_predict(X_ch_scaled)
    else:
        channel_agg['cluster'] = 0

    channel_assignments = []
    for _, row in channel_agg.iterrows():
        ch_id = int(row['Channel_ID'])
        channel_assignments.append({
            'channel_id': ch_id,
            'channel_name': dim_channel.get(ch_id, f'Ch_{ch_id}'),
            'cluster_id': int(row['cluster']),
            'is_outlier': bool(int(row['cluster']) == -1),
            'uploaded': int(row['Uploaded Count']),
            'created': int(row['Created Count']),
            'published': int(row['Published Count']),
        })

    summary = {
        'model': 'DBSCAN',
        'user_clusters': len([c for c in clusters.values() if not c['is_noise']]),
        'user_outliers': clusters.get(-1, {}).get('size', 0),
        'total_users': len(df),
        'parameters': {
            'eps': 1.2,
            'min_samples': 2,
            'features_used': feature_cols,
        }
    }

    return {
        'clusters': clusters,
        'user_assignments': user_assignments,
        'channel_assignments': channel_assignments,
        'summary': summary
    }


# =================== INITIALIZATION ===================

print("Loading data...")
load_dimensions()
load_facts()

print("Running DBSCAN clustering...")
dbscan_results = run_dbscan()
print(f"  -> Found {dbscan_results['summary']['user_clusters']} user clusters + {dbscan_results['summary']['user_outliers']} outliers")

print("ML models ready!\n")


# =================== API ROUTES ===================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/clusters')
def get_clusters():
    """DBSCAN results: user clusters and channel clusters."""
    from flask import Response
    return Response(json.dumps(sanitize_for_json(dbscan_results)), mimetype='application/json')

@app.route('/api/health')
def health():
    from flask import Response
    data = {
        'status': 'ok',
        'models': ['DBSCAN'],
        'data_loaded': True,
        'users': len(dim_user),
        'channels': len(dim_channel),
    }
    return Response(json.dumps(sanitize_for_json(data)), mimetype='application/json')

# =================== RUN ===================

if __name__ == '__main__':
    print("=" * 50)
    print("  Frammer Analytics ML Backend")
    print("  http://localhost:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False)

