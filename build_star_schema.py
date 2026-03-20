import os
import pandas as pd

def build_star_schema(data_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    
    print(f"Reading CSV files from {data_dir}...")
    
    # ---------------------------------------------------------
    # 1. Read Data Files
    # ---------------------------------------------------------
    video_df = pd.read_csv(os.path.join(data_dir, "video_list_data_obfuscated.csv"))
    user_channel_df = pd.read_csv(os.path.join(data_dir, "combined_data(2025-3-1-2026-2-28) by channel and user.csv"))
    input_type_df = pd.read_csv(os.path.join(data_dir, "combined_data(2025-3-1-2026-2-28) by input type.csv"))
    output_type_df = pd.read_csv(os.path.join(data_dir, "combined_data(2025-3-1-2026-2-28) by output type.csv"))
    language_df = pd.read_csv(os.path.join(data_dir, "combined_data(2025-3-1-2026-2-28) by language.csv"))
    user_df = pd.read_csv(os.path.join(data_dir, "combined_data(2025-3-1-2026-2-28) by user.csv"))
    
    month_chart_df = pd.read_csv(os.path.join(data_dir, "monthly-chart.csv"))
    month_duration_df = pd.read_csv(os.path.join(data_dir, "month-wise-duration.csv"))
    
    chan_pub_df = pd.read_csv(os.path.join(data_dir, "channel-wise-publishing.csv"))
    chan_dur_df = pd.read_csv(os.path.join(data_dir, "channel-wise-publishing duration.csv"))

    # ---------------------------------------------------------
    # 2. Extract and Create Dimension Tables
    # ---------------------------------------------------------
    print("Building Dimension Tables...")
    def create_dim(unique_list, id_col, name_col):
        s = pd.Series(list(unique_list)).dropna().unique()
        return pd.DataFrame({id_col: range(1, len(s) + 1), name_col: s})

    # Dim User
    users = pd.concat([video_df['Uploaded By'], user_channel_df['User'], user_df['User']]).unique()
    dim_user = create_dim(users, 'User_ID', 'User_Name')

    # Dim Channel
    channels = pd.concat([user_channel_df['Channel'], chan_pub_df['Channels']]).unique()
    dim_channel = create_dim(channels, 'Channel_ID', 'Channel_Name')

    # Dim Type (Input/Output Types)
    dim_input_type = create_dim(input_type_df['Input Type'], 'InputType_ID', 'Input_Type_Name')
    dim_output_type = create_dim(output_type_df['Output Type'], 'OutputType_ID', 'Output_Type_Name')
    
    # Dim Language
    dim_language = create_dim(language_df['Language'], 'Language_ID', 'Language_Name')

    # Dim Month
    dim_month = create_dim(month_chart_df['Month'], 'Month_ID', 'Month_Name')
    
    # Dim Team
    dim_team = create_dim(video_df['Team Name'], 'Team_ID', 'Team_Name')

    # Dim Platform (Unpivot channel-wise data to find all platforms)
    platforms_from_pub = [c for c in chan_pub_df.columns if c != 'Channels']
    platforms_from_video = video_df['Published Platform'].dropna().unique().tolist()
    all_platforms = pd.Series(platforms_from_pub + platforms_from_video).unique()
    dim_platform = create_dim(all_platforms, 'Platform_ID', 'Platform_Name')

    # Save Dimensions
    print("Saving Dimension Tables (*_Dim.csv)...")
    dim_col_map = {
        'Dim_User.csv': dim_user,
        'Dim_Channel.csv': dim_channel,
        'Dim_Input_Type.csv': dim_input_type,
        'Dim_Output_Type.csv': dim_output_type,
        'Dim_Language.csv': dim_language,
        'Dim_Month.csv': dim_month,
        'Dim_Team.csv': dim_team,
        'Dim_Platform.csv': dim_platform
    }
    for file_name, df in dim_col_map.items():
        df.to_csv(os.path.join(out_dir, file_name), index=False)

    # ---------------------------------------------------------
    # 3. Create Fact Tables (Mapping IDs)
    # ---------------------------------------------------------
    print("Building Fact Tables...")

    # Fact_Video
    fact_video = video_df.merge(dim_user, left_on='Uploaded By', right_on='User_Name', how='left') \
                         .merge(dim_team, left_on='Team Name', right_on='Team_Name', how='left') \
                         .merge(dim_platform, left_on='Published Platform', right_on='Platform_Name', how='left')
    fact_video.drop(columns=['Uploaded By', 'User_Name', 'Team Name', 'Team_Name', 'Published Platform', 'Platform_Name'], inplace=True)
    fact_video.to_csv(os.path.join(out_dir, "Fact_Video.csv"), index=False)

    # Fact_User_Channel
    fact_uc = user_channel_df.merge(dim_user, left_on='User', right_on='User_Name', how='left') \
                             .merge(dim_channel, left_on='Channel', right_on='Channel_Name', how='left')
    fact_uc.drop(columns=['User', 'User_Name', 'Channel', 'Channel_Name'], inplace=True)
    fact_uc.to_csv(os.path.join(out_dir, "Fact_User_Channel.csv"), index=False)

    # Fact_Monthly
    fact_monthly = month_chart_df.merge(month_duration_df, on='Month', how='outer') \
                                 .merge(dim_month, left_on='Month', right_on='Month_Name', how='left')
    fact_monthly.drop(columns=['Month', 'Month_Name'], inplace=True)
    fact_monthly.to_csv(os.path.join(out_dir, "Fact_Monthly.csv"), index=False)

    # Fact_Channel_Publishing (Unpivoted)
    melt_pub = chan_pub_df.melt(id_vars=['Channels'], var_name='Platform_Name', value_name='Published_Count')
    
    # Rename columns in duration df so they match platform names gracefully
    dur_rename = {c: c.replace(' Duration', '') for c in chan_dur_df.columns if c != 'Channels'}
    chan_dur_df_rn = chan_dur_df.rename(columns=dur_rename)
    melt_dur = chan_dur_df_rn.melt(id_vars=['Channels'], var_name='Platform_Name', value_name='Published_Duration')
    
    # Merge unpivoted counts and durations
    fact_chan_pub = melt_pub.merge(melt_dur, on=['Channels', 'Platform_Name'], how='outer')
    
    # Map Dimensions
    fact_chan_pub = fact_chan_pub.merge(dim_channel, left_on='Channels', right_on='Channel_Name', how='left') \
                                 .merge(dim_platform, on='Platform_Name', how='left')
    fact_chan_pub.drop(columns=['Channels', 'Channel_Name', 'Platform_Name'], inplace=True)
    fact_chan_pub.to_csv(os.path.join(out_dir, "Fact_Channel_Publishing.csv"), index=False)

    # Fact_Input_Type
    fact_input = input_type_df.merge(dim_input_type, left_on='Input Type', right_on='Input_Type_Name', how='left')
    fact_input.drop(columns=['Input Type', 'Input_Type_Name'], inplace=True)
    fact_input.to_csv(os.path.join(out_dir, "Fact_Input_Type.csv"), index=False)

    # Fact_Output_Type
    fact_output = output_type_df.merge(dim_output_type, left_on='Output Type', right_on='Output_Type_Name', how='left')
    fact_output.drop(columns=['Output Type', 'Output_Type_Name'], inplace=True)
    fact_output.to_csv(os.path.join(out_dir, "Fact_Output_Type.csv"), index=False)

    # Fact_Language
    fact_language = language_df.merge(dim_language, left_on='Language', right_on='Language_Name', how='left')
    fact_language.drop(columns=['Language', 'Language_Name'], inplace=True)
    fact_language.to_csv(os.path.join(out_dir, "Fact_Language.csv"), index=False)

    # Fact_User_Summary
    fact_user = user_df.merge(dim_user, left_on='User', right_on='User_Name', how='left')
    fact_user.drop(columns=['User', 'User_Name'], inplace=True)
    fact_user.to_csv(os.path.join(out_dir, "Fact_User_Summary.csv"), index=False)

    print(f"Success! Star schema files generated in: {out_dir}")

if __name__ == "__main__":
    DATA_DIR = r"c:\Users\sprih\OneDrive\Desktop\Frammer Data"
    OUT_DIR = os.path.join(DATA_DIR, "Star_Schema")
    build_star_schema(DATA_DIR, OUT_DIR)
