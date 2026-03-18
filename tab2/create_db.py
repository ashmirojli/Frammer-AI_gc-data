import pandas as pd
import sqlite3
import os

# Create DB script for tab2
DATA_PATH = "../StarSchemaDB"
DB_FILE = "tab2.db"

conn = sqlite3.connect(DB_FILE)

for file in os.listdir(DATA_PATH):
    if file.endswith(".csv"):
        table_name = file.replace(".csv", "")
        df = pd.read_csv(os.path.join(DATA_PATH, file))
        df.to_sql(table_name, conn, if_exists="replace", index=False)
        print("Loaded:", table_name)

conn.close()

print("Tab2 Database created successfully!")
