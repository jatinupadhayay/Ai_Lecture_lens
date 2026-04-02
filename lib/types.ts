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
}

export interface LectureSummaryResponse {
  summary: LectureSummary
  status: Lecture["status"]
  errorMessage?: string
}
