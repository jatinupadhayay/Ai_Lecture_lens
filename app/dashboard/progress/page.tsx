"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Calendar, Trophy, BookOpen, Brain, Clock, Target, CheckCircle, XCircle } from "lucide-react"

export default function ProgressPage() {
  const { user, lectures, getUserQuizAttempts } = useAppStore()

  if (!user) return null

  const quizAttempts = getUserQuizAttempts()
  const completedLectures = lectures.filter((lecture) => lecture.completionStatus === 100)
  const inProgressLectures = lectures.filter(
    (lecture) => lecture.completionStatus > 0 && lecture.completionStatus < 100,
  )
  const notStartedLectures = lectures.filter((lecture) => lecture.completionStatus === 0)

  // Calculate progress metrics
  const overallProgress = lectures.length > 0 ? Math.round((completedLectures.length / lectures.length) * 100) : 0
  const averageScore =
    user.scores.length > 0 ? Math.round(user.scores.reduce((a, b) => a + b, 0) / user.scores.length) : 0
  const totalQuizzes = quizAttempts.length
  const passedQuizzes = quizAttempts.filter((attempt) => attempt.score >= 70).length

  // Recent activity (last 7 days)
  const recentActivity = quizAttempts
    .filter((attempt) => {
      const attemptDate = new Date(attempt.completedAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return attemptDate >= weekAgo
    })
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

  // Score trend (last 10 scores)
  const recentScores = user.scores.slice(-10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Learning Progress</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track your learning journey and performance analytics</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{overallProgress}%</div>
            <Progress value={overallProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedLectures.length} of {lectures.length} lectures completed
            </p>
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
            <div className="text-2xl font-bold mb-2">{averageScore}%</div>
            <Progress value={averageScore} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">From {user.scores.length} quiz attempts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{user.attendance}%</div>
            <Progress value={user.attendance} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">This semester</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              Quiz Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              {totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0}%
            </div>
            <Progress value={totalQuizzes > 0 ? (passedQuizzes / totalQuizzes) * 100 : 0} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {passedQuizzes} of {totalQuizzes} quizzes passed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="lectures" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="lectures">
            <BookOpen className="mr-2 h-4 w-4" />
            Lectures
          </TabsTrigger>
          <TabsTrigger value="quizzes">
            <Brain className="mr-2 h-4 w-4" />
            Quizzes
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="mr-2 h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Clock className="mr-2 h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lectures" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 mb-4">{completedLectures.length}</div>
                <div className="space-y-2">
                  {completedLectures.slice(0, 3).map((lecture) => (
                    <div key={lecture.id} className="text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      {lecture.title}
                    </div>
                  ))}
                  {completedLectures.length > 3 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">+{completedLectures.length - 3} more</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600 mb-4">{inProgressLectures.length}</div>
                <div className="space-y-2">
                  {inProgressLectures.slice(0, 3).map((lecture) => (
                    <div key={lecture.id} className="text-sm">
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded mb-1">{lecture.title}</div>
                      <Progress value={lecture.completionStatus} className="h-1" />
                    </div>
                  ))}
                  {inProgressLectures.length > 3 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      +{inProgressLectures.length - 3} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  Not Started
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 mb-4">{notStartedLectures.length}</div>
                <div className="space-y-2">
                  {notStartedLectures.slice(0, 3).map((lecture) => (
                    <div key={lecture.id} className="text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      {lecture.title}
                    </div>
                  ))}
                  {notStartedLectures.length > 3 && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      +{notStartedLectures.length - 3} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Performance Overview</CardTitle>
              <CardDescription>Your quiz attempts and scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-3">Score Distribution</h3>
                  <div className="space-y-2">
                    {[
                      { range: "90-100%", count: user.scores.filter((s) => s >= 90).length, color: "bg-green-500" },
                      {
                        range: "80-89%",
                        count: user.scores.filter((s) => s >= 80 && s < 90).length,
                        color: "bg-blue-500",
                      },
                      {
                        range: "70-79%",
                        count: user.scores.filter((s) => s >= 70 && s < 80).length,
                        color: "bg-yellow-500",
                      },
                      { range: "Below 70%", count: user.scores.filter((s) => s < 70).length, color: "bg-red-500" },
                    ].map((item) => (
                      <div key={item.range} className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${item.color}`} />
                        <span className="text-sm flex-1">{item.range}</span>
                        <span className="text-sm font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-3">Recent Quiz Attempts</h3>
                  <div className="space-y-2">
                    {quizAttempts
                      .slice(-5)
                      .reverse()
                      .map((attempt, index) => (
                        <div
                          key={attempt.id}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                        >
                          <span className="text-sm">Quiz {quizAttempts.length - index}</span>
                          <Badge variant={attempt.score >= 70 ? "default" : "secondary"}>{attempt.score}%</Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Your learning performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3">Score Trend (Last 10 Quizzes)</h3>
                  <div className="flex items-end gap-2 h-32">
                    {recentScores.map((score, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(score / 100) * 100}%` }} />
                        <span className="text-xs mt-1">{score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {user.scores.length > 0 ? Math.max(...user.scores) : 0}%
                    </div>
                    <div className="text-sm text-gray-600">Best Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{averageScore}%</div>
                    <div className="text-sm text-gray-600">Average Score</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {user.scores.length > 1
                        ? user.scores[user.scores.length - 1] - user.scores[user.scores.length - 2] > 0
                          ? "↗"
                          : "↘"
                        : "—"}
                    </div>
                    <div className="text-sm text-gray-600">Trend</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your learning activity in the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((attempt) => (
                    <div
                      key={attempt.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Brain className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium">Quiz Completed</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(attempt.completedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={attempt.score >= 70 ? "default" : "secondary"}>{attempt.score}%</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
                  <p className="text-sm text-gray-500">Complete some quizzes to see your activity here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
