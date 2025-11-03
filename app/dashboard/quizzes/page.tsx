"use client"

import { useSearchParams } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Brain, Clock, Trophy, CheckCircle, PlayCircle, BookOpen } from "lucide-react"

export default function QuizzesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lectureFilter = searchParams.get("lecture")

  const { quizzes, lectures, getUserQuizAttempts } = useAppStore()
  const userAttempts = getUserQuizAttempts()

  // Filter quizzes by lecture if specified
  const filteredQuizzes = lectureFilter ? quizzes.filter((quiz) => quiz.lectureId === lectureFilter) : quizzes

  const getQuizAttempt = (quizId: string) => {
    return userAttempts.find((attempt) => attempt.quizId === quizId)
  }

  const getLectureTitle = (lectureId: string) => {
    const lecture = lectures.find((l) => l.id === lectureId)
    return lecture?.title || "Unknown Lecture"
  }

  const getAttemptStats = () => {
    const totalQuizzes = quizzes.length
    const attemptedQuizzes = new Set(userAttempts.map((a) => a.quizId)).size
    const averageScore =
      userAttempts.length > 0
        ? Math.round(userAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / userAttempts.length)
        : 0

    return { totalQuizzes, attemptedQuizzes, averageScore }
  }

  const stats = getAttemptStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {lectureFilter ? `Quizzes for ${getLectureTitle(lectureFilter)}` : "All Quizzes"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Test your knowledge and track your progress</p>
        </div>
        {lectureFilter && (
          <Button variant="outline" onClick={() => router.push("/dashboard/quizzes")}>
            View All Quizzes
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600" />
              Total Quizzes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuizzes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attemptedQuizzes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-600" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Quizzes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredQuizzes.map((quiz) => {
          const attempt = getQuizAttempt(quiz.id)
          const lectureTitle = getLectureTitle(quiz.lectureId)

          return (
            <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-2">
                      <BookOpen className="h-3 w-3" />
                      {lectureTitle}
                    </CardDescription>
                  </div>
                  {attempt && (
                    <Badge variant={attempt.score >= 70 ? "default" : "secondary"} className="ml-2">
                      {attempt.score}%
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quiz Info */}
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Brain className="h-3 w-3" />
                    {quiz.questions.length} questions
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />~{quiz.questions.length * 2} min
                  </div>
                </div>

                {/* Status */}
                {attempt ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Completed
                      </span>
                      <span>Score: {attempt.score}%</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Completed on {new Date(attempt.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400">Not attempted yet</div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => router.push(`/dashboard/quizzes/${quiz.id}`)}>
                    <PlayCircle className="mr-1 h-3 w-3" />
                    {attempt ? "Retake Quiz" : "Start Quiz"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/lectures/${quiz.lectureId}`)}
                  >
                    <BookOpen className="mr-1 h-3 w-3" />
                    Lecture
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredQuizzes.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <CardTitle className="text-xl mb-2">
              {lectureFilter ? "No quizzes for this lecture" : "No quizzes available"}
            </CardTitle>
            <CardDescription className="mb-4">
              {lectureFilter
                ? "This lecture doesn't have any quizzes yet"
                : "Quizzes will appear here once lectures are uploaded"}
            </CardDescription>
            <Button onClick={() => router.push("/dashboard/lectures")}>
              <BookOpen className="mr-2 h-4 w-4" />
              View Lectures
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
