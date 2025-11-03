// 📁 src/lib/api.ts
import axios from "axios"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export const apiService = {
  // 🔹 AUTH
  async login(email: string, password: string) {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password })
    return res.data
  },

  async signup(name: string, email: string, password: string) {
    const res = await axios.post(`${API_URL}/auth/signup`, { name, email, password })
    return res.data
  },

  async getProfile() {
    const token = localStorage.getItem("token")
    const res = await axios.get(`${API_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data
  },

  // 🔹 LECTURES
  async getLectures() {
    const token = localStorage.getItem("token")
    const res = await axios.get(`${API_URL}/lectures`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data
  },

  async getLecture(id: string) {
    const token = localStorage.getItem("token")
    const res = await axios.get(`${API_URL}/lectures/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data
  },

  async getLectureSummary(id: string) {
    const token = localStorage.getItem("token")
    const res = await axios.get(`${API_URL}/lectures/${id}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data
  },

  async processLecture(id: string) {
    const token = localStorage.getItem("token")
    const res = await axios.post(`${API_URL}/lectures/${id}/process`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data
  },

  async uploadLecture(payload: {
    title: string
    description?: string
    youtubeUrl?: string
    audioUrl?: string
    videoFile?: File | null
    audioFile?: File | null
    pptFile?: File | null
  }) {
    const token = localStorage.getItem("token")
    const form = new FormData()

    form.append("title", payload.title)
    if (payload.description) form.append("description", payload.description)
    if (payload.youtubeUrl) form.append("youtubeUrl", payload.youtubeUrl)
    if (payload.audioUrl) form.append("audioUrl", payload.audioUrl)
    if (payload.videoFile) form.append("video", payload.videoFile)
    if (payload.audioFile) form.append("audio", payload.audioFile)
    if (payload.pptFile) form.append("ppt", payload.pptFile)

    const res = await axios.post(`${API_URL}/lectures/upload`, form, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    })
    return res.data
  },

  // 🔹 QUIZZES
  async getLectureQuizzes(lectureId: string) {
    const token = localStorage.getItem("token")
    const res = await axios.get(`${API_URL}/quizzes/${lectureId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.data
  },

  async submitQuiz(quizId: string, answers: number[]) {
    const token = localStorage.getItem("token")
    const res = await axios.post(
      `${API_URL}/quizzes/${quizId}/submit`,
      { answers },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    return res.data
  },
}
