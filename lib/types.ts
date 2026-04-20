export interface QuizAttempt {
  id?: string
  quizId: string
  score: number
  completedAt: string
}

export interface User {
  _id?: string
  id?: string
  name: string
  email: string
  role?: "student" | "teacher" | "admin"
  attendance?: number
  scores?: number[]
  quizAttempts?: QuizAttempt[]
}

export interface TranscriptLine {
  start?: number
  end?: number
  text?: string
}

export interface FrameData {
  time?: number
  text?: string
  imageUrl?: string
}

export interface LectureSummary {
  local?: string
  ai?: string
  merged?: string
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
}

export interface Quiz {
  id: string
  lectureId: string
  title: string
  questions: QuizQuestion[]
}

export interface Lecture {
  _id?: string
  id?: string
  title: string
  description?: string
  youtubeUrl?: string | null
  videoUrl?: string | null
  audioUrl?: string | null
  pptUrl?: string | null
  bookDocumentIds?: string[]
  status: "uploaded" | "queued" | "processing" | "completed" | "failed"
  errorMessage?: string
  transcript?: TranscriptLine[]
  frames?: FrameData[]
  summary?: LectureSummary
  createdAt?: string
  teacher?: {
    name?: string
    email?: string
  } | string
}

export interface LectureUploadPayload {
  title: string
  description?: string
  youtubeUrl?: string
  audioUrl?: string
  videoFile?: File | null
  audioFile?: File | null
  pptFile?: File | null
  bookFiles?: File[]
}

export interface LectureSummaryResponse {
  summary: LectureSummary
  status: Lecture["status"]
  errorMessage?: string
}

// ── Document / RAG ──────────────────────────────────────────────

export interface ChatMessage {
  _id?: string
  role: "user" | "assistant"
  content: string
  createdAt?: string
}

export interface Document {
  _id: string
  userId: string
  title: string
  fileName: string
  fileSize: number
  fileType: string
  status: "uploading" | "processing" | "ready" | "failed"
  errorMessage?: string
  chunkCount: number
  totalWords: number
  lectureId?: string | null
  lectureTitle?: string
  source?: "standalone" | "lecture"
  chatHistory?: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface ChatResponse {
  answer: string
  sources: { text: string; score: number }[]
}
