# Lecture Lens

An AI-powered EdTech platform that turns any lecture into structured study material. Upload a video, audio file, slide deck, or YouTube link and the system automatically generates timestamped transcripts, Gemini-powered summaries, and MCQ quizzes — in under a minute.

## What is in this repo

- `app/` — Next.js 15 frontend: auth, dashboard, lectures, summaries, quizzes, analytics
- `smart-lecture-ai-backend/backend/` — Express API, MongoDB models, BullMQ queue, AI orchestration
- `smart-lecture-ai-backend/python-ai/` — FastAPI service for local transcription (faster-whisper), OCR frame extraction, and text cleaning

## Architecture

| Layer | Stack |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS, Zustand, Radix UI |
| Backend API | Express, MongoDB, BullMQ, Redis |
| Primary transcription | Groq Whisper API (`whisper-large-v3-turbo`) — ~10s for a full lecture |
| Fallback transcription | FastAPI + faster-whisper (local CPU, `int8`) |
| LLM — summary & quiz | Gemini 2.0 Flash → Gemini 2.0 Flash Lite → Groq Llama 3.3 70B (auto-fallback chain) |
| YouTube download | yt-dlp |
| Audio conversion | imageio_ffmpeg (bundled binary, no system ffmpeg needed) |
| Vector store | ChromaDB (semantic retrieval for RAG-based summary/quiz) |

## Processing pipeline

```
YouTube URL / video / audio / slides
        │
        ▼
   yt-dlp download (YouTube) or file upload
        │
        ▼
   Groq Whisper API  ──fail──►  FastAPI faster-whisper  ──fail──►  local spawnSync
        │
        ▼
   ChromaDB ingest  (vector store for RAG)
        │
        ├──► Gemini 2.0 Flash summary  (structured markdown, ~2–5s)
        │
        └──► Gemini 2.0 Flash MCQ quiz  (7 questions, structured JSON)
```

**Processing modes:**
- **Queue mode** — lecture jobs go to BullMQ when Redis is available. Worker picks them up asynchronously.
- **Inline mode** — same pipeline runs directly in the API when Redis is unavailable.

## Tested pipeline results

Tested against the 3Blue1Brown "But what is a neural network?" YouTube lecture:

| Step | Result |
|---|---|
| Upload + queue | ~327 ms |
| Groq Whisper transcription | 263 segments |
| Gemini summary | 2,425-char structured markdown |
| Quiz generation | 7 MCQ questions with 4 options + correct answer index |
| Summary page | Renders with Merged / Local Model / OpenAI tabs |
| Quiz page | Interactive, timed, 1-of-7 progress bar |

## Free API tiers used

| Service | Model | Free tier |
|---|---|---|
| Groq Whisper | `whisper-large-v3-turbo` | 7,200 audio seconds / day |
| Gemini | `gemini-2.0-flash` | 1,500 requests / day |
| Groq LLM (fallback) | `llama-3.3-70b-versatile` | free tier |

## Local setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- MongoDB (local or Atlas)
- Redis (for queue mode — optional, falls back to inline)
- yt-dlp — `pip install yt-dlp`

### 1. Frontend

```bash
cd Ai_Lecture_lens
npm install

# Build once (fast production server, no compile delay)
npm run build
npm run start
```

For development (slower first-load compile):
```bash
npm run dev
```

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 2. Backend API

```bash
cd smart-lecture-ai-backend/backend
npm install
node src/server.js
```

Create `.env` (copy from `.env.example`):
```
PORT=5000
FRONTEND_URL=http://localhost:3000
JWT_SECRET=replace-with-strong-secret
MONGO_URI=mongodb://127.0.0.1:27017/smartlecture
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# AI APIs
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key

# Python AI service (optional, used as transcription fallback)
TRANSCRIBE_SERVICE_URL=http://localhost:8000/transcribe
EXTRACT_SERVICE_URL=http://localhost:8000/extract
QUIZ_SERVICE_URL=http://localhost:8000/quiz
SUMMARIZE_SERVICE_URL=http://localhost:8000/summarize
```

### 3. Worker (required for queue-based processing)

Run this in a separate terminal alongside the backend:

```bash
cd smart-lecture-ai-backend/backend
node src/worker.js
```

### 4. Python AI service (optional fallback)

Only needed if Groq Whisper is unavailable. Handles local transcription and frame extraction.

```bash
cd smart-lecture-ai-backend/python-ai
pip install -r requirements.txt
python main.py
```

Runs on `http://localhost:8000`.

### Full startup (3 terminals)

```bash
# Terminal 1 — Backend API
cd smart-lecture-ai-backend/backend && node src/server.js

# Terminal 2 — Worker (queue processor)
cd smart-lecture-ai-backend/backend && node src/worker.js

# Terminal 3 — Frontend
cd Ai_Lecture_lens && npm run start
```

## Getting API keys

| Key | Where to get it |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio — aistudio.google.com |
| `GROQ_API_KEY` | console.groq.com |

## Notes

- The frontend must be built (`npm run build`) before using `npm run start`. The dev server (`npm run dev`) compiles lazily and can return 404s for JS chunks on first load if interrupted.
- The worker must be running for queued lectures to process. Without it, uploads sit in "Queued" status.
- Stalled jobs (from a crashed worker) can be re-triggered via the "Retry Processing" button on the lecture detail page.
- Quiz attempts are written to both the `QuizAttempt` collection and the user profile summary used by the dashboard.
- Failed lecture processing is stored on the lecture record so the UI shows honest error states rather than silently empty pages.
