import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from datetime import datetime
from openai import OpenAI
import asyncio

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
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "dummy-key")
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None

NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "dummy-api-key")
openai_client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = NVIDIA_API_KEY
)

class Attempt(BaseModel):
    user_id: str
    word: str
    input: str
    correct: bool
    time_taken: int
    pattern: str | None = None

class SessionData(BaseModel):
    user_id: str
    attempts: list[Attempt]

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

user_state = {
    "next_words": MOCK_100_WORDS[:50], # First 50 words ready
    "latest_analysis": {
        "mastery_percentage": 0,
        "mastered_words": [],
        "patterns_to_practice": []
    }
}

@app.get("/")
def read_root():
    return {"message": "Welcome to the Adaptive Literacy App API", "supabase_connected": supabase is not None}

@app.get("/words")
def get_words(level: int = 1):
    """Returns the pre-prepared batch of 50 words for the user."""
    return {"words": user_state["next_words"], "level": level}

@app.get("/explore-data")
def get_explore_data():
    """Returns the latest AI-analyzed data for the explore tab."""
    return user_state["latest_analysis"]

def background_analyze_and_prepare(session: SessionData):
    """
    Background task to analyze the 50 attempts using Minimax M2.7 and prepare the next 50 words.
    """
    if NVIDIA_API_KEY == "dummy-api-key" or not NVIDIA_API_KEY:
        print("Error: NVIDIA_API_KEY is not set.")
        return

    # Summarize attempts
    correct_words = [a.word for a in session.attempts if a.correct]
    incorrect_attempts = [{"word": a.word, "input": a.input} for a in session.attempts if not a.correct]
    
    attempts_str = "\\n".join([f"Word: {a['word']}, Typed/Said: {a['input']}" for a in incorrect_attempts])

    prompt = f"""
    You are an expert AI literacy tutor.
    The student just completed a 50-word test.
    They got {len(correct_words)}/50 correct.
    
    Here are the words they got wrong and their inputs:
    {attempts_str}

    Here are the words they got CORRECT:
    {", ".join(correct_words)}
    
    Step 1: Analyze the errors to find phonetic or spelling patterns they struggle with.
    Step 2: Carefully curate the next batch of exactly 50 words using this smart pedagogical strategy:
    - Rule 1 (Retry Mistakes): You MUST include the EXACT words they just got wrong so they can practice them again.
    - Rule 2 (Target Patterns): Add NEW words that share the same spelling/phonetic patterns as their mistakes.
    - Rule 3 (No Correct Word Repetition): NEVER repeat any word from the "CORRECT" list above.
    - Rule 4 (Confidence & Challenge): Fill the rest of the 50 words with a mix of NEW easy confidence-builder words and NEW slightly challenging words.

    Return ONLY a JSON object (no markdown, no backticks, just raw JSON string) with this exact structure:
    {{
        "mastery_percentage": <number between 0 and 100 based on correct ratio>,
        "patterns_to_practice": [
            {{
                "title": "<pattern name, e.g., 'Vowel Teams'>",
                "description": "<short description of why they need this>",
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

    try:
        completion = openai_client.chat.completions.create(
            model="minimaxai/minimax-m2.7",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            top_p=0.95,
            max_tokens=2048,
            stream=False # We need the full JSON response, not streamed
        )
        
        response_text = completion.choices[0].message.content.strip()
        # Clean up response if it contains markdown formatting
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()
            
        analysis_data = json.loads(response_text)
        
        # Update user state
        user_state["latest_analysis"]["mastery_percentage"] = analysis_data.get("mastery_percentage", round((len(correct_words)/50)*100))
        user_state["latest_analysis"]["mastered_words"] = correct_words[:10] # Show up to 10 mastered
        user_state["latest_analysis"]["patterns_to_practice"] = analysis_data.get("patterns_to_practice", [])
        
        next_words = analysis_data.get("next_50_words", MOCK_100_WORDS[50:100])
        if len(next_words) > 0:
            user_state["next_words"] = next_words[:50]
        else:
            user_state["next_words"] = MOCK_100_WORDS[50:100]

        print("Successfully analyzed session and prepared next 50 words.")
        
    except Exception as e:
        print(f"Error during background AI analysis: {str(e)}")

@app.post("/submit-test")
def submit_test(session: SessionData, background_tasks: BackgroundTasks):
    """
    Submits a completed 50-word test.
    Triggers AI analysis in the background to not block the frontend.
    """
    # Trigger AI background task
    background_tasks.add_task(background_analyze_and_prepare, session)
    
    return {"status": "success", "message": "Test submitted. Analysis and next batch preparation started."}
