# Adaptive Literacy App

## Project Overview
The Adaptive Literacy App is a high-performance, scalable mobile learning system designed to improve spelling (hear → type) and pronunciation (read → speak). It utilizes an adaptive, pattern-driven learning approach to ensure user mastery before progression. 

Currently, the workspace contains the initial implementation planning documentation.

## Architecture
The system uses a hybrid architecture:
- **Primary Brain:** Android App (Kotlin, Jetpack Compose, MVVM) handling real-time logic and offline-first capabilities.
- **Backend:** FastAPI (Data & Synchronization).
- **Database:** Supabase.
- **AI Analysis:** NVIDIA API (Async, batch analysis after sessions).

## Key Files
- `adaptive_literacy_app_advanced_implementation_plan_production_ready.md`: The comprehensive production-ready implementation plan detailing the architecture, core modules (TTS, STT, Attempt Manager, Pattern Engine, etc.), database schema, and build phases.

## Development Conventions & Rules
Based on the implementation plan, the following rules apply to development:
- **Real-time Performance:** The core learning loop (TTS, user input, evaluation, pattern detection) must be handled locally on the Android device without relying on network calls.
- **Mastery:** No level progression is allowed without reaching an 85% mastery threshold (3 correct in a row for word mastery).
- **AI Usage:** AI integrations (NVIDIA) should be used asynchronously (e.g., after a 50-question session) and NEVER in the real-time interaction loop.
- **Build Phases:** Development should follow the planned phases, starting with the Android UI (TTS + typing), moving to the pattern engine, speech mode, backend, and finally AI integration.

## Usage
This directory currently serves as the planning and documentation root. Once scaffolding begins, it will likely host the Android and Backend source code repositories.
