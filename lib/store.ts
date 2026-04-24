import { create } from "zustand"
import { persist } from "zustand/middleware"
import { apiService } from "@/lib/api"
import type {
  Lecture,
  LectureSummary,
  LectureUploadPayload,
  Quiz,
  QuizAttempt,
  User,
} from "@/lib/types"

type UploadLectureResult = Awaited<ReturnType<typeof apiService.uploadLecture>>
type ReprocessLectureResult = Awaited<ReturnType<typeof apiService.processLecture>>

interface AppStoreState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  lectures: Lecture[]
  quizzes: Quiz[]
  summaries: Record<string, LectureSummary>
  login: (email: string, password: string) => Promise<boolean>
  signup: (name: string, email: string, password: string) => Promise<boolean>
  fetchProfile: () => Promise<void>
  updateProfile: (data: { name?: string; email?: string }) => Promise<boolean>
  logout: () => void
  fetchLectures: () => Promise<void>
  uploadLecture: (payload: LectureUploadPayload) => Promise<UploadLectureResult>
  fetchSummary: (lectureId: string) => Promise<void>
  reprocessLecture: (lectureId: string) => Promise<ReprocessLectureResult>
  fetchQuizzes: (lectureId?: string) => Promise<void>
  submitQuizAttempt: (quizId: string, answers: number[]) => Promise<any>
  getUserQuizAttempts: () => QuizAttempt[]
}

function upsertLecture(lectures: Lecture[], nextLecture: Lecture) {
  const lectureId = nextLecture._id || nextLecture.id
  const remaining = lectures.filter((lecture) => (lecture._id || lecture.id) !== lectureId)
  return [nextLecture, ...remaining]
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      lectures: [],
      quizzes: [],
      summaries: {},

      async login(email, password) {
        try {
          const data = await apiService.login(email, password)
          if (data.token) {
            localStorage.setItem("token", data.token)
          }

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } catch (error) {
          console.error("Login failed:", error)
          return false
        }
      },

      async signup(name, email, password) {
        try {
          const data = await apiService.signup(name, email, password)
          if (data.token) {
            localStorage.setItem("token", data.token)
          }

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          })
          return true
        } catch (error) {
          console.error("Signup failed:", error)
          return false
        }
      },

      async fetchProfile() {
        try {
          const token = localStorage.getItem("token")
          if (!token) {
            set({ isLoading: false, isAuthenticated: false, user: null })
            return
          }

          const user = await apiService.getProfile()
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          console.error("Profile fetch failed:", error)
          localStorage.removeItem("token")
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },

      async updateProfile(data) {
        try {
          const response = await apiService.updateProfile(data)
          set({ user: response.user })
          return true
        } catch (error) {
          console.error("Update profile failed:", error)
          return false
        }
      },

      logout() {
        localStorage.removeItem("token")
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          lectures: [],
          quizzes: [],
          summaries: {},
        })
      },

      async fetchLectures() {
        try {
          const data = await apiService.getLectures()
          set({ lectures: data.lectures || [] })
        } catch (error) {
          console.error("Fetch lectures failed:", error)
        }
      },

      async uploadLecture(payload) {
        const result = await apiService.uploadLecture(payload)
        const lectureId = result.lecture?._id || result.lecture?.id

        set((state) => ({
          lectures: upsertLecture(state.lectures, result.lecture),
          summaries:
            lectureId && result.lecture.summary
              ? { ...state.summaries, [lectureId]: result.lecture.summary }
              : state.summaries,
        }))

        return result
      },

      async fetchSummary(lectureId) {
        try {
          const response = await apiService.getLectureSummary(lectureId)
          set((state) => ({
            summaries: {
              ...state.summaries,
              [lectureId]: response.summary || {},
            },
          }))
        } catch (error) {
          console.error("Fetch summary failed:", error)
        }
      },

      async reprocessLecture(lectureId) {
        const result = await apiService.processLecture(lectureId)
        set((state) => ({
          lectures: upsertLecture(state.lectures, result.lecture),
          summaries:
            result.lecture.summary
              ? { ...state.summaries, [lectureId]: result.lecture.summary }
              : state.summaries,
        }))
        return result
      },

      async fetchQuizzes(lectureId) {
        try {
          const response = lectureId
            ? await apiService.getLectureQuizzes(lectureId)
            : await apiService.getQuizzes()

          set({ quizzes: response.quizzes || [] })
        } catch (error) {
          console.error("Fetch quizzes failed:", error)
        }
      },

      async submitQuizAttempt(quizId, answers) {
        try {
          const result = await apiService.submitQuiz(quizId, answers)
          await get().fetchProfile()
          return result
        } catch (error) {
          console.error("Submit quiz failed:", error)
          throw error
        }
      },

      getUserQuizAttempts() {
        return get().user?.quizAttempts || []
      },
    }),
    {
      name: "lecture-lens-store",
      version: 1,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
