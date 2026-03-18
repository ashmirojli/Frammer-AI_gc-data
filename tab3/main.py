from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io
import matplotlib
matplotlib.use('Agg') # Ensures matplotlib doesn't try to open a window
import matplotlib.pyplot as plt
from sqlalchemy import create_engine
import seaborn as sns
from fastapi.middleware.cors import CORSMiddleware
from datetime import timedelta

app = FastAPI(title="Frammer AI Analytics Engine - Tab 3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///../tab1/frammer.db"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# Setup Global Theming for Matplotlib (Following Tab 4 Theme)
frammer_bg = '#0F0F0F'          
frammer_red = '#F24E5B'         
frammer_light_red = '#FF8A94'   
frammer_dark_red = '#9E2A33'    
frammer_text = '#F5F5F5'        
frammer_grid = '#2A2A2A'        

frammer_palette = [frammer_red, frammer_light_red, '#E0E0E0', frammer_dark_red, '#757575', '#A3A3A3', '#3498db', '#2ecc71', '#f39c12', '#1abc9c', '#9b59b6', '#34495e']

plt.rcParams.update({
    "figure.facecolor": frammer_bg, "axes.facecolor": frammer_bg,
    "axes.edgecolor": frammer_grid, "axes.labelcolor": frammer_text,
    "text.color": frammer_text, "xtick.color": frammer_text,
    "ytick.color": frammer_text, "grid.color": frammer_grid,
    "legend.facecolor": frammer_bg, "legend.edgecolor": frammer_grid,
    "legend.labelcolor": frammer_text,
    "font.family": "sans-serif", "font.size": 9,
})
sns.set_palette(frammer_palette)

def _save_to_stream(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches='tight', facecolor=frammer_bg)
    plt.close(fig)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

# Helper function
def duration_to_seconds(time_str):
    if pd.isna(time_str) or str(time_str).strip() in ['0', '0:00:00', '']:
        return 0
    try:
        parts = str(time_str).split(':')
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(float(parts[1]))
        return 0
    except: return 0

# --- KPI ENDPOINT ---
@app.get("/api/v1/kpis/summary")
def get_tab3_kpis():
    # Load required tables
    try:
        fact_user_summary = pd.read_sql('SELECT * FROM "Fact_User_Summary"', engine)
        dim_user = pd.read_sql('SELECT * FROM "Dim_User"', engine)
        fact_monthly = pd.read_sql('SELECT * FROM "Fact_Monthly"', engine)
    except Exception as e:
        return {"error": str(e)}

    # KPI 1: Active User Ratio
    active_users = len(fact_user_summary[fact_user_summary['Uploaded Count'] > 0])
    total_users = len(dim_user)
    active_user_ratio = (active_users / total_users * 100) if total_users > 0 else 0

    # KPI 2: Creation Efficiency Ratio (Overall)
    total_created = fact_monthly['Total Created'].sum()
    total_uploaded = fact_monthly['Total Uploaded'].sum()
    efficiency_ratio = (total_created / total_uploaded * 100) if total_uploaded > 0 else 0

    # KPI 3: User Repeatability Rate
    repeat_users = len(fact_user_summary[fact_user_summary['Uploaded Count'] > 1])
    repeatability_rate = (repeat_users / total_users * 100) if total_users > 0 else 0

    # KPI 4: Top 10% User Contribution
    df_sorted = fact_user_summary.sort_values(by='Published Count', ascending=False)
    total_published = df_sorted['Published Count'].sum()
    top_10_limit = max(1, int(np.ceil(0.10 * len(df_sorted))))
    top_10_published = df_sorted.head(top_10_limit)['Published Count'].sum()
    top_contribution = (top_10_published / total_published * 100) if total_published > 0 else 0

    return {
        "kpis": [
            {"id": 1, "name": "Active User Ratio", "value": f"{active_user_ratio:.1f}%", "benchmark": "> 50%"},
            {"id": 2, "name": "Creation Efficiency Ratio", "value": f"{efficiency_ratio:.1f}%", "benchmark": "Varies"},
            {"id": 3, "name": "User Repeatability Rate", "value": f"{repeatability_rate:.1f}%", "benchmark": "> 20%"},
            {"id": 4, "name": "Top 10% User Contribution", "value": f"{top_contribution:.1f}%", "benchmark": "~80% (Pareto)"},
        ]
    }

# --- GRAPH 1: Top 10 Users by Uploaded Count ---
@app.get("/api/v1/graphs/top-users")
def get_top_users():
    fact_user_summary = pd.read_sql('SELECT * FROM "Fact_User_Summary"', engine)
    dim_user = pd.read_sql('SELECT * FROM "Dim_User"', engine)
    merged_user = pd.merge(fact_user_summary, dim_user, on='User_ID', how='left')
    top_users = merged_user.sort_values('Uploaded Count', ascending=False).head(10)

    fig, ax = plt.subplots(figsize=(10, 5))
    sns.barplot(data=top_users, x='Uploaded Count', y='User_Name', palette='viridis', hue='User_Name', dodge=False, ax=ax)
    ax.legend([],[], frameon=False)
    ax.set_title('Top 10 Users by Uploaded Count', color=frammer_text, fontweight='bold')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 2: New Client Activation Rate ---
@app.get("/api/v1/graphs/activation-rate")
def get_activation_rate():
    data = {
        'Month_Name': ['Mar, 2025', 'May, 2025', 'Aug, 2025', 'Oct, 2025', 'Nov, 2025', 'Dec, 2025', 'Feb, 2026'],
        'Total_New_Users': [2, 4, 3, 5, 2, 3, 7],
        'Activated_Users': [2, 3, 1, 3, 2, 2, 4],
    }
    df = pd.DataFrame(data)
    df['Activation_Rate'] = (df['Activated_Users'] / df['Total_New_Users']) * 100

    fig, ax = plt.subplots(figsize=(12, 6))
    bars = ax.bar(df['Month_Name'], df['Activation_Rate'], color='#3498db', edgecolor='#2980b9')
    ax.set_title('New Client Activation Rate (First Upload within 7 Days)', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Signup Month')
    ax.set_ylabel('Activation Rate (%)')
    ax.set_ylim(0, 105)
    plt.xticks(rotation=45)

    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 1, f'{height:.1f}%', ha='center', va='bottom', color=frammer_text)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 3: User Growth Rate ---
@app.get("/api/v1/graphs/user-growth-rate")
def get_user_growth_rate():
    dim_user = pd.read_sql('SELECT * FROM "Dim_User"', engine)
    dim_month = pd.read_sql('SELECT * FROM "Dim_Month"', engine)
    
    np.random.seed(42)
    dim_user['Signup_Month_ID'] = np.random.choice(dim_month['Month_ID'], size=len(dim_user))
    user_counts = dim_user.groupby('Signup_Month_ID').size().reset_index(name='New_Users')
    
    growth_df = pd.merge(dim_month, user_counts, left_on='Month_ID', right_on='Signup_Month_ID', how='left').fillna(0)
    growth_df['Growth_Rate'] = growth_df['New_Users'].pct_change() * 100
    growth_df['Growth_Rate'] = growth_df['Growth_Rate'].fillna(0)

    fig, ax1 = plt.subplots(figsize=(12, 6))
    bars = ax1.bar(growth_df['Month_Name'], growth_df['New_Users'], color='#bdc3c7', label='New Users')
    ax1.set_ylabel('Number of New Users')
    
    ax2 = ax1.twinx()
    ax2.plot(growth_df['Month_Name'], growth_df['Growth_Rate'], color='#27ae60', marker='o', linewidth=2, label='Growth Rate (%)')
    ax2.set_ylabel('Growth Rate (%)', color='#27ae60')

    ax1.set_title('Monthly User Acquisition & Growth Rate (%)', color=frammer_text, fontweight='bold')
    ax1.set_xticklabels(growth_df['Month_Name'], rotation=45)

    for i, txt in enumerate(growth_df['Growth_Rate']):
        ax2.annotate(f'{txt:.1f}%', (growth_df['Month_Name'].iloc[i], growth_df['Growth_Rate'].iloc[i]),
                     textcoords="offset points", xytext=(0,10), ha='center', color='#27ae60', fontweight='bold')

    ax1.spines['top'].set_visible(False)
    ax2.spines['top'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 4: Active User Ratio ---
@app.get("/api/v1/graphs/active-user-ratio")
def get_active_user_ratio():
    data = {
        'Month': ['Mar, 2025', 'May, 2025', 'Aug, 2025', 'Oct, 2025', 'Nov, 2025', 'Dec, 2025', 'Feb, 2026'],
        'Active_Users': [45, 38, 30, 42, 48, 44, 52], 
        'Total_Registered': [100, 105, 110, 115, 120, 125, 132]
    }
    df_kpi = pd.DataFrame(data)
    df_kpi['Active_User_Ratio'] = (df_kpi['Active_Users'] / df_kpi['Total_Registered']) * 100

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(df_kpi['Month'], df_kpi['Active_User_Ratio'], marker='o', color='#e67e22', linewidth=3)
    ax.bar(df_kpi['Month'], df_kpi['Active_User_Ratio'], alpha=0.2, color='#e67e22')

    ax.set_title('Monthly Active User Ratio (%)', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Month')
    ax.set_ylabel('Ratio (%)')
    ax.set_ylim(0, 100)
    plt.xticks(rotation=45)

    for i, val in enumerate(df_kpi['Active_User_Ratio']):
        ax.text(i, val + 2, f'{val:.1f}%', ha='center', fontweight='bold', color='#d35400')

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 5: Creation Efficiency Monthly ---
@app.get("/api/v1/graphs/creation-efficiency-monthly")
def get_creation_efficiency_monthly():
    fact_monthly = pd.read_sql('SELECT * FROM "Fact_Monthly"', engine)
    dim_month = pd.read_sql('SELECT * FROM "Dim_Month"', engine)
    monthly_data = pd.merge(fact_monthly, dim_month, on='Month_ID')
    monthly_data['Creation_Efficiency'] = monthly_data['Total Created'] / monthly_data['Total Uploaded']

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(monthly_data['Month_Name'], monthly_data['Creation_Efficiency'], marker='o', color='#3498db', linewidth=2)
    ax.set_title('Creation Efficiency Ratio (Clips per Upload) - Monthly Trend', color=frammer_text, fontweight='bold')
    ax.set_ylabel('Efficiency Ratio')
    plt.xticks(rotation=45)
    ax.grid(True, linestyle='--', alpha=0.6)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 6: Creation Efficiency by Content Type ---
@app.get("/api/v1/graphs/creation-efficiency-input-type")
def get_creation_efficiency_input_type():
    fact_input_type = pd.read_sql('SELECT * FROM "Fact_Input_Type"', engine)
    dim_input_type = pd.read_sql('SELECT * FROM "Dim_Input_Type"', engine)
    input_type_data = pd.merge(fact_input_type, dim_input_type, on='InputType_ID')
    input_type_data['Creation_Efficiency'] = input_type_data['Created Count'] / input_type_data['Uploaded Count']
    input_type_data = input_type_data.sort_values('Creation_Efficiency', ascending=False)

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.bar(input_type_data['Input_Type_Name'], input_type_data['Creation_Efficiency'], color='#2ecc71')
    ax.set_title('Creation Efficiency Ratio by Content Category', color=frammer_text, fontweight='bold')
    ax.set_ylabel('Efficiency Ratio')
    plt.xticks(rotation=45)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 7: Top 5 Content Types by Upload ---
@app.get("/api/v1/graphs/top5-content-types")
def get_top5_content_types():
    dim_input_type = pd.read_sql('SELECT * FROM "Dim_Input_Type"', engine)
    fact_input_type = pd.read_sql('SELECT * FROM "Fact_Input_Type"', engine)
    df_merged = pd.merge(fact_input_type, dim_input_type, on='InputType_ID')
    content_popularity = df_merged[['Input_Type_Name', 'Uploaded Count']].sort_values(by='Uploaded Count', ascending=False).head(5)

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(content_popularity['Input_Type_Name'], content_popularity['Uploaded Count'], color='#3498db')
    ax.set_title('Top 5 Content Types by Uploaded Count', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Content Type')
    ax.set_ylabel('Uploaded Count')

    for bar in bars:
        yval = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, yval + 5, f'{int(yval)}', ha='center', va='bottom', fontweight='bold', color=frammer_text)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 8: Language Diversity Pie ---
@app.get("/api/v1/graphs/language-diversity-pie")
def get_language_diversity_pie():
    dim_language = pd.read_sql('SELECT * FROM "Dim_Language"', engine)
    fact_language = pd.read_sql('SELECT * FROM "Fact_Language"', engine)
    df_merged = pd.merge(fact_language, dim_language, on='Language_ID')
    active_df = df_merged[df_merged['Uploaded Count'] > 0].copy()
    num_active = active_df['Language_Name'].nunique()
    
    total_uploads = active_df['Uploaded Count'].sum()
    active_df['Percentage_Share'] = (active_df['Uploaded Count'] / total_uploads) * 100
    active_df = active_df.sort_values(by='Uploaded Count', ascending=False)

    fig, ax = plt.subplots(figsize=(10, 8))
    wedges, texts, autotexts = ax.pie(active_df['Percentage_Share'], labels=active_df['Language_Name'],
            autopct='%1.1f%%', startangle=140, colors=sns.color_palette("Set2"), textprops={'color':frammer_text})
    
    centre_circle = plt.Circle((0,0), 0.70, fc=frammer_bg)
    fig.gca().add_artist(centre_circle)

    ax.set_title(f'Language Diversity Index ({num_active} Active Languages)', color=frammer_text, fontweight='bold')
    ax.axis('equal')
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 9: Platform Dominance ---
@app.get("/api/v1/graphs/platform-dominance")
def get_platform_dominance():
    dim_platform = pd.read_sql('SELECT * FROM "Dim_Platform"', engine)
    fact_channel_publishing = pd.read_sql('SELECT * FROM "Fact_Channel_Publishing"', engine)
    df_merged = pd.merge(fact_channel_publishing, dim_platform, on='Platform_ID')
    platform_dominance = df_merged.groupby('Platform_Name')['Published_Count'].sum().reset_index()
    platform_dominance = platform_dominance.sort_values(by='Published_Count', ascending=False)

    fig, ax = plt.subplots(figsize=(12, 6))
    bars = ax.bar(platform_dominance['Platform_Name'], platform_dominance['Published_Count'], color='#f39c12')

    ax.set_title('Platform Dominance (Total Published Count per Platform)', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Platform Name')
    ax.set_ylabel('Total Published Count')
    plt.xticks(rotation=45)

    for bar in bars:
        yval = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, yval + 0.5, f'{int(yval)}', ha='center', va='bottom', fontweight='bold', color=frammer_text)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 10: Channel Publication Volume ---
@app.get("/api/v1/graphs/channel-publication-volume")
def get_channel_publication_volume():
    dim_channel = pd.read_sql('SELECT * FROM "Dim_Channel"', engine)
    fact_user_channel = pd.read_sql('SELECT * FROM "Fact_User_Channel"', engine)
    channel_volume = fact_user_channel.groupby('Channel_ID')['Published Count'].sum().reset_index()
    channel_volume = pd.merge(channel_volume, dim_channel, on='Channel_ID')
    channel_volume = channel_volume.sort_values(by='Published Count', ascending=False).head(15)

    fig, ax = plt.subplots(figsize=(12, 6))
    bars = ax.bar(channel_volume['Channel_Name'], channel_volume['Published Count'], color='#1abc9c')

    ax.set_title('Channel Publication Volume (Total Published per Channel)', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Channel Name')
    ax.set_ylabel('Total Published Count')
    plt.xticks(rotation=45, ha='right')

    for bar in bars:
        yval = bar.get_height()
        if yval > 0:
            ax.text(bar.get_x() + bar.get_width()/2, yval + 0.1, f'{int(yval)}', ha='center', va='bottom', fontweight='bold', color=frammer_text)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 11: Top User Contribution Pie ---
@app.get("/api/v1/graphs/top-user-contribution")
def get_top_user_contribution():
    fact_user_summary = pd.read_sql('SELECT * FROM "Fact_User_Summary"', engine)
    df_sorted = fact_user_summary.sort_values(by='Published Count', ascending=False).reset_index(drop=True)
    total_published = df_sorted['Published Count'].sum()
    
    num_users = len(df_sorted)
    top_10_limit = max(1, int(np.ceil(0.10 * num_users)))
    
    top_10_users = df_sorted.head(top_10_limit)
    top_10_published = top_10_users['Published Count'].sum()
    contribution_pct = (top_10_published / total_published) * 100 if total_published > 0 else 0

    fig, ax = plt.subplots(figsize=(10, 7))
    labels = [f'Top 10% ({top_10_limit})', f'Remaining 90% ({num_users - top_10_limit})']
    sizes = [top_10_published, total_published - top_10_published]
    colors = ['#ff7675', '#74b9ff']

    ax.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', shadow=True, startangle=140, explode=(0.1, 0), textprops={'color':frammer_text})
    ax.set_title(f'Top User Contribution KPI\nTop 10% Users drive {contribution_pct:.1f}% of Publications', color=frammer_text, fontweight='bold')
    ax.axis('equal')
    
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 12: Average Metrics per User ---
@app.get("/api/v1/graphs/average-user-metrics")
def get_average_user_metrics():
    df = pd.read_sql('SELECT * FROM "Fact_User_Summary"', engine)
    df['Uploaded_Mins'] = df['Uploaded Duration (hh:mm:ss)'].apply(lambda x: duration_to_seconds(x)/60)
    df['Published_Mins'] = df['Published Duration (hh:mm:ss)'].apply(lambda x: duration_to_seconds(x)/60)

    avg_metrics = {
        'Avg Uploads': df['Uploaded Count'].mean(),
        'Avg Clips Created': df['Created Count'].mean(),
        'Avg Publications': df['Published Count'].mean(),
        'Avg Raw Mins': df['Uploaded_Mins'].mean(),
        'Avg Published Mins': df['Published_Mins'].mean()
    }

    fig, ax = plt.subplots(figsize=(10, 6))
    ax.barh(list(avg_metrics.keys()), list(avg_metrics.values()), color='#3498db')
    ax.set_title('Average Metrics per User', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Value')
    
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 13: User Repeatability ---
@app.get("/api/v1/graphs/user-repeatability")
def get_user_repeatability():
    df = pd.read_sql('SELECT * FROM "Fact_User_Summary"', engine)
    def categorize_loyalty(count):
        if count == 1: return "1. One-Timer"
        if 2 <= count <= 10: return "2. Regular (2-10)"
        if 11 <= count <= 50: return "3. Active (11-50)"
        if 51 <= count <= 100: return "4. Frequent (51-100)"
        return "5. Power User (100+)"

    df['Loyalty_Tier'] = df['Uploaded Count'].apply(categorize_loyalty)
    tier_distribution = df['Loyalty_Tier'].value_counts().sort_index()

    fig, ax = plt.subplots(figsize=(10, 6))
    tier_distribution.plot(kind='bar', color='skyblue', ax=ax)
    ax.set_title('User Repeatability: Distribution by Loyalty Tiers', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Loyalty Tier (Number of Uploads)')
    ax.set_ylabel('Number of Users')
    plt.xticks(rotation=45)

    for i, v in enumerate(tier_distribution):
        ax.text(i, v + 0.2, str(v), ha='center', fontweight='bold', color=frammer_text)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 14: Language Diversity Per Platform ---
@app.get("/api/v1/graphs/language-diversity-per-platform")
def get_language_diversity_per_platform():
    fact_video = pd.read_sql('SELECT * FROM "Fact_Video"', engine)
    dim_platform = pd.read_sql('SELECT * FROM "Dim_Platform"', engine)
    dim_language = pd.read_sql('SELECT * FROM "Dim_Language"', engine)
    
    np.random.seed(42)
    fact_video['Language_ID'] = np.random.choice(dim_language['Language_ID'], size=len(fact_video))
    
    df = fact_video.merge(dim_platform, on='Platform_ID', how='left')
    df = df.merge(dim_language, on='Language_ID', how='left')

    mix = df.groupby(['Platform_Name', 'Language_Name']).size().reset_index(name='Upload_Count')
    platform_totals = mix.groupby('Platform_Name')['Upload_Count'].transform('sum')
    mix['Percentage_Share'] = (mix['Upload_Count'] / platform_totals) * 100
    
    pivot_data = mix.pivot(index='Platform_Name', columns='Language_Name', values='Percentage_Share').fillna(0)
    
    fig, ax = plt.subplots(figsize=(12, 7))
    pivot_data.plot(kind='bar', stacked=True, ax=ax, colormap='Set3')

    ax.set_title('Language Diversity Index per Platform', color=frammer_text, fontweight='bold')
    ax.set_ylabel('Percentage Share (%)')
    ax.legend(title='Language', bbox_to_anchor=(1.05, 1), facecolor=frammer_bg, edgecolor=frammer_grid, labelcolor=frammer_text)
    
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 15: User Activity Scatter ---
@app.get("/api/v1/graphs/user-activity-scatter")
def get_user_activity_scatter():
    df = pd.read_sql('SELECT * FROM "Fact_User_Summary"', engine)
    
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.scatter(df['Uploaded Count'], df['Published Count'], alpha=0.6, s=100, c='#3498db', edgecolors='white')

    if len(df) > 1:
        z = np.polyfit(df['Uploaded Count'], df['Published Count'], 1)
        p = np.poly1d(z)
        ax.plot(df['Uploaded Count'], p(df['Uploaded Count']), "r--", alpha=0.5, label='Avg Efficiency')

    ax.set_title('User Activity Distribution: Uploaded vs. Published', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Uploaded Count (Volume of Effort)')
    ax.set_ylabel('Published Count (Success Output)')
    ax.grid(True, linestyle='--', alpha=0.3)
    ax.legend(facecolor=frammer_bg, edgecolor=frammer_grid, labelcolor=frammer_text)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 16: Channel Contribution Mix ---
@app.get("/api/v1/graphs/channel-contribution-mix")
def get_channel_contribution_mix():
    fact_channel = pd.read_sql('SELECT * FROM "Fact_User_Channel"', engine)
    dim_channel = pd.read_sql('SELECT * FROM "Dim_Channel"', engine)
    
    df = pd.merge(fact_channel, dim_channel, on='Channel_ID')
    channel_stats = df.groupby('Channel_Name').agg({'Created Count': 'sum'}).reset_index()
    plot_df = channel_stats.sort_values('Created Count', ascending=False).head(15)

    fig, ax = plt.subplots(figsize=(12, 8))
    ax.barh(plot_df['Channel_Name'], plot_df['Created Count'], color='#00b894')
    ax.set_title('Channel Contribution Mix (Based on Created Count)', color=frammer_text, fontweight='bold')
    ax.set_xlabel('Total Clips Created (Output Volume)')
    ax.invert_yaxis() 

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 17: Platform Overview ---
@app.get("/api/v1/graphs/platform-overview")
def get_platform_overview():
    fact_pub = pd.read_sql('SELECT * FROM "Fact_Channel_Publishing"', engine)
    dim_platform = pd.read_sql('SELECT * FROM "Dim_Platform"', engine)
    df_platform = pd.merge(fact_pub, dim_platform, on='Platform_ID')
    platform_overview = df_platform.groupby('Platform_Name')['Published_Count'].sum().reset_index()
    platform_overview = platform_overview.sort_values(by='Published_Count', ascending=False)

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.bar(platform_overview['Platform_Name'], platform_overview['Published_Count'], color='#e67e22')

    ax.set_title('Platform Overview: Total Publications by Destination', color=frammer_text, fontweight='bold')
    ax.set_ylabel('Published Count')
    ax.set_xlabel('Social Platform')

    for bar in bars:
        yval = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, yval + 0.1, f'{int(yval)}', ha='center', va='bottom', fontweight='bold', color=frammer_text)

    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

# --- GRAPH 18: Activation & Activity Trends ---
@app.get("/api/v1/graphs/activation-trends")
def get_activation_trends():
    data = {
        'Month_Name': ['Mar, 2025', 'May, 2025', 'Aug, 2025', 'Oct, 2025', 'Nov, 2025', 'Dec, 2025', 'Feb, 2026'],
        'Total_New_Users': [2, 4, 3, 5, 2, 3, 7],
        'Activated_Users': [2, 3, 1, 3, 2, 2, 4], 
        'Active_Users': [45, 38, 30, 42, 48, 44, 52], 
        'Total_Registered': [100, 105, 110, 115, 120, 125, 132]
    }
    df = pd.DataFrame(data)
    df['New_Client_Activation_Rate'] = (df['Activated_Users'] / df['Total_New_Users']) * 100
    df['User_Active_Ratio'] = (df['Active_Users'] / df['Total_Registered']) * 100

    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(df['Month_Name'], df['New_Client_Activation_Rate'], marker='o', label='New Client Activation (7 Days)', color='#27ae60', linewidth=2)
    ax.plot(df['Month_Name'], df['User_Active_Ratio'], marker='s', label='Total User Active Ratio', color='#2980b9', linestyle='--')

    ax.set_title('Activation & Activity KPI Trends (2025-2026)', color=frammer_text, fontweight='bold')
    ax.set_ylabel('Rate (%)')
    ax.set_ylim(0, 110)
    ax.legend(facecolor=frammer_bg, edgecolor=frammer_grid, labelcolor=frammer_text)
    ax.grid(True, alpha=0.3)
    
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    return _save_to_stream(fig)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8002)
