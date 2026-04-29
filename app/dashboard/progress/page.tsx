"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Trophy, BookOpen, Brain, Clock, Target, CheckCircle, XCircle } from "lucide-react"

export default function ProgressPage() {
  const { user, lectures, getUserQuizAttempts } = useAppStore()

  if (!user) return null

  const quizAttempts = getUserQuizAttempts()
  const completedLectures = lectures.filter((l: any) => l.status === "completed")
  const processingLectures = lectures.filter((l: any) => l.status === "processing" || l.status === "queued")
  const pendingLectures = lectures.filter((l: any) => l.status === "uploaded" || l.status === "failed")

  const scores = user.scores || []
  const overallProgress = lectures.length > 0 ? Math.round((completedLectures.length / lectures.length) * 100) : 0
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
  const passedQuizzes = quizAttempts.filter((a: any) => a.score >= 70).length
  const recentScores = scores.slice(-10)

  const recentActivity = quizAttempts
    .filter((a: any) => {
      const d = new Date(a.completedAt)
      const week = new Date()
      week.setDate(week.getDate() - 7)
      return d >= week
    })
    .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your learning journey</p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Completion", value: `${overallProgress}%`, progress: overallProgress, sub: `${completedLectures.length}/${lectures.length} lectures`, icon: Target, color: "text-primary" },
          { label: "Avg Score", value: `${avgScore}%`, progress: avgScore, sub: `${scores.length} quizzes`, icon: Trophy, color: "text-amber-500" },
          { label: "Attendance", value: `${user.attendance || 0}%`, progress: user.attendance || 0, sub: "This semester", icon: BarChart3, color: "text-emerald-500" },
          { label: "Pass Rate", value: `${quizAttempts.length > 0 ? Math.round((passedQuizzes / quizAttempts.length) * 100) : 0}%`, progress: quizAttempts.length > 0 ? (passedQuizzes / quizAttempts.length) * 100 : 0, sub: `${passedQuizzes}/${quizAttempts.length} passed`, icon: Brain, color: "text-violet-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold mb-2">{s.value}</p>
              <Progress value={s.progress} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="lectures" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lectures"><BookOpen className="mr-1.5 h-3.5 w-3.5" /> Lectures</TabsTrigger>
          <TabsTrigger value="performance"><BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Performance</TabsTrigger>
          <TabsTrigger value="activity"><Clock className="mr-1.5 h-3.5 w-3.5" /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="lectures">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: "Completed", items: completedLectures, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
              { title: "Processing", items: processingLectures, icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20" },
              { title: "Pending", items: pendingLectures, icon: XCircle, color: "text-red-400", bg: "bg-red-50 dark:bg-red-950/20" },
            ].map((group) => (
              <Card key={group.title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <group.icon className={`h-4 w-4 ${group.color}`} />
                    {group.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${group.color} mb-3`}>{group.items.length}</p>
                  <div className="space-y-1.5">
                    {group.items.slice(0, 3).map((l: any) => (
                      <div key={l._id || l.id} className={`text-xs p-2 rounded ${group.bg}`}>{l.title}</div>
                    ))}
                    {group.items.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{group.items.length - 3} more</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Score Trend</CardTitle>
              <CardDescription className="text-xs">Last {recentScores.length} quizzes</CardDescription>
            </CardHeader>
            <CardContent>
              {recentScores.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-end gap-1.5 h-28">
                    {recentScores.map((score: number, i: number) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-primary/80 rounded-t transition-all"
                          style={{ height: `${(score / 100) * 100}%` }}
                        />
                        <span className="text-[10px] mt-1 text-muted-foreground">{score}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center pt-2 border-t">
                    <div>
                      <p className="text-lg font-bold text-emerald-500">{scores.length > 0 ? Math.max(...scores) : 0}%</p>
                      <p className="text-xs text-muted-foreground">Best</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-primary">{avgScore}%</p>
                      <p className="text-xs text-muted-foreground">Average</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-violet-500">
                        {scores.length > 1 ? (scores[scores.length - 1] > scores[scores.length - 2] ? "Improving" : "Declining") : "N/A"}
                      </p>
                      <p className="text-xs text-muted-foreground">Trend</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No scores to display yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-2.5">
                  {recentActivity.map((attempt: any, i: number) => (
                    <div key={attempt.id || i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2.5">
                        <Brain className="h-4 w-4 text-violet-500" />
                        <div>
                          <p className="text-sm font-medium">Quiz completed</p>
                          <p className="text-xs text-muted-foreground">{new Date(attempt.completedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge variant={attempt.score >= 70 ? "default" : "secondary"} className="text-xs">{attempt.score}%</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
