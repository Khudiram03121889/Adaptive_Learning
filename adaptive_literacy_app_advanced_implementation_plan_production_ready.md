# Adaptive Literacy App – Advanced Implementation Plan (Production-Ready)

## 1. Product Goal
Build a high-performance, scalable mobile learning system that:
- Improves spelling (hear → type)
- Improves pronunciation (read → speak)
- Uses adaptive, pattern-driven learning
- Ensures mastery before progression

---

## 2. Architecture Overview

### Hybrid Architecture (Recommended)
- Android App (Primary Brain – Real-time logic)
- FastAPI Backend (Data + Sync)
- Supabase (Database)
- NVIDIA API (Async AI Analysis)

```
Android App
   ↓
FastAPI Backend
   ↓
Supabase DB
   ↓
NVIDIA AI (Async)
```

---

## 3. Android App Implementation

### Tech Stack
- Kotlin
- Jetpack Compose
- MVVM Architecture
- Coroutines + Flow

### Core Modules

#### 1. TTS Engine
- Use: android.speech.tts.TextToSpeech
- Features:
  - Play word
  - Repeat button (unlimited)
  - Slow mode (0.75x speed)

#### 2. STT Engine
- Use: RecognizerIntent
- Features:
  - Convert speech → text
  - Show recognized text

#### 3. Attempt Manager
- Stores:
  - word
  - input
  - time_taken
  - correctness

#### 4. Error Analyzer
- Detect:
  - vowel confusion
  - phonetic substitution
  - missing letters
  - extra letters
  - order mistakes

#### 5. Pattern Engine
- Maintain pattern profile per user
- Update after every attempt

#### 6. Word Selection Engine (REAL-TIME)
- Logic:
  - 50% pattern-targeted
  - 30% weak words
  - 20% new words

#### 7. Mastery Engine
- Word mastery:
  - 3 correct in a row
- Level completion:
  - 85% mastery

#### 8. Session Manager
- Each session = 50 questions
- Controls flow

---

## 4. Backend (FastAPI)

### Responsibilities
- Store attempts
- Sync user data
- Provide word lists

### Endpoints
- POST /submit-attempt
- GET /words?level=1
- GET /progress
- POST /sync-session

---

## 5. Supabase Database Schema

### users
- id
- level
- created_at

### words
- id
- word
- level

### attempts
- id
- user_id
- word
- input
- correct
- pattern
- time_taken
- timestamp

### patterns
- id
- user_id
- pattern_type
- count

---

## 6. AI Integration (NVIDIA)

### When to call
- After each 50-question session

### Input
- last session attempts
- pattern summary

### Output
- weak areas
- recommended word sets
- difficulty adjustments

### Important
- Do NOT use AI in real-time loop

---

## 7. Core Learning Flow

```
Start Session (50 words)
   ↓
Load word pool
   ↓
Loop:
   - Play word (TTS)
   - User input (type/speak)
   - Evaluate
   - Detect pattern
   - Update pattern profile
   - Select next word
   ↓
End Session
   ↓
Sync to backend
   ↓
AI analysis
```

---

## 8. UI Design

### Practice Screen
- Large word display
- 🔊 Repeat button (tap = normal, hold = slow)
- 🎤 Speak button
- ⌨️ Input field

### Feedback
- Correct → green + sound
- Wrong → show correct word + replay

### Dashboard
- Accuracy
- Weak patterns
- Progress graph

---

## 9. Performance Optimization

- Preload next word
- Cache TTS audio
- Use local DB for session
- Avoid network calls per question

---

## 10. Build Phases

### Phase 1
- Android UI + TTS + typing

### Phase 2
- Pattern engine + adaptive logic

### Phase 3
- Speech mode

### Phase 4
- Backend + Supabase

### Phase 5
- NVIDIA AI integration

---

## 11. Key Rules

- No level progression without mastery
- Repeat weak words frequently
- Adapt based on pattern
- Keep UI simple for students

---

## 12. Next Step

Start with:
- Android project setup
- Implement TTS + input screen
