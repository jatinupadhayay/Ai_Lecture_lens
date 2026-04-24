"use client"

import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { Trophy, Brain, TrendingUp, Target, RotateCcw } from "lucide-react"

export default function ScoresPage() {
  const router = useRouter()
  const { user, getUserQuizAttempts, quizzes, lectures } = useAppStore()

  if (!user) return null

  const quizAttempts = getUserQuizAttempts().sort(
    (a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  )

  const getQuizTitle = (quizId: string) => quizzes.find((q: any) => q.id === quizId)?.title || "Quiz"
  const getLectureTitle = (quizId: string) => {
    const quiz = quizzes.find((q: any) => q.id === quizId)
    if (!quiz) return "Unknown"
    return lectures.find((l: any) => l._id === quiz.lectureId || l.id === quiz.lectureId)?.title || "Unknown"
  }

  const scores = user.scores || []
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0
  const passedCount = quizAttempts.filter((a: any) => a.score >= 70).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scores</h1>
        <p className="text-muted-foreground text-sm mt-1">Your quiz performance history</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Best Score", value: `${bestScore}%`, icon: Trophy, color: "text-amber-500" },
          { label: "Average", value: `${avgScore}%`, icon: TrendingUp, color: "text-primary" },
          { label: "Passed", value: passedCount, icon: Target, color: "text-emerald-500" },
          { label: "Success Rate", value: `${quizAttempts.length > 0 ? Math.round((passedCount / quizAttempts.length) * 100) : 0}%`, icon: Brain, color: "text-violet-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Attempts</CardTitle>
          <CardDescription className="text-xs">Complete quiz performance history</CardDescription>
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
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizAttempts.map((attempt: any, i: number) => (
                  <TableRow key={attempt._id || attempt.id || i}>
                    <TableCell className="font-medium text-sm">{getQuizTitle(attempt.quizId)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getLectureTitle(attempt.quizId)}</TableCell>
                    <TableCell>
                      <span className="font-medium text-sm">{attempt.score}%</span>
                      {attempt.score >= 90 && <Trophy className="inline ml-1.5 h-3.5 w-3.5 text-amber-500" />}
                    </TableCell>
                    <TableCell>
                      <Badge variant={attempt.score >= 70 ? "default" : "secondary"} className="text-xs">
                        {attempt.score >= 70 ? "Passed" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(attempt.completedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => router.push(`/dashboard/quizzes/${attempt.quizId}`)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Retake
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Brain className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-semibold mb-1">No scores yet</p>
              <p className="text-sm text-muted-foreground mb-4">Take a quiz to see your scores</p>
              <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/quizzes")}>
                <Brain className="mr-2 h-3.5 w-3.5" /> Browse Quizzes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
