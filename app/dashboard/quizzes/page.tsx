"use client"

import { useEffect } from "react"
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

  const { quizzes, lectures, getUserQuizAttempts, fetchQuizzes, fetchLectures } = useAppStore()
  const userAttempts = getUserQuizAttempts()

  useEffect(() => {
    fetchLectures()
    if (lectureFilter) fetchQuizzes(lectureFilter)
  }, [lectureFilter, fetchLectures, fetchQuizzes])

  const filteredQuizzes = lectureFilter ? quizzes.filter((q: any) => q.lectureId === lectureFilter) : quizzes

  const getQuizAttempt = (quizId: string) => userAttempts.find((a: any) => a.quizId === quizId)

  const getLectureTitle = (lectureId: string) => {
    const lecture = lectures.find((l: any) => l._id === lectureId || l.id === lectureId)
    return lecture?.title || "Unknown Lecture"
  }

  const stats = {
    total: quizzes.length,
    attempted: new Set(userAttempts.map((a: any) => a.quizId)).size,
    avgScore: userAttempts.length > 0
      ? Math.round(userAttempts.reduce((sum: number, a: any) => sum + a.score, 0) / userAttempts.length)
      : 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {lectureFilter ? `Quizzes for ${getLectureTitle(lectureFilter)}` : "Quizzes"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Test your knowledge and track progress</p>
        </div>
        {lectureFilter && (
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/quizzes")}>
            View All
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Brain, label: "Total Quizzes", value: stats.total, color: "text-primary" },
          { icon: CheckCircle, label: "Completed", value: stats.attempted, color: "text-emerald-500" },
          { icon: Trophy, label: "Avg Score", value: `${stats.avgScore}%`, color: "text-amber-500" },
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

      {/* Quiz grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQuizzes.map((quiz: any) => {
          const attempt = getQuizAttempt(quiz.id)
          return (
            <Card key={quiz.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base line-clamp-2 leading-snug">{quiz.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1.5 text-xs">
                      <BookOpen className="h-3 w-3" />
                      {getLectureTitle(quiz.lectureId)}
                    </CardDescription>
                  </div>
                  {attempt && (
                    <Badge variant={attempt.score >= 70 ? "default" : "secondary"} className="ml-2 text-xs">
                      {attempt.score}%
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> {quiz.questions?.length || 0} questions</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> ~{(quiz.questions?.length || 0) * 2} min</span>
                </div>

                {attempt ? (
                  <div className="text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Completed
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Not attempted</p>
                )}

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => router.push(`/dashboard/quizzes/${quiz.id}`)}>
                    <PlayCircle className="mr-1 h-3 w-3" />
                    {attempt ? "Retake" : "Start"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => router.push(`/dashboard/lectures/${quiz.lectureId}`)}>
                    <BookOpen className="mr-1 h-3 w-3" /> Lecture
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredQuizzes.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Brain className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-1">
              {lectureFilter ? "No quizzes for this lecture" : "No quizzes available"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {lectureFilter ? "This lecture doesn't have any quizzes yet" : "Quizzes appear once lectures are processed"}
            </p>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/lectures")}>
              <BookOpen className="mr-2 h-4 w-4" /> View Lectures
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
