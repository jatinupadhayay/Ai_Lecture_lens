"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { BookOpen, Brain, Trophy, TrendingUp, Clock, Target, PlayCircle, FileText } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const { user, lectures, getUserQuizAttempts } = useAppStore()

  if (!user) return null

  const quizAttempts = getUserQuizAttempts()
  const completedLectures = lectures.filter((lecture) => lecture.completionStatus === 100).length
  const totalLectures = lectures.length
  const averageScore =
    user.scores.length > 0 ? Math.round(user.scores.reduce((a, b) => a + b, 0) / user.scores.length) : 0

  const recentLectures = lectures.slice(0, 3)
  const recentQuizzes = quizAttempts.slice(-3)

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {user.name}!</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Here's your learning progress overview</p>
        </div>
        <Button onClick={() => router.push("/dashboard/lectures")}>
          <BookOpen className="mr-2 h-4 w-4" />
          Add New Lecture
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lectures</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLectures}</div>
            <p className="text-xs text-muted-foreground">{completedLectures} completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageScore}%</div>
            <p className="text-xs text-muted-foreground">From {user.scores.length} quizzes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user.attendance}%</div>
            <p className="text-xs text-muted-foreground">This semester</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quizzes Taken</CardTitle>
            <Brain className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quizAttempts.length}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Learning Progress
            </CardTitle>
            <CardDescription>Your overall course completion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Course Completion</span>
                <span>{Math.round((completedLectures / totalLectures) * 100)}%</span>
              </div>
              <Progress value={(completedLectures / totalLectures) * 100} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Quiz Performance</span>
                <span>{averageScore}%</span>
              </div>
              <Progress value={averageScore} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Attendance Rate</span>
                <span>{user.attendance}%</span>
              </div>
              <Progress value={user.attendance} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest learning activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentQuizzes.length > 0 ? (
                recentQuizzes.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Brain className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium">Quiz Completed</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(attempt.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={attempt.score >= 70 ? "default" : "secondary"}>{attempt.score}%</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No recent quiz attempts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Lectures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-blue-600" />
            Recent Lectures
          </CardTitle>
          <CardDescription>Continue where you left off</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentLectures.map((lecture) => (
              <Card key={lecture.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{lecture.title}</CardTitle>
                  <CardDescription className="text-xs">
                    Uploaded {new Date(lecture.uploadedAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{lecture.completionStatus}%</span>
                    </div>
                    <Progress value={lecture.completionStatus} className="h-1" />
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 bg-transparent"
                        onClick={() => router.push(`/dashboard/lectures/${lecture.id}`)}
                      >
                        <PlayCircle className="mr-1 h-3 w-3" />
                        Watch
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/summaries?lecture=${lecture.id}`)}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Summary
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}