"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAppStore } from "@/lib/store"
import type { Quiz } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BookOpen,
  Brain,
  CheckCircle,
  Clock,
  PlayCircle,
  Trophy,
} from "lucide-react"

export default function QuizzesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lectureFilter = searchParams.get("lecture")

  const { quizzes, lectures, getUserQuizAttempts, fetchQuizzes, fetchLectures } = useAppStore()
  const userAttempts = getUserQuizAttempts()

  useEffect(() => {
    fetchLectures()
    fetchQuizzes(lectureFilter || undefined)
  }, [lectureFilter, fetchLectures, fetchQuizzes])

  const filteredQuizzes = lectureFilter
    ? quizzes.filter((quiz) => quiz.lectureId === lectureFilter)
    : quizzes

  const getQuizAttempt = (quizId: string) =>
    userAttempts.find((attempt) => attempt.quizId === quizId)

  const getLectureTitle = (lectureId: string) => {
    const lecture = lectures.find((item) => (item._id || item.id) === lectureId)
    return lecture?.title || "Unknown Lecture"
  }

  const stats = {
    total: filteredQuizzes.length,
    attempted: new Set(filteredQuizzes.map((quiz) => getQuizAttempt(quiz.id)?.quizId).filter(Boolean))
      .size,
    avgScore:
      userAttempts.length > 0
        ? Math.round(
            userAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / userAttempts.length
          )
        : 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {lectureFilter ? `Quizzes for ${getLectureTitle(lectureFilter)}` : "Quizzes"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Test your knowledge and track progress
          </p>
        </div>

        {lectureFilter && (
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/quizzes")}>
            View All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Brain, label: "Total Quizzes", value: stats.total, color: "text-primary" },
          {
            icon: CheckCircle,
            label: "Completed",
            value: stats.attempted,
            color: "text-emerald-500",
          },
          {
            icon: Trophy,
            label: "Avg Score",
            value: `${stats.avgScore}%`,
            color: "text-amber-500",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQuizzes.map((quiz: Quiz) => {
          const attempt = getQuizAttempt(quiz.id)

          return (
            <Card key={quiz.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base line-clamp-2 leading-snug">
                      {quiz.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1.5 text-xs">
                      <BookOpen className="h-3 w-3" />
                      {getLectureTitle(quiz.lectureId)}
                    </CardDescription>
                  </div>
                  {attempt && (
                    <Badge
                      variant={attempt.score >= 70 ? "default" : "secondary"}
                      className="ml-2 text-xs"
                    >
                      {attempt.score}%
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Brain className="h-3 w-3" /> {quiz.questions?.length || 0} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ~{(quiz.questions?.length || 0) * 2} min
                  </span>
                </div>

                {attempt ? (
                  <div className="text-xs">
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Completed
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Not attempted</p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => router.push(`/dashboard/quizzes/${quiz.id}`)}
                  >
                    <PlayCircle className="mr-1 h-3 w-3" />
                    {attempt ? "Retake" : "Start"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => router.push(`/dashboard/lectures/${quiz.lectureId}`)}
                  >
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
              {lectureFilter
                ? "This lecture does not have a quiz yet."
                : "Quizzes appear once lectures are processed."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/lectures")}
            >
              <BookOpen className="mr-2 h-4 w-4" /> View Lectures
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
