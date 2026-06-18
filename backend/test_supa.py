import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xyz.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_KEY", "dummy"))

print(f"URL: {SUPABASE_URL}")
print(f"Key exists: {bool(SUPABASE_KEY)}")

try:
    db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Try selecting from students
    res = db.table("students").select("*").limit(1).execute()
    print("Students table exists! Data:", res.data)
except Exception as e:
    print(f"Error: {e}")
