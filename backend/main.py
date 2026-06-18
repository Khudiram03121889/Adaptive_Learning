import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from postgrest.exceptions import APIError
import hashlib
from datetime import datetime
from google import genai
from google.genai import types
from fastapi.responses import StreamingResponse
from gtts import gTTS
import io
import asyncio
import threading
import random

load_dotenv()

app = FastAPI(title="Adaptive Literacy App API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow mobile client
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xyz.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_KEY", "dummy-key"))
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "dummy-api-key")
try:
    gemini_client = genai.Client(api_key=GOOGLE_API_KEY)
except Exception:
    gemini_client = None

class Attempt(BaseModel):
    user_id: str
    word: str
    input: str
    correct: bool
    time_taken: int
    pattern: str | None = None
    mode: str | None = "spelling"

class SessionData(BaseModel):
    user_id: str
    attempts: list[Attempt]
    level: int = 1



class RegisterRequest(BaseModel):
    username: str
    name: str
    password: str
    avatar: str

class LoginRequest(BaseModel):
    username: str
    password: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def require_supabase():
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured or connected")
    return supabase

@app.post("/register")
def register_student(req: RegisterRequest):
    db = require_supabase()
    try:
        response = db.table("students").select("id").eq("username", req.username).execute()
        if hasattr(response, 'data') and response.data:
            raise HTTPException(status_code=400, detail="Username already exists")

        password_hash = hash_password(req.password)
        insert_data = {
            "username": req.username,
            "name": req.name,
            "password_hash": password_hash,
            "avatar": req.avatar,
            "level": 1
        }
        res = db.table("students").insert(insert_data).execute()
        if hasattr(res, 'data') and res.data:
            student = res.data[0]
            return {
                "id": student["id"],
                "username": student["username"],
                "name": student["name"],
                "avatar": student["avatar"],
                "level": student["level"]
            }
        raise HTTPException(status_code=500, detail="Failed to register student")
    except APIError as e:
        error_message = e.message if hasattr(e, 'message') else str(e)
        if "row-level security" in str(error_message).lower() or "42501" in str(error_message):
             raise HTTPException(status_code=500, detail="Database access blocked (RLS). Server requires Supabase Service Role Key.")
        raise HTTPException(status_code=500, detail=f"Database error: {error_message}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to register student: {str(e)}")

@app.post("/login")
def login_student(req: LoginRequest):
    db = require_supabase()
    try:
        response = db.table("students").select("*").eq("username", req.username).execute()
        if not hasattr(response, 'data') or not response.data:
            raise HTTPException(status_code=401, detail="Invalid username or password")

        student = response.data[0]
        if not verify_password(req.password, student["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        return {
            "id": student["id"],
            "username": student["username"],
            "name": student["name"],
            "avatar": student["avatar"],
            "level": student["level"]
        }
    except APIError as e:
        error_message = e.message if hasattr(e, 'message') else str(e)
        if "row-level security" in str(error_message).lower() or "42501" in str(error_message):
             raise HTTPException(status_code=500, detail="Database access blocked (RLS). Server requires Supabase Service Role Key.")
        raise HTTPException(status_code=500, detail=f"Database error: {error_message}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to login: {str(e)}")

# In-memory mock storage for demo purposes
MOCK_100_WORDS = [
    "cat", "dog", "bat", "rat", "mat", "hat", "fat", "pat", "sat", "vat",
    "pen", "hen", "men", "ten", "den", "zen", "net", "pet", "set", "wet",
    "pig", "dig", "fig", "wig", "rig", "big", "jig", "zip", "lip", "tip",
    "hop", "mop", "pop", "top", "cop", "box", "fox", "pox", "boy", "toy",
    "sun", "run", "bun", "fun", "gun", "nut", "cut", "hut", "gut", "but",
    # 50 more words...
    "ship", "shop", "shot", "shut", "shed", "shell", "shock", "shin", "chin", "chop",
    "chat", "chip", "chill", "chug", "chum", "thin", "thick", "that", "this", "them",
    "then", "path", "math", "bath", "moth", "fish", "dish", "wish", "rush", "dash",
    "mash", "cash", "gash", "hash", "lash", "rash", "sash", "bash", "bell", "fell",
    "tell", "sell", "well", "yell", "hill", "mill", "pill", "will", "fill", "bill"
]

user_sessions = {}

def get_user_state(user_id: str) -> dict:
    if not user_id:
        user_id = "default_student"
    if user_id not in user_sessions:
        user_sessions[user_id] = {
            "level": 1,
            "next_words": MOCK_100_WORDS[:50],
            "latest_analysis": {
                "level": 1,
                "mastery_percentage": 0,
                "mastered_words": [],
                "patterns_to_practice": [],
                "recent_errors_spelling": [],
                "recent_errors_pronunciation": []
            }
        }
    return user_sessions[user_id]


def generate_initial_words_sync():
    global MOCK_100_WORDS
    if GOOGLE_API_KEY == "dummy-api-key" or not GOOGLE_API_KEY or gemini_client is None:
        print("GOOGLE_API_KEY is not set. Using fallback MOCK words.")
        return

    prompt = """
    You are an expert AI literacy tutor.
    Generate a JSON list of exactly 100 spelling/vocabulary words appropriate for a beginner learning to spell.
    The words should range from easy (3-letter CVC words) to slightly more challenging (vowel teams, digraphs).
    Return ONLY a JSON array of 100 strings (e.g. ["cat", "dog", ...]). Do not include any other text or markdown.
    """
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json"
            )
        )
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()

        words = json.loads(response_text)
        if isinstance(words, list) and len(words) >= 50:
            MOCK_100_WORDS = words
            # Update existing sessions that are still using old fallback words
            for uid, state in list(user_sessions.items()):
                if state["next_words"] == MOCK_100_WORDS[:50]:
                    state["next_words"] = words[:50]
            print(f"Successfully generated {len(words)} initial words via AI.")
    except Exception as e:
        print(f"Error generating initial words via AI: {e}")

@app.on_event("startup")
def startup_event():
    # Run AI generation in a background thread so it doesn't block FastAPI startup
    thread = threading.Thread(target=generate_initial_words_sync)
    thread.start()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Adaptive Literacy App API", "supabase_connected": supabase is not None}

@app.get("/tts")
def generate_tts(word: str, lang: str = 'en-US'):
    tld_map = {
        'en-US': 'com',
        'en-GB': 'co.uk',
        'en-IN': 'co.in'
    }
    tld = tld_map.get(lang, 'com')
    try:
        tts = gTTS(text=word, lang='en', tld=tld)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return StreamingResponse(fp, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/words")
def get_words(user_id: str = "default_student", level: int = 1):
    """Returns the pre-prepared batch of 50 words for the user."""
    state = get_user_state(user_id)
    # Synchronize active level in memory
    state["level"] = state.get("level", level)
    return {"words": state["next_words"], "level": state["level"]}

@app.get("/explore-data")
def get_explore_data(user_id: str = "default_student"):
    """Returns the latest AI-analyzed data for the explore tab."""
    state = get_user_state(user_id)
    state["latest_analysis"]["level"] = state.get("level", 1)
    return state["latest_analysis"]

def background_analyze_and_prepare(session: SessionData):
    """
    Background task to analyze the 50 attempts using NVIDIA NIM API and prepare the next 50 words.
    """
    correct_words = [a.word for a in session.attempts if a.correct]
    incorrect_attempts = [{"word": a.word, "input": a.input} for a in session.attempts if not a.correct]
    
    # Calculate mastery percentage
    mastery_percentage = round((len(correct_words) / len(session.attempts)) * 100) if session.attempts else 0
    passed_level = mastery_percentage >= 85
    current_level = session.level
    next_level = current_level + 1 if passed_level else current_level
    
    state = get_user_state(session.user_id)
    # Update active level
    state["level"] = next_level
    state["latest_analysis"]["level"] = next_level

    # Set up offline level-specific fallbacks in case AI generation fails
    level_fallbacks = {
        1: [
            "cat", "dog", "bat", "rat", "mat", "hat", "fat", "pat", "sat", "vat",
            "pen", "hen", "men", "ten", "den", "zen", "net", "pet", "set", "wet",
            "pig", "dig", "fig", "wig", "rig", "big", "jig", "zip", "lip", "tip",
            "hop", "mop", "pop", "top", "cop", "box", "fox", "pox", "boy", "toy",
            "sun", "run", "bun", "fun", "gun", "nut", "cut", "hut", "gut", "but"
        ],
        2: [
            "ship", "shop", "shot", "shut", "shed", "shell", "shock", "shin", "chin", "chop",
            "chat", "chip", "chill", "chug", "chum", "thin", "thick", "that", "this", "them",
            "then", "path", "math", "bath", "moth", "fish", "dish", "wish", "rush", "dash",
            "mash", "cash", "gash", "hash", "lash", "rash", "sash", "bash", "bell", "fell"
        ],
        3: [
            "tell", "sell", "well", "yell", "hill", "mill", "pill", "will", "fill", "bill",
            "train", "brain", "chain", "plain", "rain", "boat", "goat", "coat", "float", "road",
            "soap", "toad", "blue", "clue", "glue", "true", "play", "clay", "gray", "stay",
            "help", "held", "melt", "belt", "hand", "band", "sand", "land", "wind", "find"
        ]
    }

    if GOOGLE_API_KEY == "dummy-api-key" or not GOOGLE_API_KEY or gemini_client is None:
        print("Warning: GOOGLE_API_KEY is not set. Using local offline pool rotation for next words.")
        fallback_pool = level_fallbacks.get(next_level, level_fallbacks[1])
        state["next_words"] = random.sample(fallback_pool, min(50, len(fallback_pool)))
        state["latest_analysis"]["mastery_percentage"] = mastery_percentage
        state["latest_analysis"]["mastered_words"] = correct_words[:10]
        state["latest_analysis"]["patterns_to_practice"] = [
            {
                "title": "Spelling Fluency" if passed_level else "Pattern Mastery",
                "description": f"Outstanding progression! Keep moving forward in Level {next_level}." if passed_level else f"Continue practicing Level {next_level} words to reinforce your weak areas.",
                "mastery_progress": mastery_percentage
            }
        ]
        return

    attempts_str = "\n".join([f"Word: {a['word']}, Typed/Said: {a['input']}" for a in incorrect_attempts])

    prompt = f"""
    You are an expert AI literacy tutor.
    The student just completed a 50-word test for Level {current_level}.
    They got {len(correct_words)}/50 correct (mastery: {mastery_percentage}%).
    
    Pedagogical progression rules:
    - If mastery is >= 85%, they pass Level {current_level}! The next batch should transition them to Level {next_level} words.
    - If mastery is < 85%, they stay on Level {current_level}. The next batch should be Level {current_level} words targeting their specific mistakes.
    
    Word level guidelines:
    - Level 1 consists of simple 3-letter CVC words (cat, dog, pen, run, bun).
    - Level 2 consists of simple blends and digraphs (ship, thin, fast, bell, shop).
    - Level 3 consists of vowel teams and multi-syllabic words (boat, rain, helper, plastic, float).

    Here are the words they got wrong and their inputs:
    {attempts_str}

    Here are the words they got CORRECT:
    {", ".join(correct_words)}
    
    Step 1: Analyze the errors to find phonetic or spelling patterns they struggle with.
    Step 2: Carefully curate the next batch of exactly 50 words using this smart pedagogical strategy:
    - Rule 1 (Retry Mistakes): You MUST include the EXACT words they just got wrong so they can practice them again.
    - Rule 2 (Target Patterns): Add NEW words matching Level {next_level} that share the same spelling/phonetic patterns as their mistakes.
    - Rule 3 (No Correct Word Repetition): NEVER repeat any word from the "CORRECT" list above.
    - Rule 4 (Confidence & Challenge): Fill the rest of the 50 words with a mix of NEW easy confidence-builder words and NEW slightly challenging words appropriate for Level {next_level}.

    Return ONLY a JSON object (no markdown, no backticks, just raw JSON string) with this exact structure:
    {{
        "mastery_percentage": {mastery_percentage},
        "patterns_to_practice": [
            {{
                "title": "<pattern name, e.g., 'Vowel Teams' or 'Digraphs'>",
                "description": "<short description of why they need this and how to improve>",
                "mastery_progress": <number 0 to 100 showing their estimated mastery of this specific pattern>
            }}
        ],
        "next_50_words": [
            <flat list of 50 intelligently selected words based on the 4 Rules above>
        ]
    }}
    Limit to 2 patterns to practice. 
    Ensure next_50_words has exactly 50 words in a flat array of strings.
    """

    success = False
    try:
        print(f"Trying to call Google Gemini API")
        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                top_p=0.95,
                response_mime_type="application/json"
            )
        )
        response_text = response.text.strip()
            
        # Clean up response if it contains markdown formatting
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()
            
        analysis_data = json.loads(response_text)

        # Update user state from successful completion
        state["latest_analysis"]["mastery_percentage"] = analysis_data.get("mastery_percentage", mastery_percentage)
        state["latest_analysis"]["mastered_words"] = correct_words[:10] # Show up to 10 mastered
        state["latest_analysis"]["patterns_to_practice"] = analysis_data.get("patterns_to_practice", [])

        next_words = analysis_data.get("next_50_words", [])
        if len(next_words) >= 10:
            state["next_words"] = next_words[:50]
            # Fill to 50 if generated list is short
            while len(state["next_words"]) < 50:
                state["next_words"].append(random.choice(level_fallbacks.get(next_level, level_fallbacks[1])))
            else:
                fallback_pool = level_fallbacks.get(next_level, level_fallbacks[1])
                state["next_words"] = random.sample(fallback_pool, min(50, len(fallback_pool)))
                
        print(f"Successfully analyzed session and prepared next 50 words using Google Gemini.")
        success = True
    except Exception as e:
        print(f"Google Gemini failed: {e}")

    if not success:
        print("Google Gemini API failed. Using local offline pool fallback.")
        fallback_pool = level_fallbacks.get(next_level, level_fallbacks[1])
        state["next_words"] = random.sample(fallback_pool, min(50, len(fallback_pool)))
        state["latest_analysis"]["mastery_percentage"] = mastery_percentage
        state["latest_analysis"]["mastered_words"] = correct_words[:10]
        state["latest_analysis"]["patterns_to_practice"] = [
            {
                "title": "Local Adaptability",
                "description": f"AI models are offline. Local engine successfully transitioned you to Level {next_level}!",
                "mastery_progress": mastery_percentage
            }
        ]

@app.post("/submit-test")
def submit_test(session: SessionData, background_tasks: BackgroundTasks):
    """
    Submits a completed 50-word test.
    Triggers AI analysis in the background to not block the frontend.
    """
    # Separate spelling and pronunciation mistakes
    error_counts_spelling = {}
    error_counts_pronunciation = {}
    
    for a in session.attempts:
        if not a.correct and a.pattern and a.pattern != "none":
            mode = a.mode or "spelling"
            if mode == "pronunciation":
                error_counts_pronunciation[a.pattern] = error_counts_pronunciation.get(a.pattern, 0) + 1
            else:
                error_counts_spelling[a.pattern] = error_counts_spelling.get(a.pattern, 0) + 1
                
    recent_errors_spelling = [{"type": k, "count": v} for k, v in sorted(error_counts_spelling.items(), key=lambda item: item[1], reverse=True)]
    recent_errors_pronunciation = [{"type": k, "count": v} for k, v in sorted(error_counts_pronunciation.items(), key=lambda item: item[1], reverse=True)]
    
    state = get_user_state(session.user_id)
    state["latest_analysis"]["recent_errors_spelling"] = recent_errors_spelling
    state["latest_analysis"]["recent_errors_pronunciation"] = recent_errors_pronunciation
    
    # Store attempts in Supabase database if available
    if supabase is not None:
        try:
            attempts_to_insert = []
            for a in session.attempts:
                attempts_to_insert.append({
                    "user_id": a.user_id,
                    "word": a.word,
                    "input": a.input,
                    "correct": a.correct,
                    "pattern": a.pattern,
                    "time_taken": a.time_taken,
                    "mode": a.mode or "spelling",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Run non-blocking Supabase sync
            supabase.table("attempts").insert(attempts_to_insert).execute()
            print(f"Successfully synced {len(attempts_to_insert)} attempts to Supabase.")
        except Exception as e:
            print(f"Supabase sync failed gracefully (offline/unconfigured fallback): {e}")

    # Trigger AI background task
    background_tasks.add_task(background_analyze_and_prepare, session)
    
    return {"status": "success", "message": "Test submitted. Analysis and next batch preparation started."}

