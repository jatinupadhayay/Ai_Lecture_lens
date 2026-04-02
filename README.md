# Lecture Lens

Lecture Lens is an AI-assisted study platform for turning lecture material into usable learning assets. Upload a video, audio file, slide deck, or YouTube link and the system can generate transcripts, summaries, quizzes, and learner analytics.

## What is in this repo

- `app/`: Next.js frontend for auth, dashboard, lectures, summaries, quizzes, and analytics.
- `smart-lecture-ai-backend/backend/`: Express API, Mongo models, queue integration, and AI orchestration.
- `smart-lecture-ai-backend/python-ai/`: optional FastAPI helpers for transcription, extraction, quiz generation, and summarization.

## Current architecture

- Frontend: Next.js 15, React 19, Tailwind CSS, Zustand, Radix UI
- Backend: Express, MongoDB, BullMQ, Redis
- AI layer: Python scripts and optional FastAPI services, plus OpenAI-backed summary and quiz generation

The backend now supports two processing modes:

- Queue mode: lecture jobs are sent to BullMQ when Redis is available.
- Inline mode: the same processing pipeline runs directly in the API when Redis is unavailable.

This means uploads no longer fall back to fake placeholder summaries when the queue is down.

## Core workflow

1. User uploads lecture media or a YouTube link.
2. Backend stores the lecture record and starts processing.
3. Transcript and extracted text are combined into lecture text.
4. Summary and quiz data are generated from the extracted content.
5. Frontend surfaces status, summaries, quizzes, scores, and analytics.

## Local setup

### Prerequisites

- Node.js 18+
- Python 3.8+
- MongoDB
- Redis for queued processing
- FFmpeg for audio extraction

### Frontend

```bash
npm install
npm run dev
```

Create `.env.local` with:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Backend

```bash
cd smart-lecture-ai-backend/backend
npm install
npm run dev
```

Recommended backend environment variables:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/smartlecture
JWT_SECRET=replace-me
OPENAI_API_KEY=replace-me
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### Worker

Run this when Redis is available and you want queued processing:

```bash
cd smart-lecture-ai-backend/backend
npm run worker
```

### Python AI helpers

```bash
cd smart-lecture-ai-backend/python-ai
pip install -r requirements.txt
python main.py
```

## Tests

Backend smoke tests are available for the most fragile logic:

```bash
cd smart-lecture-ai-backend/backend
npm test
```

Or from the project root:

```bash
npm test
```

## Notes

- Quiz attempts are written both to the dedicated `QuizAttempt` collection and to the user profile summary used by the dashboard.
- Failed lecture processing is stored explicitly on the lecture record so the UI can show honest error states.
- Dependency versions in the frontend package are pinned to concrete versions instead of `latest`.
