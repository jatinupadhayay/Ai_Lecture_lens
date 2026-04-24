import axios from "axios"
import type {
  Lecture,
  LectureSummaryResponse,
  LectureUploadPayload,
  Quiz,
  User,
  Document as DocType,
  ChatResponse,
} from "@/lib/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

function getToken() {
  if (typeof window === "undefined") return ""
  return localStorage.getItem("token") || ""
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const apiService = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password })
    return response.data
  },

  async signup(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await axios.post(`${API_URL}/auth/register`, { name, email, password })
    return response.data
  },

  async getProfile(): Promise<User> {
    const response = await axios.get(`${API_URL}/auth/profile`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async updateProfile(data: { name?: string; email?: string }): Promise<{ user: User }> {
    const response = await axios.patch(`${API_URL}/auth/profile`, data, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getLectures(): Promise<{ lectures: Lecture[] }> {
    const response = await axios.get(`${API_URL}/lectures`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getLecture(id: string): Promise<Lecture> {
    const response = await axios.get(`${API_URL}/lectures/${id}`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getLectureSummary(id: string): Promise<LectureSummaryResponse> {
    const response = await axios.get(`${API_URL}/lectures/${id}/summary`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async processLecture(id: string): Promise<{
    lecture: Lecture
    processingFailed: boolean
    processingMode: "queue" | "inline"
    message: string
  }> {
    const response = await axios.post(
      `${API_URL}/lectures/${id}/process`,
      {},
      { headers: authHeaders() }
    )
    return response.data
  },

  async uploadLecture(payload: LectureUploadPayload): Promise<{
    lecture: Lecture
    processingFailed: boolean
    processingMode: "queue" | "inline"
    message: string
  }> {
    const formData = new FormData()

    formData.append("title", payload.title)
    if (payload.description) formData.append("description", payload.description)
    if (payload.youtubeUrl) formData.append("youtubeUrl", payload.youtubeUrl)
    if (payload.audioUrl) formData.append("audioUrl", payload.audioUrl)
    if (payload.videoFile) formData.append("video", payload.videoFile)
    if (payload.audioFile) formData.append("audio", payload.audioFile)
    if (payload.pptFile) formData.append("ppt", payload.pptFile)
    if (payload.bookFiles) payload.bookFiles.forEach((f) => formData.append("book", f))

    const response = await axios.post(`${API_URL}/lectures/upload`, formData, {
      headers: {
        ...authHeaders(),
        "Content-Type": "multipart/form-data",
      },
    })
    return response.data
  },

  async getQuizzes(): Promise<{ quizzes: Quiz[] }> {
    const response = await axios.get(`${API_URL}/quizzes`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getLectureQuizzes(lectureId: string): Promise<{ quizzes: Quiz[] }> {
    const response = await axios.get(`${API_URL}/quizzes/lecture/${lectureId}`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async submitQuiz(quizId: string, answers: number[]) {
    const response = await axios.post(
      `${API_URL}/quizzes/attempt`,
      { quizId, answers },
      { headers: authHeaders() }
    )
    return response.data
  },

  async getStudentAnalytics() {
    const response = await axios.get(`${API_URL}/analytics/student`, {
      headers: authHeaders(),
    })
    return response.data
  },

  async getLeaderboard() {
    const response = await axios.get(`${API_URL}/analytics/leaderboard`, {
      headers: authHeaders(),
    })
    return response.data
  },

  // ── Documents (RAG) ──────────────────────────────────────────

  async uploadDocument(
    file: File,
    title: string,
    onProgress?: (pct: number) => void
  ): Promise<{ document: DocType }> {
    const form = new FormData()
    form.append("file", file)
    form.append("title", title)
    const response = await axios.post(`${API_URL}/documents/upload`, form, {
      headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
    return response.data
  },

  async listDocuments(): Promise<{ documents: DocType[] }> {
    const response = await axios.get(`${API_URL}/documents`, { headers: authHeaders() })
    return response.data
  },

  async getDocument(id: string): Promise<{ document: DocType }> {
    const response = await axios.get(`${API_URL}/documents/${id}`, { headers: authHeaders() })
    return response.data
  },

  async deleteDocument(id: string): Promise<void> {
    await axios.delete(`${API_URL}/documents/${id}`, { headers: authHeaders() })
  },

  async chatWithDocument(id: string, message: string): Promise<ChatResponse> {
    const response = await axios.post(
      `${API_URL}/documents/${id}/chat`,
      { message },
      { headers: authHeaders() }
    )
    return response.data
  },

  async clearDocumentChat(id: string): Promise<void> {
    await axios.delete(`${API_URL}/documents/${id}/chat`, { headers: authHeaders() })
  },

  async uploadBookToLecture(lectureId: string, files: File[]): Promise<{ books: DocType[] }> {
    const form = new FormData()
    files.forEach((f) => form.append("book", f))
    const response = await axios.post(`${API_URL}/lectures/${lectureId}/books`, form, {
      headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
    })
    return response.data
  },

  async getLectureBooks(lectureId: string): Promise<{ documents: DocType[] }> {
    const response = await axios.get(`${API_URL}/documents?lectureId=${lectureId}`, {
      headers: authHeaders(),
    })
    return response.data
  },
}
