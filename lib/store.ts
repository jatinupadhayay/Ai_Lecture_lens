// 📁 src/lib/store.ts
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { apiService } from "./api"

export const useAppStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      lectures: [],
      quizzes: [],
      summaries: {},

      // 🔹 LOGIN
      async login(email: string, password: string) {
        try {
          const data = await apiService.login(email, password)
          if (data?.token) localStorage.setItem("token", data.token)
          set({ user: data.user, isAuthenticated: true })
          return true
        } catch (err) {
          console.error("Login failed:", err)
          return false
        }
      },

      // 🔹 SIGNUP
      async signup(name: string, email: string, password: string) {
        try {
          const data = await apiService.signup(name, email, password)
          if (data?.token) localStorage.setItem("token", data.token)
          set({ user: data.user, isAuthenticated: true })
          return true
        } catch (err) {
          console.error("Signup failed:", err)
          return false
        }
      },

      // 🔹 PROFILE
      async fetchProfile() {
        try {
          const token = localStorage.getItem("token")
          if (!token) {
            set({ isLoading: false })
            return
          }
          const data = await apiService.getProfile()
          set({ user: data, isAuthenticated: true, isLoading: false })
        } catch (err) {
          console.error("Profile fetch failed:", err)
          localStorage.removeItem("token")
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      // 🔹 LOGOUT
      logout() {
        localStorage.removeItem("token")
        set({
          user: null,
          isAuthenticated: false,
          lectures: [],
          quizzes: [],
          summaries: {},
        })
      },

      // 🔹 FETCH ALL LECTURES
      async fetchLectures() {
        try {
          const data = await apiService.getLectures()
          set({ lectures: data.lectures || data })
        } catch (err) {
          console.error("Fetch lectures failed:", err)
        }
      },

      // 🔹 UPLOAD LECTURE
      async uploadLecture(payload: {
        title: string
        description?: string
        youtubeUrl?: string
        audioUrl?: string
        videoFile?: File | null
        audioFile?: File | null
        pptFile?: File | null
      }) {
        try {
          const data = await apiService.uploadLecture(payload)
          const uploadedLecture = data.lecture || data
          const lectureId = uploadedLecture._id

          set((state) => ({
            lectures: [uploadedLecture, ...state.lectures],
          }))

          console.log("✅ Lecture uploaded successfully:", uploadedLecture)
          console.log("🧠 Lecture ID:", lectureId)

          if (lectureId) {
            try {
              await get().fetchSummary(lectureId)
            } catch (summaryErr) {
              console.warn("⚠️ Summary fetch failed after upload:", summaryErr)
            }
          }

          return uploadedLecture
        } catch (err) {
          console.error("❌ Upload lecture failed:", err)
          throw err
        }
      },

      // 🔹 FETCH SUMMARY
      async fetchSummary(lectureId: string) {
        try {
          const data = await apiService.getLectureSummary(lectureId)
          set((state) => ({
            summaries: { ...state.summaries, [lectureId]: data },
          }))
        } catch (err) {
          console.error("Fetch summary failed:", err)
        }
      },

      // 🔹 REPROCESS LECTURE
      async reprocessLecture(lectureId: string) {
        try {
          return await apiService.processLecture(lectureId)
        } catch (err) {
          console.error("Reprocess lecture failed:", err)
        }
      },

      // 🔹 QUIZZES
      async fetchQuizzes(lectureId?: string) {
        try {
          const data = await apiService.getLectureQuizzes(lectureId!)
          set({ quizzes: data.quizzes || data })
        } catch (err) {
          console.error("Fetch quizzes failed:", err)
        }
      },

      async submitQuiz(quizId: string, answers: number[]) {
        try {
          return await apiService.submitQuiz(quizId, answers)
        } catch (err) {
          console.error("Submit quiz failed:", err)
        }
      },

      // 🔹 USER QUIZ ATTEMPTS
      getUserQuizAttempts() {
        const user = get().user
        return user?.quizAttempts || []
      },
    }),
    {
      name: "smart-lecture-store",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
