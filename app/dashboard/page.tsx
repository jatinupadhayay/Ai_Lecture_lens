"use client"

import { useEffect } from "react"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { BookOpen, Brain, Trophy, TrendingUp, Clock, PlayCircle, FileText, Plus } from "lucide-react"

export default function DashboardPage() {
  const router = useRouter()
  const { user, lectures, fetchLectures, getUserQuizAttempts } = useAppStore()

  useEffect(() => {
    fetchLectures()
  }, [fetchLectures])

  if (!user) return null

  const quizAttempts = getUserQuizAttempts()
  const completedLectures = lectures.filter((l: any) => l.status === "completed").length
  const totalLectures = lectures.length
  const averageScore =
    user.scores?.length > 0 ? Math.round(user.scores.reduce((a: number, b: number) => a + b, 0) / user.scores.length) : 0

  const recentLectures = [...lectures]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's an overview of your learning progress</p>
        </div>
        <Button onClick={() => router.push("/dashboard/lectures")}>
          <Plus className="mr-2 h-4 w-4" />
          New Lecture
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Lectures", value: totalLectures, sub: `${completedLectures} completed`, icon: BookOpen, color: "text-primary" },
          { label: "Avg Score", value: `${averageScore}%`, sub: `${user.scores?.length || 0} quizzes`, icon: Trophy, color: "text-amber-500" },
          { label: "Attendance", value: `${user.attendance || 0}%`, sub: "This semester", icon: TrendingUp, color: "text-emerald-500" },
          { label: "Quiz Attempts", value: quizAttempts.length, sub: "Total taken", icon: Brain, color: "text-violet-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent lectures + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent lectures */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Lectures</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/lectures")}>
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentLectures.length > 0 ? (
                <div className="space-y-3">
                  {recentLectures.map((lecture: any) => (
                    <div
                      key={lecture._id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/lectures/${lecture._id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <PlayCircle className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{lecture.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(lecture.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Badge
                          variant={lecture.status === "completed" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {lecture.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/dashboard/summaries?lecture=${lecture._id}`)
                          }}
                        >
                          <FileText className="mr-1 h-3 w-3" />
                          Summary
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">No lectures yet</p>
                  <Button size="sm" onClick={() => router.push("/dashboard/lectures")}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add your first lecture
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs">Latest quiz attempts</CardDescription>
          </CardHeader>
          <CardContent>
            {quizAttempts.length > 0 ? (
              <div className="space-y-3">
                {quizAttempts.slice(-5).reverse().map((attempt: any, i: number) => (
                  <div key={attempt.id || i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Brain className="h-4 w-4 text-violet-500" />
                      <div>
                        <p className="text-sm font-medium">Quiz completed</p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString() : "Recently"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={attempt.score >= 70 ? "default" : "secondary"} className="text-xs">
                      {attempt.score}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No quiz attempts yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
