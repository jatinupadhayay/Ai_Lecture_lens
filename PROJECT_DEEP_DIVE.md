# AI Lecture Lens — Complete Project Deep Dive

> Every file, every method, every design decision explained in full detail.

---

## Table of Contents

1. [What This Project Is](#1-what-this-project-is)
2. [Architecture Overview](#2-architecture-overview)
3. [How a Lecture Gets Processed (End-to-End)](#3-how-a-lecture-gets-processed-end-to-end)
4. [Frontend — Next.js App](#4-frontend--nextjs-app)
   - [Root Config Files](#root-config-files)
   - [app/layout.tsx](#applayouttsx)
   - [app/page.tsx](#apppagetsx)
   - [app/auth/login/page.tsx & signup/page.tsx](#appauthloginpagetsx--signuppagetsx)
   - [app/dashboard/layout.tsx](#appdashboardlayouttsx)
   - [app/dashboard/page.tsx](#appdashboardpagetsx)
   - [app/dashboard/lectures/page.tsx](#appdashboardlecturespagetsx)
   - [app/dashboard/lectures/[id]/page.tsx](#appdashboardlecturesidpagetsx)
   - [app/dashboard/summaries/page.tsx](#appdashboardsummariespagetsx)
   - [app/dashboard/quizzes/page.tsx](#appdashboardquizzespagetsx)
   - [app/dashboard/quizzes/[id]/page.tsx](#appdashboardquizzesidpagetsx)
   - [app/dashboard/analytics/page.tsx](#appdashboardanalyticspagetsx)
   - [app/dashboard/scores/page.tsx](#appdashboardscorespagetsx)
   - [app/dashboard/progress/page.tsx](#appdashboardprogresspagetsx)
   - [app/dashboard/profile/page.tsx](#appdashboardprofilepagetsx)
5. [Frontend — Components](#5-frontend--components)
   - [components/auth-guard.tsx](#componentsauth-guardtsx)
   - [components/navbar.tsx](#componentsnavbartsx)
   - [components/sidebar.tsx](#componentssidebartsx)
   - [components/theme-provider.tsx](#componentstheme-providertsx)
   - [components/ui/](#componentsui)
6. [Frontend — Library](#6-frontend--library)
   - [lib/store.ts](#libstorets)
   - [lib/api.ts](#libapits)
   - [lib/types.ts](#libtypests)
   - [lib/utils.ts](#libutilsts)
7. [Backend — Express Server](#7-backend--express-server)
   - [src/server.js](#srcserverjs)
   - [src/worker.js](#srcworkerjs)
   - [src/config/db.js](#srcconfigdbjs)
   - [src/queues/index.js](#srcqueuesindexjs)
8. [Backend — MongoDB Models](#8-backend--mongodb-models)
   - [models/User.js](#modelsuserjs)
   - [models/Lecture.js](#modelslecturejs)
   - [models/QuizAttempt.js](#modelsquizattemptjs)
   - [models/AIJob.js](#modelsaijobjs)
9. [Backend — Middlewares](#9-backend--middlewares)
   - [middlewares/auth.js](#middlewaresauthjs)
   - [middlewares/errorHandler.js](#middlewareserrorhandlerjs)
10. [Backend — Routes](#10-backend--routes)
11. [Backend — Controllers](#11-backend--controllers)
    - [controllers/authController.js](#controllersauthcontrollerjs)
    - [controllers/lectureController.js](#controllerslecturecontrollerjs)
    - [controllers/quizController.js](#controllersquizcontrollerjs)
    - [controllers/analyticsController.js](#controllersanalyticscontrollerjs)
12. [Backend — Services](#12-backend--services)
    - [services/lectureProcessing.js](#serviceslectureprocessingjs)
    - [services/aiService.js](#servicesaiservicejs)
13. [Python AI Microservice](#13-python-ai-microservice)
    - [python-ai/main.py](#python-aimainpy)
    - [ai_models/transcriber.py](#ai_modelstranscriberpy)
    - [ai_models/extractor.py](#ai_modelsextractorpy)
    - [ai_models/summarize.py](#ai_modelssummarizepy)
    - [ai_models/quiz_generator.py](#ai_modelsquiz_generatorpy)
    - [ai_models/cleaner.py](#ai_modelscleanerpy)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [Environment Variables Reference](#15-environment-variables-reference)
16. [How to Start Everything](#16-how-to-start-everything)

---

## 1. What This Project Is

AI Lecture Lens is a full-stack EdTech SaaS. A student or teacher uploads a video lecture (MP4, audio file, or YouTube URL). The system:

1. Transcribes the speech to text using a local AI model (faster-whisper)
2. Extracts text from slide frames using OCR (Tesseract)
3. Cleans and reduces the transcript to the most informative sentences
4. Generates a structured summary (local BART model + OpenAI GPT-4o-mini)
5. Auto-generates multiple-choice quiz questions (local T5 model + OpenAI GPT-4o-mini)
6. Stores everything in MongoDB
7. Lets students take quizzes, view their scores, track progress, and compete on a leaderboard

The system is designed to work even without API keys — the local Python models run entirely offline. OpenAI is an optional enhancement.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15 + React 19)                             │
│  - Auth pages, Dashboard, Lecture viewer, Quiz taker         │
│  - Zustand store (client-side state)                         │
│  - Polls backend every 10s for processing status             │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP (REST)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Express.js API Server  (port 5000)                          │
│  - JWT auth, rate limiting, CORS                             │
│  - Routes: /auth, /lectures, /quizzes, /analytics            │
│  - Multer: handles file uploads to /uploads/                 │
│  - Pushes jobs to BullMQ queue (Redis)                       │
└──────┬────────────────────────────────────┬──────────────────┘
       │ BullMQ job                          │ direct query
       ▼                                     ▼
┌─────────────────┐               ┌──────────────────────┐
│  BullMQ Worker  │               │  MongoDB              │
│  (worker.js)    │               │  Users, Lectures,     │
│  Dequeues jobs  │               │  QuizAttempts, AIJobs │
│  Calls          │               └──────────────────────┘
│  processLecture │
│  Job()          │
└──────┬──────────┘
       │ HTTP or spawnSync
       ▼
┌──────────────────────────────────────────────────────────────┐
│  FastAPI Python AI Service  (port 8000)                      │
│  /transcribe  /extract  /quiz  /summarize  /clean            │
│  - faster-whisper (speech-to-text)                           │
│  - Tesseract OCR (slide text extraction)                     │
│  - BART (summarization)                                      │
│  - T5 (quiz generation)                                      │
│  - All CPU-bound work runs in asyncio.to_thread()            │
└──────────────────────────────────────────────────────────────┘
```

**Why this split?**

- Node.js (Express) is great for HTTP APIs, auth, file uploads, and talking to MongoDB/Redis. It is terrible at CPU-bound AI work.
- Python is the natural home for ML models (PyTorch, HuggingFace, faster-whisper, pytesseract).
- FastAPI keeps models warm in memory across requests. Without it, every transcription would cold-start the 460MB Whisper model, taking 30+ seconds just to load.
- BullMQ + Redis decouples upload from processing. The user gets a response immediately; the AI work happens in the background. If the server restarts mid-processing, the job survives in Redis and gets retried.

---

## 3. How a Lecture Gets Processed (End-to-End)

```
User uploads video
        │
        ▼
lectureController.uploadLecture()
  - Saves file via Multer to /uploads/
  - Creates Lecture doc in MongoDB (status: "uploaded")
  - Calls queueOrProcessLecture()
        │
        ▼  (if Redis is up)
BullMQ queue.add("processLecture", payload)
  - Lecture status → "queued"
  - Response returned to browser immediately
        │
        ▼
worker.js picks up job
  → processLectureJob(payload)
        │
        ├─ aiService.transcribe(videoPath)      ─── FastAPI /transcribe
        │    └─ transcriber.py: extract_audio() + transcribe_audio()
        │       faster-whisper returns [{start, end, text}, ...]
        │
        ├─ aiService.extract(videoPath)          ─── FastAPI /extract (parallel)
        │    └─ extractor.py: frame-by-frame OCR → [{time, text}, ...]
        │
        ├─ aiService.prepareText(transcript)     ─── FastAPI /clean
        │    └─ cleaner.py: remove filler words, fix punctuation
        │    └─ extractKeyContent(): TF-IDF sentence scoring → top 60% → max 6000 chars
        │
        ├─ aiService.dualSummarize(preparedText) ─── FastAPI /summarize (parallel)
        │    └─ BART model: abstractive summary
        │    └─ OpenAI GPT-4o-mini: structured summary with key points
        │
        └─ aiService.generateQuiz(preparedText)  ─── FastAPI /quiz (parallel)
             └─ T5 model: question generation
             └─ OpenAI GPT-4o-mini: structured MCQ JSON

All results saved to Lecture doc in MongoDB
Lecture status → "completed"

Browser polling /api/lectures/:id/summary detects "completed"
→ Shows summary, enables quiz
```

---

## 4. Frontend — Next.js App

### Root Config Files

**`next.config.mjs`**
Three settings:
- `eslint.ignoreDuringBuilds: true` — ESLint errors don't break `next build`. Useful in development.
- `typescript.ignoreBuildErrors: true` — TypeScript errors don't break the build. Allows shipping while fixing types incrementally.
- `images.unoptimized: true` — Skips Next.js image optimization. Required when hosting on a plain Node server without a CDN.

**`tsconfig.json`**
- `moduleResolution: "bundler"` — Modern resolution that matches how Webpack/Turbopack actually resolve modules. Required for Next.js 15.
- `paths: { "@/*": ["./*"] }` — Alias so `@/components/ui/button` resolves to `./components/ui/button`. Keeps imports clean across deeply nested files.
- `include: ["next-env.d.ts", ...]` — next-env.d.ts provides Next.js type declarations (image imports, CSS modules, etc.).

**`global.d.ts`**
```ts
declare module '*.css' {}
```
TypeScript with `moduleResolution: "bundler"` is strict about unknown module types. Without this, `import './globals.css'` causes a type error because TypeScript doesn't know what a `.css` file exports. This one-liner tells TypeScript: CSS side-effect imports are valid, treat them as void.

---

### `app/layout.tsx`

This is the root layout — the HTML shell that wraps every page in the app.

**Why it exists:** Next.js App Router requires a root `layout.tsx`. It runs on the server and sets the `<html>` and `<body>` tags, which no individual page can do.

**What it does:**
- Sets `<html lang="en" suppressHydrationWarning>` — `suppressHydrationWarning` prevents React from complaining about the `class` attribute changing when next-themes switches dark/light mode on the client.
- Applies Geist Sans + Geist Mono font CSS variables via className. Geist is Vercel's design-system font — clean, readable, modern.
- Wraps everything in `ThemeProvider` for light/dark mode support.
- Places `<Toaster>` at the bottom-right — this is the global toast notification layer (from `sonner`). Any page can trigger a toast without knowing about layout.

**Why `suppressHydrationWarning`:** Server renders with no class (or a default), browser adds `class="light"` or `class="dark"` after hydration. Without suppression, React throws a hydration mismatch warning.

---

### `app/page.tsx`

The public landing page — shown to visitors who are not logged in.

**What it contains:**
- Hero section: headline, description, CTA buttons linking to `/auth/signup` and `/auth/login`
- Feature cards: "AI Transcription", "Smart Summaries", "Auto Quizzes", "Performance Analytics"
- Stats bar: "10K+ Lectures", "95% Accuracy", etc.
- A visual mockup of the dashboard UI (CSS-only, no real data)

**Why it exists:** Acts as the product's marketing/onboarding page. Users who visit the root URL see this before logging in.

---

### `app/auth/login/page.tsx` & `signup/page.tsx`

Login and signup forms.

**How they work:**
1. User fills form → calls `useAppStore().login()` or `.signup()`
2. Store calls `apiService.login()` → POST to `/api/auth/login`
3. Backend validates credentials, returns `{ token, user }`
4. Store saves token to `localStorage`, sets `isAuthenticated: true`
5. Page redirects to `/dashboard`

**Why localStorage for JWT:** Simpler than cookies for a SPA. The token is attached as `Authorization: Bearer <token>` on every API call via `authHeaders()` in `lib/api.ts`.

**Form validation:** Uses `zod` schema + `react-hook-form` for client-side validation (required fields, email format, password minimum length) before hitting the API.

---

### `app/dashboard/layout.tsx`

Shared layout for all `/dashboard/*` routes.

**Structure:**
```
<AuthGuard>                 ← redirects to /auth/login if not authenticated
  <div h-screen flex-col>
    <Navbar />              ← top bar
    <div flex flex-1>
      <Sidebar />           ← left nav
      <main overflow-y-auto>
        <div max-w-5xl>
          {children}        ← individual page content
        </div>
      </main>
    </div>
  </div>
</AuthGuard>
```

**Why `h-screen overflow-hidden` on the outer div:** Makes the layout fill exactly the viewport. The main content area has `overflow-y-auto` so only the content scrolls, not the whole page. Sidebar and navbar stay fixed.

---

### `app/dashboard/page.tsx`

The main dashboard — the first thing a logged-in user sees.

**What it shows:**
- Stats row: total lectures, completed lectures, quizzes taken, average score
- "Continue Learning" — the most recent in-progress or uploaded lecture
- Recent lectures list with status badges
- Recent quizzes available to take

**How stats are computed:** Entirely client-side from the Zustand store. No extra API call — lectures and user data are already loaded.

**Status badge colors:** Defined in `lib/utils.ts → lectureStatusStyle`. Gold for processing/queued, green for completed, red for failed, gray for uploaded.

---

### `app/dashboard/lectures/page.tsx`

Lists all lectures and provides an upload dialog.

**Upload dialog flow:**
1. User enters title + picks a file (video, audio, PPT) or pastes a YouTube URL
2. `uploadLecture()` in the store calls `apiService.uploadLecture()` which sends a `multipart/form-data` POST to `/api/lectures/upload`
3. Backend saves the file, creates the Lecture document, queues the job
4. Dialog closes, new lecture appears in the list with status "queued"

**Polling:** The page polls `/api/lectures` every 10 seconds to update status badges. When a lecture moves from "processing" → "completed", the badge updates automatically.

**Why polling (not websockets):** Simpler to implement and sufficient for this use case. A lecture takes 2-10 minutes to process; polling every 10 seconds is fine.

---

### `app/dashboard/lectures/[id]/page.tsx`

Individual lecture viewer.

**Tabs:**
- **Transcript** — full timestamped transcript from faster-whisper
- **Summary** — AI-generated summary (local BART + OpenAI)
- **Slides** — OCR-extracted text from video frames (timestamps included)

**Status polling:** When the lecture is still "processing" or "queued", the page polls `/api/lectures/:id/summary` every 10 seconds. When it sees `status: "completed"`, it stops polling and renders the content.

**Why a separate `/summary` endpoint:** The full lecture document (with full transcript array) can be large. The summary endpoint returns only `{ summary, status, errorMessage }` — lightweight for polling.

**Reprocess button:** If a lecture is in "failed" status, a button appears that calls `reprocessLecture()`. The controller resets status to "uploaded" and re-queues the job.

---

### `app/dashboard/summaries/page.tsx`

Two-panel summary viewer.

**Left panel:** Scrollable list of all completed lectures.
**Right panel:** When a lecture is selected, shows the merged summary (local + AI combined) in a readable format.

**Why separate from the lecture detail page:** Users often want to skim summaries across multiple lectures quickly without navigating to each one individually.

---

### `app/dashboard/quizzes/page.tsx`

Grid of all available quizzes (one per lecture that has been processed).

Each card shows:
- Lecture title
- Number of questions
- "Start Quiz" button

**Data source:** `apiService.getQuizzes()` → GET `/api/quizzes` → backend queries Mongo for all lectures that have quiz data.

---

### `app/dashboard/quizzes/[id]/page.tsx`

The quiz-taking experience.

**How it works:**
1. Page loads quiz questions from the store
2. Shows one question at a time with A/B/C/D options
3. User clicks an option → it highlights, next question auto-advances after 1s
4. After last question → calls `submitQuizAttempt(quizId, answers)`
5. Backend scores answers, saves `QuizAttempt` doc, updates user's `scores` array
6. Results screen shows: score percentage, correct/total, per-question breakdown

**Timer:** A countdown timer runs during the quiz. If it reaches 0, the quiz is auto-submitted with whatever answers were given.

**Why `quizId` is the `lectureId`:** Quizzes are stored inside the Lecture document, not as separate documents. The quiz ID equals the lecture's MongoDB `_id`. This simplifies the data model — no separate Quiz collection.

---

### `app/dashboard/analytics/page.tsx`

Performance analytics page with four tabs.

**Overview tab:**
- Overall average score
- Total attempts, pass rate
- Score trend line chart (recharts `LineChart`) — shows score progression over time

**Per-Lecture tab:**
- Bar chart of average score per lecture
- Helps identify which topics need more study

**Improvement tab:**
- "Needs Improvement" — lectures where average < 70%
- "Strong Areas" — lectures where average ≥ 70%
- Each card shows: avg, best, latest score, a progress bar, and improvement tip

**Leaderboard tab:**
- Full ranked list of all students by average score
- Top 5 shown as bar chart
- Current user's entry highlighted with "You" badge

**Data source:** Two API calls:
- `GET /api/analytics/student` — personal stats (attempts, per-lecture stats, score history)
- `GET /api/analytics/leaderboard` — all students ranked

---

### `app/dashboard/scores/page.tsx`

Simple table of all quiz attempts the user has made.

Columns: Quiz title, Lecture, Score, Pass/Fail badge, Date, Retake button.

**Key fix:** Uses `attempt._id || attempt.id || index` as the React key because MongoDB documents use `_id` (not `id`), so falling back to index prevents the "missing key" warning.

---

### `app/dashboard/progress/page.tsx`

Learning progress tracking — streak, lecture completion rate, weekly activity.

Shows:
- Study streak (consecutive days with at least one quiz attempt)
- Weekly quiz activity (how many quizzes per day this week)
- Completion rate (lectures with completed status / total lectures)

---

### `app/dashboard/profile/page.tsx`

User profile management.

Shows: name, email, role, join date.
Allows: editing name and email via `updateProfile()`.
Stats summary: total lectures, quizzes taken, average score, best score.

---

## 5. Frontend — Components

### `components/auth-guard.tsx`

Protects all `/dashboard/*` routes.

**How it works:**
1. On mount, calls `fetchProfile()` — tries to load the user from the JWT in localStorage
2. While loading: shows a spinner
3. If not authenticated after loading: redirects to `/auth/login` using `router.replace()`
4. If authenticated: renders `{children}`

**Why `router.replace()` not `router.push()`:** Replace removes the dashboard URL from browser history. If the user presses Back after being redirected to login, they don't get sent back to a page they can't access.

**Why `useEffect` for redirect (not render-time):** Server-side rendering doesn't have access to localStorage or the auth state. The effect runs client-side only, after hydration. Doing the redirect in render would cause hydration mismatches.

**Why the `!isAuthenticated && !pathname.startsWith("/auth")` return null:** Prevents a flash of dashboard content while the redirect is happening. Without this, the dashboard would briefly render for an unauthenticated user before the redirect fires.

---

### `components/navbar.tsx`

Top navigation bar shown on all dashboard pages.

Contains:
- App logo/name (links to `/dashboard`)
- User avatar with dropdown menu: Profile, Logout

The logout handler calls `useAppStore().logout()` which clears the token from localStorage and resets all store state.

---

### `components/sidebar.tsx`

Left navigation sidebar.

**Nav items:**
- Dashboard (`/dashboard`)
- Lectures (`/dashboard/lectures`)
- Summaries (`/dashboard/summaries`)
- Quizzes (`/dashboard/quizzes`)
- Analytics (`/dashboard/analytics`)
- Scores (`/dashboard/scores`)
- Progress (`/dashboard/progress`)
- Profile (`/dashboard/profile`)

**Active state:** Uses `usePathname()` to compare the current URL against each nav item's href. The active item gets a highlight background and bold text.

**Collapsible on mobile:** On small screens, the sidebar collapses to icon-only mode or hides entirely.

---

### `components/theme-provider.tsx`

Thin wrapper around `next-themes` `ThemeProvider`.

**Why this wrapper exists:** `next-themes` is a client-side library. Next.js App Router requires marking components that use client-only APIs with `"use client"`. This wrapper does that, allowing `app/layout.tsx` (a Server Component) to import and use it cleanly.

**Settings:**
- `defaultTheme: "light"` — start in light mode (per the CLAUDE.md design brief: warm, not dark)
- `enableSystem: false` — don't automatically follow OS dark/light preference
- `disableTransitionOnChange` — prevents a flash/transition when switching themes

---

### `components/ui/`

All components in this folder are from **shadcn/ui** — pre-built, unstyled Radix UI primitives styled with Tailwind CSS.

Key ones used throughout the app:

| Component | What it is | Why used |
|-----------|------------|----------|
| `Button` | Accessible button with variants (default, ghost, outline) | Consistent styling + keyboard accessible |
| `Card` / `CardHeader` / `CardContent` | Container with subtle border + rounded corners | Groups related content visually |
| `Badge` | Small pill label | Status indicators (processing, completed, passed) |
| `Dialog` | Modal overlay | Upload form, confirmations |
| `Table` / `TableRow` / `TableCell` | Data table | Scores page, transcript view |
| `Tabs` / `TabsContent` | Tabbed interface | Lecture viewer, analytics |
| `Progress` | Horizontal progress bar | Score visualization, lecture completion |
| `Input` / `Label` | Form controls | Login/signup, upload forms |
| `Select` | Dropdown selector | Filtering, settings |
| `Separator` | Horizontal rule | Visual dividers |
| `Skeleton` | Loading placeholder | While data is fetching |
| `Toast` / `Toaster` (sonner) | Notification toasts | Success/error feedback |

**Why Radix UI primitives:** They are fully accessible (keyboard navigation, ARIA attributes, focus management) out of the box. Building accessible modals, dropdowns, and tabs from scratch is extremely complex.

---

## 6. Frontend — Library

### `lib/store.ts`

The central client-side state manager, built with **Zustand**.

**Why Zustand over React Context or Redux:**
- No boilerplate (no reducers, no action creators, no dispatch)
- Works outside of React components (e.g., in `lib/api.ts` callbacks)
- `persist` middleware auto-saves to `localStorage` so the user stays logged in after refresh

**State shape:**
```ts
{
  user: User | null          // logged-in user object
  isAuthenticated: boolean   // controls auth guard
  isLoading: boolean         // true while fetchProfile() is running
  lectures: Lecture[]        // all lectures for this user
  quizzes: Quiz[]            // all available quizzes
  summaries: Record<string, LectureSummary>  // keyed by lectureId
}
```

**`persist` config:**
```ts
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
})
```
Only `user` and `isAuthenticated` are persisted to localStorage. `lectures`, `quizzes`, and `summaries` are always fetched fresh from the API — they can change server-side.

**Key methods:**

| Method | What it does |
|--------|-------------|
| `login(email, password)` | Calls POST /auth/login, saves token, sets user in state |
| `signup(name, email, password)` | Calls POST /auth/register, same as login after |
| `fetchProfile()` | Reads token from localStorage, calls GET /auth/profile. If token invalid/missing, clears auth state |
| `logout()` | Removes token from localStorage, resets all state |
| `fetchLectures()` | Calls GET /lectures, sets `lectures` in state |
| `uploadLecture(payload)` | Calls POST /lectures/upload, upserts returned lecture into state |
| `fetchSummary(lectureId)` | Calls GET /lectures/:id/summary, saves to `summaries` map |
| `reprocessLecture(lectureId)` | Calls POST /lectures/:id/process, upserts updated lecture |
| `fetchQuizzes(lectureId?)` | Calls GET /quizzes or GET /quizzes/lecture/:id |
| `submitQuizAttempt(quizId, answers)` | Calls POST /quizzes/attempt, then refreshes profile (to get updated scores) |
| `getUserQuizAttempts()` | Returns `user.quizAttempts` from state |

**`upsertLecture(lectures, nextLecture)`:**
Helper that keeps the `lectures` array in sync without duplicates. Finds the existing entry by `_id` or `id`, removes it, puts the updated version at the front. This means newly updated lectures always appear first.

---

### `lib/api.ts`

All HTTP calls to the backend, organized in a single `apiService` object.

**Why a central service layer:**
- Single place to change the API base URL
- Token management (reading from localStorage, attaching as Bearer header) is in one place
- Easy to mock in tests

**`getToken()`:** Reads from `localStorage`. Has a `typeof window === "undefined"` guard — on the server during SSR, `localStorage` doesn't exist. This prevents a crash during Next.js build.

**`authHeaders()`:** Returns `{ Authorization: "Bearer <token>" }` if a token exists, or `{}` if not. This is spread into axios config on every authenticated request.

**`uploadLecture(payload)`:** Uses `FormData` to send files + metadata as `multipart/form-data`. Axios automatically sets the correct `Content-Type: multipart/form-data; boundary=...` header when a FormData body is provided.

---

### `lib/types.ts`

TypeScript interfaces that define the shape of data across the frontend.

These types match the MongoDB document structures returned by the backend. Key ones:

**`User`:**
```ts
{
  _id?, id?, name, email, role,
  attendance?, scores?: number[],
  quizAttempts?: QuizAttempt[]
}
```
Both `_id` (MongoDB) and `id` (sometimes serialized) are optional to handle both formats.

**`Lecture`:**
```ts
{
  status: "uploaded" | "queued" | "processing" | "completed" | "failed"
  transcript?: TranscriptLine[]   // [{start, end, text}]
  frames?: FrameData[]            // [{time, text, imageUrl}]
  summary?: LectureSummary        // {local, ai, merged}
  quiz and quizStructured         // stored on Lecture, not separate collection
}
```

**`QuizQuestion`:**
```ts
{
  question: string
  options: string[]       // always 4 options [A, B, C, D]
  correctAnswer: number   // 0-based index
}
```
The structured quiz format uses integer indexes for correct answers rather than strings. This makes scoring trivial: `answers[i] === question.correctAnswer`.

---

### `lib/utils.ts`

Utility functions shared across the frontend.

**`cn(...inputs)`:** Merges Tailwind classes intelligently. Uses `clsx` to handle conditional classes (objects/arrays), then `tailwind-merge` to resolve conflicts (e.g., `"p-2 p-4"` → `"p-4"`). Used everywhere: `className={cn("base-class", condition && "conditional-class")}`.

**`lectureStatusStyle`:** A lookup map from lecture status → Tailwind class string. Centralizes status colors so they're consistent across every page. Gold for active processing, green for success, red for failure.

**`getLectureStatusStyle(status)`:** Safe wrapper around the map with a fallback to "uploaded" style.

**`safeAvg(nums)`:** Computes average, returns 0 for empty arrays instead of NaN. Used everywhere scores are displayed.

**`safePct(numerator, denominator)`:** Computes percentage, guards against divide-by-zero.

**`fmtDateShort(date)`** and **`fmtDateLong(date)`:** Consistent date formatting using `toLocaleDateString`. Short: "Apr 2", Long: "April 2, 2026".

---

## 7. Backend — Express Server

### `src/server.js`

The entry point for the Express API. Boots the server.

**Startup sequence:**
1. `dotenv.config()` — loads `.env` into `process.env`
2. `require('express-async-errors')` — patches Express to automatically catch async errors and pass them to the error handler. Without this, an unhandled promise rejection in a route handler would crash the process.
3. CORS configuration — allows requests from `FRONTEND_URL` (production) or all origins (development)
4. Morgan logger — logs every HTTP request to the console: `GET /api/lectures 200 45ms`
5. Rate limiting:
   - `apiLimiter`: 500 requests per 15 minutes for all API routes. 500 is high enough to not block the 10-second polling from multiple tabs.
   - `authLimiter`: 20 requests per 15 minutes for `/api/auth`. Prevents brute-force password attacks.
6. Static file serving — `app.use('/uploads', express.static(...))` serves uploaded files directly from the filesystem. Any file at `uploads/filename.mp4` is accessible at `http://localhost:5000/uploads/filename.mp4`.
7. Routes registered in order: auth → lectures → quizzes → analytics
8. Error handler attached last — catches any error passed to `next(err)`
9. `connectDB(MONGO_URI)` — connects to MongoDB, then starts listening on PORT (default 5000)

**Why `connectDB` before `app.listen`:** If MongoDB is unreachable, the server should fail immediately with a clear error rather than accepting requests that will fail on every DB call.

---

### `src/worker.js`

A completely separate Node.js process that consumes AI processing jobs from the BullMQ queue.

**Why a separate process:**
- Long-running jobs (10+ minutes) would block the Express server's event loop if run inline
- If the AI processing crashes, it doesn't take the HTTP server down
- Can be scaled independently (run 2 workers on powerful machines)

**How it works:**
```
run()
  → connectDB()       (worker needs its own MongoDB connection)
  → new Worker("ai-jobs", handler, { connection })
     handler = async (job) => {
       processLectureJob(job.data)
     }
```

**Event handlers:**
- `worker.on("completed")` — logs success
- `worker.on("failed")` — logs error and calls `markLectureFailed()` to update the MongoDB document status to "failed" with the error message

**BullMQ connection:** Uses the same `ioredis` connection config as the main server (from `src/queues/index.js`).

---

### `src/config/db.js`

Simple MongoDB connection wrapper using Mongoose.

```js
async function connectDB(uri) {
  mongoose.set('strictQuery', true);  // suppress deprecation warning
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('MongoDB connected');
}
```

`strictQuery: true` means queries for fields not in the schema are silently ignored rather than erroring. This is safer behavior for production.

---

### `src/queues/index.js`

Creates and exports the Redis connection used by both the server (to add jobs) and the worker (to consume jobs).

**Lazy connect:** `lazyConnect: true` means the connection doesn't try to connect until explicitly called. This lets the server start up even if Redis is temporarily unavailable.

**Retry strategy:**
```js
retryStrategy(times) {
  if (times > 3) return null;  // stop retrying after 3 attempts
  return Math.min(times * 500, 2000);  // 500ms, 1000ms, 1500ms backoff
}
```
After 3 failed attempts, Redis is considered unavailable. The `redisAvailable` flag is set to false.

**Graceful degradation:** `isRedisAvailable()` is used in `lectureController.js`. If Redis is down, lectures are processed inline (synchronously in the request) rather than queued. This means the system still works without Redis — it just isn't async.

**Why this matters:** If you run the app without Redis running, uploading a lecture will still work — it just takes longer (the upload request hangs until processing is done).

---

## 8. Backend — MongoDB Models

### `models/User.js`

```
User {
  name: String (required)
  email: String (required, unique, lowercase)
  password: String (required, hashed)
  role: enum ["student", "teacher", "admin"] (default: "student")
  attendance: Number (default: 0)
  scores: [Number]           — array of quiz scores
  quizAttempts: [{           — embedded quick-reference
    quizId: String,
    score: Number,
    completedAt: Date
  }]
  createdAt, updatedAt       — timestamps
}
```

**`comparePassword(candidate)`:** Uses `bcrypt.compare()` to check a plain-text password against the stored hash. Called in `authController.loginUser()`.

**Why `scores` and `quizAttempts` are both stored:** `scores` is a flat number array for quick average calculation. `quizAttempts` has more detail (which quiz, when). Both are updated together when a quiz is submitted.

---

### `models/Lecture.js`

The most complex model — holds all AI-generated content.

```
Lecture {
  title: String (required)
  description: String
  teacher: ObjectId (ref: User)

  // Input sources (at least one required)
  youtubeUrl: String
  videoUrl: String        — path to uploaded video file
  audioUrl: String        — path to uploaded audio file / remote URL
  pptUrl: String          — path to uploaded slides

  // Processing state
  status: enum ["uploaded", "queued", "processing", "completed", "failed"]
  errorMessage: String

  // AI output
  transcript: [{start: Number, end: Number, text: String}]
  frames: [{time: Number, text: String, imageUrl: String}]
  summary: {local: String, ai: String, merged: String}
  quiz: {local: [String], ai: [String], merged: [String]}
  quizStructured: [{     — structured MCQ for quiz taker UI
    question: String,
    options: [String],
    correctAnswer: Number
  }]
}
```

**Status lifecycle:** `uploaded` → `queued` (if Redis) → `processing` (worker picks up) → `completed` or `failed`

**Why `quizStructured` alongside `quiz`:**
- `quiz.local/ai/merged` are text arrays — the raw output of the quiz generator (question + options as plain text strings)
- `quizStructured` is parsed from the OpenAI JSON response — already in the exact format the quiz taker UI needs
- If OpenAI is unavailable, `quizStructured` is empty and the quiz controller falls back to parsing the text format

---

### `models/QuizAttempt.js`

Records a student's attempt at a quiz.

```
QuizAttempt {
  lecture: ObjectId (ref: Lecture)   — which lecture's quiz
  student: ObjectId (ref: User)
  score: Number                       — percentage (0-100)
  total: Number                       — number of questions
  answers: [{
    questionIndex: Number,
    question: String,
    selected: String,    — the option text the user chose
    correct: Boolean
  }]
  createdAt: Date
}
```

Used by `analyticsController.js` to compute per-student stats and the leaderboard. The full answer breakdown lets users see exactly which questions they got wrong.

---

### `models/AIJob.js`

Tracks individual AI sub-tasks (transcribe, extract, summarize, quiz). Currently used for logging/debugging.

```
AIJob {
  lecture: ObjectId (ref: Lecture)
  taskType: enum ["transcribe", "extract", "summarize", "quiz"]
  status: enum ["pending", "running", "completed", "failed"]
  logs: [String]
  result: Mixed     — stores the raw AI output
  createdAt: Date
}
```

This model exists for observability — you can query MongoDB to see the status of individual AI tasks for a lecture without having to parse logs.

---

## 9. Backend — Middlewares

### `middlewares/auth.js`

**`protect` middleware:**
```
1. Read Authorization header
2. Check it starts with "Bearer "
3. Extract the token
4. jwt.verify(token, JWT_SECRET) → payload {id, ...}
5. User.findById(payload.id).select("-password") → user doc
6. Set req.user = user
7. Call next()
```

If any step fails (no header, invalid token, user not in DB), returns 401. All protected routes are gated by this middleware.

**`allowRoles(...roles)` middleware:**
```
(req, res, next) => {
  if (!req.user) → 401
  if (!roles.includes(req.user.role)) → 403
  next()
}
```
Used as a second layer after `protect` for teacher-only or admin-only routes. For example: `router.post('/upload', protect, allowRoles('teacher', 'admin'), uploadLecture)`.

---

### `middlewares/errorHandler.js`

Global error handler — the last middleware in `server.js`.

```js
(err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ success: false, message: err.message });
}
```

Because `express-async-errors` is required at startup, any `throw` or unhandled rejected promise inside a route handler automatically calls `next(err)`, which routes here. Without `express-async-errors`, async errors would crash the process silently.

---

## 10. Backend — Routes

Each route file maps HTTP methods + paths to controller functions.

**`routes/auth.js`:**
```
POST /api/auth/register    → authController.registerUser
POST /api/auth/login       → authController.loginUser
GET  /api/auth/profile     → protect → authController.getProfile
PATCH /api/auth/profile    → protect → authController.updateProfile
```

**`routes/lectures.js`:**
```
POST /api/lectures/upload          → protect → uploadLecture
GET  /api/lectures                 → protect → getLectures
GET  /api/lectures/:id             → protect → getLectureById
GET  /api/lectures/:id/summary     → protect → getLectureSummary
POST /api/lectures/:id/process     → protect → processLecture
```

**`routes/quizzes.js`:**
```
GET  /api/quizzes                         → protect → getAllQuizzes
GET  /api/quizzes/lecture/:lectureId      → protect → getQuizByLecture
POST /api/quizzes/generate               → protect → generateQuiz
POST /api/quizzes/attempt                → protect → attemptQuiz
```

**`routes/analytics.js`:**
```
GET /api/analytics/student      → protect → getStudentAnalytics
GET /api/analytics/leaderboard  → protect → getLeaderboard
```

All routes except `/api/auth/register` and `/api/auth/login` require authentication.

---

## 11. Backend — Controllers

### `controllers/authController.js`

**`registerUser(req, res)`:**
1. Validate required fields (name, email, password)
2. Check if email already exists → 400 if so
3. Hash password: `bcrypt.hash(password, 10)` — 10 salt rounds is the standard balance of security vs. performance
4. `User.create({name, email, password: hashedPassword})`
5. Generate JWT: `jwt.sign({id: user._id}, JWT_SECRET, {expiresIn: "7d"})`
6. Return `{token, user}` (user without password field)

**`loginUser(req, res)`:**
1. Find user by email
2. `user.comparePassword(password)` → bcrypt.compare
3. If wrong password → 401 "Invalid credentials"
4. Generate JWT
5. Return `{token, user}`

**`getProfile(req, res)`:**
Returns `req.user` (already loaded by `protect` middleware). Simple read, no DB call needed.

**`updateProfile(req, res)`:**
1. Extract `name`, `email` from body
2. If new email, check it's not already taken by another user
3. `User.findByIdAndUpdate(req.user._id, updates, {new: true})`
4. Return updated user

---

### `controllers/lectureController.js`

**`isRemoteUrl(value)`:** Checks if a string starts with `http://` or `https://`. Used to distinguish between uploaded file paths and remote URLs (like YouTube links or audio URLs from CDNs).

**`toWebUrl(filePath)`:** Converts an absolute filesystem path like `uploads/filename.mp4` to a web-accessible URL `/uploads/filename.mp4`. Normalizes slashes for Windows compatibility.

**`absPathFromUrl(url)`:** Reverses `toWebUrl`. Converts `/uploads/filename.mp4` back to an absolute filesystem path so Python scripts can open the file. Returns null for remote URLs (they'll be downloaded by `aiService.prepareInputs()`).

**`hasLectureSource({youtubeUrl, audioUrl, videoUrl, pptUrl})`:** Returns true if at least one source is provided. Used to reject uploads with no media.

**`buildLectureJobPayload(lecture)`:** Assembles the job data object sent to BullMQ. Converts DB URL paths to absolute filesystem paths. Distinguishes remote audio URLs (passed as `audioUrl` string) from local uploaded files (passed as `audioPath` filesystem path).

**`queueOrProcessLecture(lecture)`:**
- If Redis is up: `queue.add("processLecture", payload)` → sets status "queued" → returns immediately
- If Redis is down: calls `processLectureJob(payload)` directly (blocking!) → returns when done

This dual-mode design means the app works in both configurations (with and without Redis).

**`uploadLecture(req, res)`:**
Multer processes `req.files` (video, audio, ppt fields). Validates title and at least one source. Creates the Lecture document. Calls `queueOrProcessLecture`. Returns 201 with the lecture and processing mode.

**`processLecture(req, res)`:**
Re-triggers processing for an existing lecture. Crucially, it resets stuck "processing" or "failed" status back to "uploaded" before re-queuing. Without this reset, the worker would see "processing" status and might skip it or behave incorrectly.

---

### `controllers/quizController.js`

**`parseQuizLines(lines)`:**
Parses the raw text-format quiz output from the local T5 model. Handles two formats:
1. Full MCQ: Question + 4 options (A/B/C/D) + Answer line
2. Simple question: Just a question → assigned True/False/Not mentioned/Cannot determine options

This is necessary because the T5 model's output is plain text, not structured JSON. The parser reconstructs structured `{question, options, correctAnswer}` objects.

**`buildQuestionsFromLecture(lecture)`:**
Priority order for quiz source:
1. `quizStructured` (from OpenAI JSON) — most reliable, already parsed
2. `quiz.merged` (local T5 + OpenAI text, combined)
3. `quiz.ai` (OpenAI text only)
4. `quiz.local` (local T5 text only)

Uses `parseQuizLines()` for text formats, returns structured format directly for `quizStructured`.

**`lectureToQuizPayload(lecture)`:**
Converts a Lecture document to the Quiz interface the frontend expects. Returns null if there are no questions (prevents empty quizzes from appearing in the list).

**`getAllQuizzes(req, res)`:**
MongoDB query: find all lectures where any of the quiz arrays has at least one entry. Maps them through `lectureToQuizPayload`, filters out nulls.

**`attemptQuiz(req, res)`:**
1. Load lecture and build questions from it
2. Compare `answers[i]` (user's 0-based option choice) against `question.correctAnswer`
3. Compute score as percentage
4. Create `QuizAttempt` document
5. Update user's `scores` array and `quizAttempts` array with `$push`
6. Return detailed results

**Why `quizId` is the `lectureId`:** The quiz taker UI uses the lecture `_id` as the quiz ID. There's no separate Quiz collection. Quizzes are embedded in Lecture documents. This simplifies the data model significantly.

---

### `controllers/analyticsController.js`

**`getStudentAnalytics(req, res)`:**
1. `QuizAttempt.find({student: studentId}).populate('lecture', 'title')` — gets all attempts with lecture titles
2. Groups attempts by lecture using a plain object (faster than MongoDB $group for small datasets)
3. For each lecture: computes `best`, `latest`, `avg` scores
4. Marks `needsImprovement: avg < 70`
5. Sorts by avg ascending (weak areas first)
6. Computes overall avg, total attempts, pass count
7. Builds `scoreHistory` array (chronological) for the line chart

**`getLeaderboard(req, res)`:**
Uses MongoDB aggregation pipeline:
```js
$group: {_id: '$student', avgScore: {$avg: '$score'}, attempts: {$sum: 1}}
$sort: {avgScore: -1}
```
Then enriches with student names via a second query (`User.find({_id: {$in: studentIds}})`). Marks the current user's entry with `isMe: true`.

**Why not join in the aggregation:** MongoDB `$lookup` (JOIN equivalent) is more complex. Since the user count is small (EdTech SaaS, not social media scale), two queries is simpler and fast enough.

---

## 12. Backend — Services

### `services/lectureProcessing.js`

The orchestrator for the full AI processing pipeline. Called by the BullMQ worker.

**`processLectureJob(payload)`:**
```
1. Load lecture from MongoDB
2. Set status = "processing", save
3. aiService.prepareInputs() → resolve file path / download YouTube / download audio URL
4. Parallel: [aiService.transcribe(inputFile), aiService.extract(inputFile)]
5. Build lecture text from transcript + frames
6. aiService.prepareText(lectureText) → clean + extract key sentences
7. Parallel: [aiService.dualSummarize(preparedText), aiService.generateQuiz(preparedText, 7)]
8. Set lecture fields: transcript, frames, summary, quiz, quizStructured
9. Set status = "completed", save
10. Return lecture
```

**Why parallel execution (steps 4 and 7):**
- Transcription + extraction are independent — start both at the same time
- Summary generation + quiz generation are independent — start both at the same time
- This roughly halves the total processing time

**Error handling:** Any error is caught at the top-level try/catch, which calls `markLectureFailed(lectureId, error.message)`. The lecture status becomes "failed" with the error message stored. The error is re-thrown so BullMQ marks the job as failed too.

**`buildLectureText(transcript, frames)`:**
```js
textFromItems(transcript) || textFromItems(frames)
```
Prefers transcript text. Falls back to OCR frame text if transcript is empty. Joining all segment texts with spaces gives a continuous readable document.

**`buildMergedSummary(localSummary, aiSummary)`:**
Combines both summaries with `\n\n---\n\n` separator. Returns empty string if both are empty.

**`markLectureFailed(lectureId, message)`:**
Used by both `processLectureJob` and the BullMQ worker's `failed` event handler. Updates MongoDB directly — doesn't load the document first (uses `findByIdAndUpdate` for atomic update).

---

### `services/aiService.js`

The interface layer between Node.js and all AI capabilities. Handles FastAPI calls and fallbacks.

**Module-level constants:**
```js
const TRANSCRIBE_URL = process.env.TRANSCRIBE_SERVICE_URL || null;
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || null;
const QUIZ_URL = process.env.QUIZ_SERVICE_URL || null;
const SUMMARIZE_URL = process.env.SUMMARIZE_SERVICE_URL || null;
const CLEAN_URL = process.env.CLEAN_SERVICE_URL
  || (SUMMARIZE_URL ? SUMMARIZE_URL.replace("/summarize", "/clean") : null);
```
Computed once at startup. If FastAPI is not configured (env vars missing), these are null and the code falls back to local `spawnSync`.

**`STOP_WORDS` Set:**
Common English words that carry no informational value (the, a, and, is, are...). Used by `extractKeyContent` to filter out noise when scoring sentences.

**`extractKeyContent(text, maxChars = 6000)`:**
TF-IDF-inspired sentence scoring algorithm:
1. Split text into sentences at `.`, `?`, `!` boundaries
2. Filter out sentences shorter than 20 characters (noise)
3. Tokenize each sentence: lowercase, remove punctuation, split on spaces, filter stop words
4. Build word frequency map across all sentences (single pass)
5. Score each sentence: average frequency of its words (high-frequency words = important words)
6. Take top 60% of sentences by score (the most informationally dense)
7. Re-assemble in original order (preserves narrative flow), stop at `maxChars`

**Why this matters:** A 20-minute lecture transcript can be 15,000+ words. GPT-4o-mini has a 128K context window (not the bottleneck), but BART's context is ~1024 tokens. Sending 15K words to BART would truncate most of it. This algorithm distills the transcript to 6000 chars of the most important content.

**`prepareText(rawText)`:**
```
1. Call FastAPI /clean (or local cleaner.py) → fix punctuation, remove filler
2. Call extractKeyContent(cleaned, 6000) → select top sentences, cap at 6000 chars
3. Return prepared text (ready for summary/quiz)
```
This is called once, and the result is used for both summarization and quiz generation.

**`sendFileToService(url, filePath)`:**
Sends a file to a FastAPI endpoint as `multipart/form-data`. Uses `form-data` package to build the form, streams the file directly (no loading into memory). Sets `maxContentLength: Infinity` because large video files would otherwise hit axios's default limit.

**`downloadFileFromUrl(fileUrl, outDir)`:**
Downloads a file from any HTTP URL (e.g., a remote audio URL). Streams the response body to a file to avoid loading large files into memory.

**`downloadYouTubeVideo(url, outDir)`:**
Uses `@distube/ytdl-core` (the maintained fork of the outdated `ytdl-core`):
1. `ytdl.getInfo(url)` — fetches video metadata including all available formats
2. `ytdl.chooseFormat(info.formats, {quality: "highestaudio", filter: "audioonly"})` — selects audio-only stream (smaller, faster to download, sufficient for transcription)
3. `ytdl.downloadFromInfo(info, streamOpts)` — downloads the selected format
4. Writes to a `.webm` file (audio-only YouTube streams are typically WebM)

**Why audio-only:** A 20-minute lecture video might be 500MB+ in HD. The audio track is typically 10-30MB. We only need audio for transcription — video frames are extracted at 60-second intervals which doesn't require the full video download.

**`transcribe(filePath)`:**
Tries FastAPI `/transcribe` first. On failure (network error, timeout), falls back to `spawnSync transcriber.py filePath`.

Returns: `[{start: float, end: float, text: string}, ...]`

**`extract(filePath)`:**
Tries FastAPI `/extract` first. Returns: `[{time: float, text: string}, ...]`

If Tesseract is not installed, the extractor returns `[]` immediately without erroring.

**`generateQuiz(text, numQuestions = 5)`:**
```
1. FastAPI /quiz → local T5 model generates questions
   (if QUIZ_URL not set OR fails → skip, no local fallback)
2. OpenAI GPT-4o-mini with response_format: {type: "json_object"}
   → structured MCQ JSON: {questions: [{question, options, correctAnswer}]}
3. Return {localQuiz, aiQuiz, mergedQuiz, aiQuizStructured}
```

**`dualSummarize(cleanText)`:**
```
1. FastAPI /summarize → BART model (120s timeout)
   (if SUMMARIZE_URL not set OR fails → skip, no local fallback when FastAPI is configured)
2. OpenAI GPT-4o-mini → structured summary with key points
3. Return {localSummary, aiSummary}
```

**Why no local fallback when FastAPI is configured:** BART is a 1.6GB model. Running it via `spawnSync` takes 5-10 minutes including model load time — the same time as the FastAPI timeout. Doubling the wait time by running it twice (once via FastAPI, once via spawnSync) is worse than just failing fast and relying on OpenAI.

---

## 13. Python AI Microservice

### `python-ai/main.py`

FastAPI application — the AI brain of the system.

**Why FastAPI over Flask:**
- FastAPI is async-native (asyncio)
- Auto-generates OpenAPI docs at `/docs`
- Built-in request validation with Pydantic
- `uvicorn` with `workers=2` gives true multi-process concurrency

**Module-level imports:**
All AI modules (transcriber, extractor, quiz_generator, cleaner, summarize) are imported at startup, wrapped in try/except. This means:
1. Models can pre-load into memory when the server starts, not on the first request
2. If a model fails to import (missing package), the server still starts — that endpoint returns 500 instead of crashing everything

**`asyncio.to_thread(fn)`:**
FastAPI runs on an asyncio event loop. Python's GIL means CPU-bound work blocks the entire event loop — no other requests can be handled while PyTorch is running. `asyncio.to_thread()` offloads the work to a thread pool executor, freeing the event loop to handle other requests.

Without this, one transcription request would block ALL other FastAPI requests until it finishes.

**`workers=2` in uvicorn:**
Uses `multiprocessing` to spawn 2 separate Python processes, each running their own event loop. This allows 2 AI tasks to run truly in parallel (Python's GIL doesn't cross process boundaries). Combining `Promise.all` on the Node.js side with 2 workers means summarize and quiz generation run simultaneously.

**Endpoints:**

| Endpoint | Input | Output | AI model used |
|----------|-------|--------|--------------|
| `GET /health` | — | `{ok: true}` | none |
| `POST /transcribe` | multipart file | `[{start, end, text}, ...]` | faster-whisper |
| `POST /extract` | multipart file | `{frames: [{time, text}, ...]}` | Tesseract OCR |
| `POST /quiz` | `{text, num_questions}` | `{questions: [...]}` | T5 / HuggingFace |
| `POST /clean` | `{text}` | `{text: cleanedText}` | NLTK/spaCy rules |
| `POST /summarize` | `{text}` | `{summary: string}` | BART |

Each endpoint:
1. Validates input (raises 422/400 if missing)
2. Checks the module was imported successfully (raises 500 if not)
3. Wraps the CPU call in `asyncio.to_thread()`
4. Returns structured JSON

**File handling in /transcribe and /extract:**
Files are saved to the local `uploads/` directory, processed, then deleted in the `finally` block. This ensures no uploaded files accumulate on disk.

---

### `ai_models/transcriber.py`

Speech-to-text transcription.

**`get_whisper_model()`:**
Lazy singleton — loads the model on first call and caches it in a module-level variable `_whisper_model`. Subsequent calls return the cached model instantly. Loading faster-whisper `small` takes ~5 seconds and 460MB RAM.

**Why faster-whisper instead of OpenAI Whisper:**
- OpenAI Whisper requires `float16` inference (needs GPU or is slow on CPU)
- faster-whisper uses `CTranslate2` — a highly optimized inference engine
- `compute_type="int8"` quantization reduces model size and speeds up CPU inference ~4x
- A 20-minute lecture that took 20 minutes with Vosk takes 3-5 minutes with faster-whisper

**`extract_audio(video_path)`:**
Uses `moviepy` to extract the audio track from a video file as a 16kHz mono WAV file. 16kHz is the sample rate Whisper was trained on — higher rates don't improve accuracy but increase file size.

**`transcribe_audio(audio_path)`:**
```python
segments, info = model.transcribe(
    audio_path,
    beam_size=5,              # beam search width: higher = more accurate but slower
    vad_filter=True,          # Voice Activity Detection: skip silent parts
    vad_parameters={"min_silence_duration_ms": 500}  # 0.5s silence = segment boundary
)
```
Returns `[{start, end, text}]` — one object per spoken segment.

**VAD filter:** Without VAD, Whisper tries to transcribe silence (background noise, music) as words. The VAD filter detects non-speech audio and skips it, reducing hallucinations and processing time.

---

### `ai_models/extractor.py`

OCR text extraction from video frames.

**Tesseract detection:**
```python
tesseract_cmd = shutil.which("tesseract")  # check PATH
# then checks common Windows install paths
# C:\Program Files\Tesseract-OCR\tesseract.exe
```
Sets `TESSERACT_AVAILABLE = False` if not found. `extract_text_from_video()` returns `[]` immediately when unavailable — no errors spammed for every frame.

**`extract_text_from_video(video_path, frame_interval=60, hash_diff=5)`:**
```
1. Open video with OpenCV
2. Every 60 frames (2 seconds at 30fps = 1 frame per ~2s):
   a. Convert BGR frame to RGB PIL Image
   b. Compute perceptual hash (pHash) using imagehash
   c. If hash differs from previous frame by >5 bits → frame has changed significantly
   d. Run pytesseract.image_to_string() on the frame
   e. If text length > 10 chars → save {time, text}
3. Return all extracted frame texts
```

**Why perceptual hash comparison:** Slides change infrequently. Without this check, you'd OCR hundreds of near-identical frames. The pHash detects when the frame content is visually different (slide changed) vs. same (slide still showing). `hash_diff=5` means "different enough to have changed content".

**Why `frame_interval=60` not 1:** OCR is slow (~100ms/frame). Processing every frame of a 20-minute video (36,000 frames at 30fps) would take 60 minutes. Sampling every 60 frames (every 2 seconds) gives 600 frames — 60 seconds of OCR time.

---

### `ai_models/summarize.py`

Local text summarization using BART (`facebook/bart-large-cnn`).

Uses HuggingFace `transformers` pipeline:
```python
pipeline("summarization", model="facebook/bart-large-cnn")
```

**BART characteristics:**
- 1.6GB model, takes ~2 minutes to load on first use
- Abstractive summarization — generates new sentences, doesn't just extract
- Context window: ~1024 tokens (~750 words). Longer texts are truncated.

**Why it's slow:** BART runs on CPU with float32. For a 750-word input, inference takes 2-4 minutes. This is why the system prefers FastAPI (model stays warm between requests) and uses `prepareText` to reduce input to 6000 chars (still more than BART can use, but the `extractKeyContent` function gives it the most informative content).

---

### `ai_models/quiz_generator.py`

Local quiz generation using T5 (`valhalla/t5-small-qg-hl`).

A T5 model fine-tuned specifically for question generation. Takes a passage and generates a question about it.

**Why T5 for quiz generation:** Standard T5 base models are general-purpose text-to-text. `valhalla/t5-small-qg-hl` is fine-tuned on SQuAD (Stanford Question Answering Dataset) for question generation. It produces more natural, lecture-relevant questions than a general T5.

The local model generates simpler questions compared to GPT-4o-mini. When OpenAI is available, `aiQuizStructured` from GPT-4o-mini provides much better MCQs.

---

### `ai_models/cleaner.py`

Text cleaning and normalization.

Removes: filler words ("um", "uh", "you know"), repeated phrases, excessive whitespace, incomplete sentences.

Uses: NLTK for tokenization, regex for pattern matching.

The output of cleaner.py is the input to summarize.py and quiz_generator.py.

---

## 14. Data Flow Diagrams

### Authentication Flow
```
[Login Page]
  → input email/password
  → store.login(email, password)
    → apiService.login() → POST /api/auth/login
      → authController.loginUser()
        → User.findOne({email})
        → user.comparePassword(password) (bcrypt.compare)
        → jwt.sign({id: user._id}, JWT_SECRET)
        → return {token, user}
    ← store sets user, isAuthenticated=true
    ← localStorage.setItem("token", token)
  → router.push("/dashboard")
```

### Lecture Upload Flow
```
[Upload Dialog]
  → FormData(title, file)
  → store.uploadLecture(payload)
    → apiService.uploadLecture() → POST /api/lectures/upload (multipart)
      → Multer saves file to /uploads/
      → Lecture.create({title, videoUrl, status:"uploaded"})
      → queueOrProcessLecture(lecture)
        [Redis available]
          → queue.add("processLecture", {lectureId, videoPath, ...})
          → lecture.status = "queued", save
          → return immediately
        [Redis unavailable]
          → processLectureJob(payload) (blocking)
    ← store adds lecture to lectures[]
  → UI shows status badge "queued"
  → [10s poll] GET /api/lectures → status updates in UI
```

### AI Processing Flow (Worker)
```
[worker.js] picks up job
  → processLectureJob({lectureId, videoPath})
    → lecture.status = "processing", save
    → aiService.prepareInputs() → resolve video path
    
    → [PARALLEL]
      ┌─ aiService.transcribe(videoPath)
      │    → POST FastAPI /transcribe (multipart upload)
      │      → faster-whisper.transcribe() via asyncio.to_thread
      │    ← [{start, end, text}, ...]
      │
      └─ aiService.extract(videoPath)
           → POST FastAPI /extract (multipart upload)
             → OCR frame extraction via asyncio.to_thread
           ← [{time, text}, ...]
    
    → buildLectureText(transcript, frames) → joined text string
    → aiService.prepareText(text)
        → FastAPI /clean → remove fillers
        → extractKeyContent() → TF-IDF scoring → top 6000 chars
    
    → [PARALLEL]
      ┌─ aiService.dualSummarize(preparedText)
      │    → FastAPI /summarize (120s timeout)
      │      → BART model via asyncio.to_thread
      │    → OpenAI GPT-4o-mini (if API key set)
      │    ← {localSummary, aiSummary}
      │
      └─ aiService.generateQuiz(preparedText, 7)
           → FastAPI /quiz (120s timeout)
             → T5 model via asyncio.to_thread
           → OpenAI GPT-4o-mini structured JSON
           ← {localQuiz, aiQuiz, mergedQuiz, aiQuizStructured}
    
    → lecture.transcript = transcript
    → lecture.summary = {local, ai, merged}
    → lecture.quiz = {local, ai, merged}
    → lecture.quizStructured = aiQuizStructured
    → lecture.status = "completed", save

[Browser polling every 10s]
  → GET /api/lectures/:id/summary → {status: "completed", summary: {...}}
  → UI renders summary, enables quiz button
```

---

## 15. Environment Variables Reference

### Frontend (`app/.env.local`)
| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5000/api` |

### Backend (`backend/.env`)
| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Express server port | `5000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/smartlecture` |
| `JWT_SECRET` | Secret for signing JWTs | `secret123` (CHANGE IN PRODUCTION) |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `REDIS_HOST` | Redis hostname | `127.0.0.1` |
| `REDIS_PORT` | Redis port | `6379` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `OPENAI_API_KEY` | Optional: enables GPT-4o-mini for better summaries/quizzes | — |
| `TRANSCRIBE_SERVICE_URL` | FastAPI transcription endpoint | `http://localhost:8000/transcribe` |
| `EXTRACT_SERVICE_URL` | FastAPI extraction endpoint | `http://localhost:8000/extract` |
| `QUIZ_SERVICE_URL` | FastAPI quiz endpoint | `http://localhost:8000/quiz` |
| `SUMMARIZE_SERVICE_URL` | FastAPI summarize endpoint | `http://localhost:8000/summarize` |
| `CLEAN_SERVICE_URL` | FastAPI clean endpoint | derived from SUMMARIZE_SERVICE_URL |
| `PYTHON_PATH` | Python executable path | `python` |
| `WHISPER_MODEL_SIZE` | Whisper model size: tiny/base/small/medium | `small` |

---

## 16. How to Start Everything

**Required services:**
1. MongoDB (local or Atlas)
2. Redis (local)
3. Python 3.10+ with pip

**Step 1: Install dependencies**
```bash
# Frontend
cd Ai_Lecture_lens
npm install

# Backend
cd smart-lecture-ai-backend/backend
npm install

# Python AI service
cd smart-lecture-ai-backend/python-ai
pip install -r requirements.txt
```

**Step 2: Start services (4 terminals)**

Terminal 1 — Express API:
```bash
cd smart-lecture-ai-backend/backend
node src/server.js
# → Server running on http://localhost:5000
# → MongoDB connected
# → Redis connected
```

Terminal 2 — BullMQ Worker:
```bash
cd smart-lecture-ai-backend/backend
node src/worker.js
# → MongoDB connected. Worker is ready to process AI jobs.
```

Terminal 3 — FastAPI:
```bash
cd smart-lecture-ai-backend/python-ai
python main.py
# → Uvicorn running on http://0.0.0.0:8000
# → 2 worker processes started
```

Terminal 4 — Next.js Frontend:
```bash
cd Ai_Lecture_lens
npm run dev
# → Next.js ready on http://localhost:3000
```

**First-time note:** When the first lecture is uploaded and transcribed, faster-whisper will download the `small` model (~460MB). This happens once and is cached in `~/.cache/huggingface/`.

**Without Redis:** The worker process is not needed. Lectures process inline (blocking) when uploaded. Everything still works, just without background processing.

**Without Python/FastAPI:** Lectures cannot be transcribed or summarized. The system will still accept uploads and store them, but processing will fail with "FastAPI unavailable" errors in the logs.

**Without OpenAI API key:** Summaries come from BART only (slower, simpler). Quizzes come from T5 only (simpler questions, text format). The system is fully functional with local models only.
