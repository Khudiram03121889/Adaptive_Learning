import os
import hashlib
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xyz.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_KEY", "dummy"))

db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

password_hash = hash_password("Abcd@123")
insert_data = {
    "username": "ankitha",
    "name": "Ankitha",
    "password_hash": password_hash,
    "avatar": "🦊",
    "level": 1
}

try:
    # First check if user exists
    res = db.table("students").select("id").eq("username", "ankitha").execute()
    if res.data:
        print("User already exists!")
    else:
        res = db.table("students").insert(insert_data).execute()
        print("Successfully created user Ankitha!")
except Exception as e:
    print(f"Error: {e}")
