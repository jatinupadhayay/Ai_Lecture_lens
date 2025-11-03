"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { Trophy, Calendar, Brain, TrendingUp, RotateCcw, Eye } from "lucide-react"

export default function ScoresPage() {
  const router = useRouter()
  const { user, getUserQuizAttempts, quizzes, lectures } = useAppStore()

  if (!user) return null

  const quizAttempts = getUserQuizAttempts().sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  )

  const getQuizTitle = (quizId: string) => {
    const quiz = quizzes.find((q) => q.id === quizId)
    return quiz?.title || "Unknown Quiz"
  }

  const getLectureTitle = (quizId: string) => {
    const quiz = quizzes.find((q) => q.id === quizId)
    if (!quiz) return "Unknown Lecture"
    const lecture = lectures.find((l) => l.id === quiz.lectureId)
    return lecture?.title || "Unknown Lecture"
  }

  const averageScore =
    user.scores.length > 0 ? Math.round(user.scores.reduce((a, b) => a + b, 0) / user.scores.length) : 0
  const bestScore = user.scores.length > 0 ? Math.max(...user.scores) : 0
  const passedQuizzes = quizAttempts.filter((attempt) => attempt.score >= 70).length
  const totalQuizzes = quizAttempts.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quiz Scores</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">View all your quiz attempts and performance history</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-600" />
              Best Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bestScore}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageScore}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-green-600" />
              Passed Quizzes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{passedQuizzes}</div>
            <p className="text-xs text-muted-foreground">out of {totalQuizzes}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Quiz Attempts</CardTitle>
          <CardDescription>Complete history of your quiz performance</CardDescription>
        </CardHeader>
        <CardContent>
          {quizAttempts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Lecture</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizAttempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="font-medium">{getQuizTitle(attempt.quizId)}</TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">
                      {getLectureTitle(attempt.quizId)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{attempt.score}%</span>
                        {attempt.score >= 90 && <Trophy className="h-4 w-4 text-yellow-500" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={attempt.score >= 70 ? "default" : "secondary"}>
                        {attempt.score >= 70 ? "Passed" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">
                      {new Date(attempt.completedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/quizzes/${attempt.quizId}`)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/quizzes/${attempt.quizId}`)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retake
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <CardTitle className="text-xl mb-2">No quiz scores yet</CardTitle>
              <CardDescription className="mb-4">Take your first quiz to see your scores here</CardDescription>
              <Button onClick={() => router.push("/dashboard/quizzes")}>
                <Brain className="mr-2 h-4 w-4" />
                Browse Quizzes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
