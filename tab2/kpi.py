import pandas as pd
import numpy as np
import plotly.graph_objects as go
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

def duration_to_seconds(time_str):
    if pd.isna(time_str) or time_str == 0 or time_str == '0':
        return 0
    try:
        parts = str(time_str).split(':')
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(float(parts[1]))
        return 0
    except:
        return 0

def prep_duration_cols(df):
    for col in ['Total Uploaded Duration', 'Total Created Duration', 'Total Published Duration']:
        if col in df.columns:
            df[f'{col}_sec'] = df[col].apply(duration_to_seconds)
    return df

def visualize_publishing_efficiency_story(fact_monthly, dim_month):
    df = fact_monthly.merge(dim_month, on='Month_ID', how='left')
    if 'Month_ID' in df.columns:
        df = df.sort_values('Month_ID')

    df['Publish_Rate_Pct'] = (df['Total Published'] / df['Total Created'] * 100).fillna(0)
    df['Drop_off_Count'] = df['Total Created'] - df['Total Published']
    df['Avg_Created_Dur_Min'] = (df['Total Created Duration_sec'] / df['Total Created']).fillna(0) / 60

    fig = go.Figure()

    for i, row in df.iterrows():
        rate = row['Publish_Rate_Pct']
        if rate < 60:
            line_color = 'rgba(239, 85, 59, 0.4)'
        elif rate <= 80:
            line_color = 'rgba(255, 161, 90, 0.5)'
        else:
            line_color = 'rgba(0, 204, 150, 0.5)'

        fig.add_trace(go.Scatter(
            x=[row['Total Published'], row['Total Created']],
            y=[row['Month_Name'], row['Month_Name']],
            mode='lines',
            line=dict(color=line_color, width=5),
            showlegend=False,
            hoverinfo='skip'
        ))

    marker_sizes = 10 + (df['Avg_Created_Dur_Min'] / df['Avg_Created_Dur_Min'].max() * 15).fillna(0)

    fig.add_trace(go.Scatter(
        x=df['Total Created'],
        y=df['Month_Name'],
        mode='markers',
        name='Started (Total Created)',
        marker=dict(color='#636EFA', size=marker_sizes, symbol='circle', line=dict(color='white', width=1)),
        hovertemplate="<b>%{y}</b> Pipeline Intake<br>"
                      "Volume Created: %{x}<br>"
                      "Avg File Duration: %{customdata[0]:.1f} mins<extra></extra>",
        customdata=df[['Avg_Created_Dur_Min']]
    ))

    fig.add_trace(go.Scatter(
        x=df['Total Published'],
        y=df['Month_Name'],
        mode='markers+text',
        name='Finished (Total Published)',
        marker=dict(color='#00CC96', size=14, symbol='diamond', line=dict(color='white', width=1)),
        text=df['Publish_Rate_Pct'].apply(lambda x: f" {x:.1f}% Win Rate"),
        textposition='middle right',
        textfont=dict(color='#00CC96', size=11, family="Arial Bold"),
        hovertemplate="<b>%{y}</b> Final Output<br>"
                      "Volume Published: %{x}<br>"
                      "Drop-off/Wastage: %{customdata[0]} videos lost<extra></extra>",
        customdata=df[['Drop_off_Count']]
    ))

    fig.update_layout(
        title="<b>The Efficiency Engine: Production Intake vs. Output</b><br>"
              "<sup>A wider physical gap means higher drop-off. Blue bubble size = Average Created Video Length.</sup>",
        xaxis_title="Volume of Content (Units)",
        yaxis_title="",
        template="plotly_dark",
        legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="right", x=1),
        yaxis=dict(autorange="reversed", showgrid=False),
        xaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.1)'),
        height=500
    )
    return fig

def visualize_data_health_radar(fact_video):
    total = len(fact_video)
    if total == 0:
        return go.Figure()

    url_col = 'Published URL' if 'Published URL' in fact_video.columns else fact_video.columns[-1]

    completeness = {
        'Platform Tagged': 100 - ((fact_video['Platform_ID'].isna().sum() / total) * 100),
        'URL Provided': 100 - ((fact_video[url_col].isna().sum() / total) * 100),
        'Valid User Assigned': 100 - ((fact_video[fact_video['User_ID'] <= 0].shape[0] / total) * 100),
        'Has Headline': 100 - ((fact_video['Headline'].isna().sum() / total) * 100) if 'Headline' in fact_video.columns else 100
    }

    categories = list(completeness.keys())
    values = list(completeness.values())

    categories.append(categories[0])
    values.append(values[0])
    
    fig = go.Figure()
    avg_health = np.mean(values[:-1])
    fill_color = "rgba(0, 204, 150, 0.4)" if avg_health > 90 else ("rgba(255, 161, 90, 0.4)" if avg_health > 70 else "rgba(239, 85, 59, 0.4)")
    line_color = fill_color.replace("0.4", "1.0")
    
    fig.add_trace(go.Scatterpolar(
        r=values,
        theta=categories,
        fill='toself',
        fillcolor=fill_color,
        line=dict(color=line_color, width=3),
        name='Current Status'
    ))
    
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 100],
                tickfont=dict(size=10, color="gray")
            )
        ),
        title="<b>Metadata Hygiene & System Health Score</b><br><sup>Target: 100% across all axes</sup>",
        template="plotly_dark",
        showlegend=False
    )

    fig.add_annotation(
        x=0.5, y=0.5, align="center",
        text=f"<b>{avg_health:.0f}%</b>",
        showarrow=False, font=dict(size=40, color=line_color)
    )
    return fig

def visualize_content_expansion_factor(fact_monthly, fact_output_type, dim_month, dim_output):
    df = fact_monthly.merge(dim_month, on='Month_ID', how='left')
    if 'Month_ID' in df.columns:
        df = df.sort_values('Month_ID')

    df['CEF'] = (df['Total Created'] / df['Total Uploaded'].replace(0, np.nan)).fillna(0)

    total_uploaded = df['Total Uploaded'].sum()
    total_created  = df['Total Created'].sum()
    overall_cef    = total_created / total_uploaded if total_uploaded else 0
    avg_cef        = df['CEF'].mean()

    peak_row  = df.loc[df['CEF'].idxmax()]
    
    if len(df['CEF']) >= 3:
        last3       = df['CEF'].tail(3).values
        trend_dir   = "RISING ▲" if last3[-1] > last3[0] else "FALLING ▼"
    else:
        trend_dir   = "FLAT"

    output_df = fact_output_type.merge(dim_output, on='OutputType_ID', how='left')
    output_df['ratio'] = output_df['Created Count'] / total_uploaded if total_uploaded else 0

    OUTPUT_COLORS = ['#F5A623', '#1D9E75', '#A78BFA', '#4FC3F7', '#D85A30']

    fig = go.Figure()
    bar_colors = ['#F5A623' if v >= avg_cef else '#D85A30' for v in df['CEF']]

    fig.add_trace(go.Bar(
        x=df['Month_Name'],
        y=df['CEF'],
        name='CEF',
        marker=dict(color=bar_colors, line=dict(width=0)),
        width=0.6,
        hovertemplate="<b>%{x}</b><br>"
                      "CEF: <b>%{y:.2f}×</b><br>"
                      "Uploaded: %{customdata[0]}<br>"
                      "Created: %{customdata[1]}<extra></extra>",
        customdata=df[['Total Uploaded', 'Total Created']]
    ))

    fig.add_trace(go.Scatter(
        x=df['Month_Name'],
        y=[avg_cef] * len(df),
        mode='lines',
        name=f'Avg {avg_cef:.2f}×',
        line=dict(color='#7A7E94', width=1.5, dash='dash'),
        hoverinfo='skip'
    ))

    fig.add_annotation(
        x=peak_row['Month_Name'],
        y=peak_row['CEF'] + 0.1,
        text=f"Peak {peak_row['CEF']:.2f}×",
        showarrow=False,
        font=dict(size=11, color='#F5A623'),
        bgcolor='#1E2028',
        borderpad=4
    )

    fig.update_layout(
        title=f"<b>Content Expansion Factor — AI Leverage Multiplier</b><br>"
              f"<sup>Overall CEF: {overall_cef:.2f}× &nbsp;|&nbsp; "
              f"Peak: {peak_row['CEF']:.2f}× ({peak_row['Month_Name']}) &nbsp;|&nbsp; "
              f"Trend: {trend_dir}</sup>",
        xaxis_title="Month",
        yaxis_title="CEF (Outputs per Upload)",
        template="plotly_dark",
        legend=dict(orientation="h", yanchor="bottom", y=1.05, xanchor="right", x=1),
        xaxis=dict(tickangle=-40, showgrid=False),
        yaxis=dict(ticksuffix="×", range=[0, df['CEF'].max() + 0.5],
                   showgrid=True, gridcolor='rgba(255,255,255,0.1)'),
        height=450
    )

    fig2 = go.Figure(go.Pie(
        labels=output_df['Output_Type_Name'],
        values=output_df['ratio'],
        hole=0.62,
        textinfo='label+percent',
        hovertemplate="<b>%{label}</b><br>"
                      "%{value:.2f} outputs per upload<br>"
                      "(%{percent})<extra></extra>",
        marker=dict(
            colors=OUTPUT_COLORS,
            line=dict(color='#0D0F14', width=3)
        ),
        pull=[0.04 if i == output_df['ratio'].idxmax() else 0
              for i in range(len(output_df))],
        direction='clockwise',
        sort=False
    ))

    fig2.add_annotation(
        text=f"<b>{overall_cef:.2f}×</b><br>per upload",
        x=0.5, y=0.5,
        showarrow=False,
        font=dict(size=15, color='white'),
        align='center'
    )

    fig2.update_layout(
        title="<b>What 1 Upload Generates — Output Mix Breakdown</b><br>"
              "<sup>Each slice = average number of that output type created per uploaded video</sup>",
        template="plotly_dark",
        height=420,
        legend=dict(orientation="h", yanchor="bottom", y=-0.15, xanchor="center", x=0.5)
    )

    return fig, fig2

def visualize_cef_by_input(fact_input_type, dim_input):
    df = fact_input_type.merge(dim_input, on='InputType_ID', how='left')
    df['CEF'] = (df['Created Count'] / df['Uploaded Count'].replace(0, np.nan)).fillna(0)
    df = df.sort_values(by='CEF', ascending=True)

    avg_cef = df['CEF'].mean()
    peak_row = df.loc[df['CEF'].idxmax()]

    fig = go.Figure()
    colors = ['#F5A623' if val == peak_row['CEF'] else '#4A90E2' for val in df['CEF']]

    fig.add_trace(go.Bar(
        y=df['Input_Type_Name'],
        x=df['CEF'],
        orientation='h',
        marker=dict(color=colors, line=dict(width=0)),
        text=[f"{val:.2f}×" for val in df['CEF']],
        textposition='outside',
        hovertemplate="<b>%{y}</b><br>CEF: <b>%{x:.2f}×</b><br>Uploaded: %{customdata[0]}<br>Created: %{customdata[1]}<extra></extra>",
        customdata=df[['Uploaded Count', 'Created Count']]
    ))

    fig.add_trace(go.Scatter(
        y=df['Input_Type_Name'],
        x=[avg_cef] * len(df),
        mode='lines',
        name=f'Avg {avg_cef:.2f}×',
        line=dict(color='#7A7E94', width=2, dash='dash'),
        hoverinfo='skip'
    ))

    fig.update_layout(
        title=f"<b>Input Efficiency — Which source material yields the most assets?</b><br>"
              f"<sup>Winner: {peak_row['Input_Type_Name']} generates {peak_row['CEF']:.2f} assets per 1 upload</sup>",
        xaxis_title="CEF (Outputs per Upload)",
        yaxis_title="Input Type",
        template="plotly_dark",
        showlegend=False,
        xaxis=dict(range=[0, df['CEF'].max() + 1.0]),
        height=450,
        margin=dict(l=150)
    )

    return fig

def visualize_cef_by_output(fact_output_type, dim_output):
    df = fact_output_type.merge(dim_output, on='OutputType_ID', how='left')
    df['CEF'] = (df['Created Count'] / df['Uploaded Count'].replace(0, np.nan)).fillna(0)
    df = df.sort_values(by='CEF', ascending=False)

    fig = go.Figure()

    fig.add_trace(go.Bar(
        x=df['Output_Type_Name'],
        y=df['CEF'],
        marker=dict(
            color=df['CEF'],
            colorscale='Tealrose',
            showscale=False
        ),
        text=[f"{val:.2f}×" for val in df['CEF']],
        textposition='outside',
        textfont=dict(color='white'),
        hovertemplate="<b>%{x}</b><br>Generated Rate: <b>%{y:.2f} per upload</b><br>Total Created: %{customdata[0]}<extra></extra>",
        customdata=df[['Created Count']]
    ))

    fig.update_layout(
        title=f"<b>Output Generation Rate — What is the AI building?</b><br>"
              f"<sup>Showing the frequency of specific formats generated per single video upload</sup>",
        xaxis_title="Output Format",
        yaxis_title="Items Generated per 1 Upload",
        template="plotly_dark",
        yaxis=dict(range=[0, df['CEF'].max() + 0.5]),
        height=450
    )

    return fig

def visualize_monthly_productivity(fact_monthly, fact_user_summary, dim_month):
    total_users = fact_user_summary['User_ID'].nunique()
    df = fact_monthly.merge(dim_month, on='Month_ID', how='left')
    if 'Month_ID' in df.columns:
        df = df.sort_values('Month_ID')

    df['Active_Users'] = total_users
    df['Productivity_Index'] = (df['Total Published'] / df['Active_Users']).fillna(0)

    fig, ax = plt.subplots(figsize=(10,6))
    sns.barplot(
        data=df,
        x='Month_Name',
        y='Productivity_Index',
        palette='viridis',
        ax=ax
    )

    ax.set_title("Monthly Productivity Index")
    ax.set_xlabel("Month")
    ax.set_ylabel("Published Videos per Active User")
    ax.tick_params(axis='x', rotation=45)

    plt.tight_layout()
    return fig

def visualize_duration_footprint(fact_monthly, dim_month):
    df = fact_monthly.merge(dim_month, on='Month_ID', how='left')
    if 'Month_ID' in df.columns:
        df = df.sort_values('Month_ID')

    df['Uploaded_hr'] = df['Total Uploaded Duration_sec'] / 3600
    df['Created_hr'] = df['Total Created Duration_sec'] / 3600
    df['Published_hr'] = df['Total Published Duration_sec'] / 3600

    fig, ax = plt.subplots(figsize=(12,6))
    ax.stackplot(
        df['Month_Name'],
        df['Uploaded_hr'],
        df['Created_hr'],
        df['Published_hr'],
        labels=['Uploaded Duration','Created Duration','Published Duration']
    )

    ax.legend(loc='upper left')
    ax.set_title("Monthly Duration Footprint")
    ax.set_xlabel("Month")
    ax.set_ylabel("Total Duration (Hours)")
    ax.tick_params(axis='x', rotation=45)

    plt.tight_layout()
    return fig