"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  ArrowLeft,
  Brain,
  CheckCircle,
  Clock,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react"

export default function QuizPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const {
    quizzes,
    lectures,
    fetchLectures,
    fetchQuizzes,
    submitQuizAttempt,
    getUserQuizAttempts,
  } = useAppStore()

  const quizId = params.id
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [timeLeft, setTimeLeft] = useState(0)
  const [attemptResult, setAttemptResult] = useState<{
    score: number
    correct: number
    total: number
  } | null>(null)

  useEffect(() => {
    fetchLectures()
    fetchQuizzes(quizId)
  }, [quizId, fetchLectures, fetchQuizzes])

  const quiz = useMemo(
    () => quizzes.find((item: Quiz) => item.id === quizId),
    [quizId, quizzes]
  )
  const lecture = quiz
    ? lectures.find((item) => (item._id || item.id) === quiz.lectureId)
    : null
  const previousAttempt = getUserQuizAttempts().find((attempt) => attempt.quizId === quizId)

  useEffect(() => {
    if (!quiz || isSubmitted) return
    setTimeLeft(quiz.questions.length * 120)
    setAnswers(new Array(quiz.questions.length).fill(-1))
  }, [quiz, isSubmitted])

  useEffect(() => {
    if (timeLeft <= 0 || isSubmitted || !answers.length) return

    const timer = setTimeout(() => setTimeLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [answers.length, isSubmitted, timeLeft])

  useEffect(() => {
    if (timeLeft === 0 && answers.length > 0 && !isSubmitted) {
      void handleSubmitQuiz()
    }
  }, [answers.length, isSubmitted, timeLeft])

  const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
    setAnswers((previous) => {
      const next = [...previous]
      next[questionIndex] = answerIndex
      return next
    })
  }

  const handleSubmitQuiz = async () => {
    if (!quiz || submitting) return

    setSubmitting(true)
    setSubmitError("")

    try {
      const result = await submitQuizAttempt(quizId, answers)
      setAttemptResult({
        score: result.score,
        correct: result.correct,
        total: result.total,
      })
      setIsSubmitted(true)
    } catch {
      setSubmitError("Failed to submit quiz. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const resetQuiz = () => {
    if (!quiz) return
    setCurrentQuestion(0)
    setAnswers(new Array(quiz.questions.length).fill(-1))
    setTimeLeft(quiz.questions.length * 120)
    setAttemptResult(null)
    setSubmitError("")
    setIsSubmitted(false)
  }

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`

  if (!quiz || !lecture) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold mb-3">Quiz not found</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/quizzes")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quizzes
        </Button>
      </div>
    )
  }

  const answeredCount = answers.filter((answer) => answer !== -1).length
  const canSubmit = answers.every((answer) => answer !== -1)

  if (isSubmitted && attemptResult) {
    const passed = attemptResult.score >= 70

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/dashboard/quizzes")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Quiz Results</h1>
            <p className="text-xs text-muted-foreground">{quiz.title}</p>
          </div>
        </div>

        <Card className="text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            {passed ? (
              <Trophy className="h-14 w-14 text-amber-500 mx-auto" />
            ) : (
              <XCircle className="h-14 w-14 text-red-400 mx-auto" />
            )}
            <div>
              <h2 className="text-xl font-bold">{passed ? "Great job!" : "Keep practicing!"}</h2>
              <p className="text-sm text-muted-foreground">
                {attemptResult.correct} of {attemptResult.total} correct
              </p>
            </div>
            <Badge variant={passed ? "default" : "secondary"} className="text-xl px-4 py-1.5">
              {attemptResult.score}%
            </Badge>
            <div className="flex gap-3 justify-center pt-2">
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/lectures/${lecture._id || lecture.id}`)}
              >
                Review Lecture
              </Button>
              <Button size="sm" variant="outline" onClick={resetQuiz}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retake
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quiz.questions.map((question, index) => {
              const userAnswer = answers[index]
              const isCorrect = userAnswer === question.correctAnswer

              return (
                <div key={question.id} className="rounded-lg border p-4">
                  <div className="flex items-start gap-2.5 mb-2">
                    {isCorrect ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                    )}
                    <p className="text-sm font-medium">
                      Q{index + 1}: {question.question}
                    </p>
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className={`text-xs px-3 py-1.5 rounded ${
                          optionIndex === question.correctAnswer
                            ? "bg-emerald-50 text-emerald-700"
                            : optionIndex === userAnswer && !isCorrect
                              ? "bg-red-50 text-red-700"
                              : "bg-muted"
                        }`}
                      >
                        {option}
                        {optionIndex === question.correctAnswer && " (correct)"}
                        {optionIndex === userAnswer &&
                          optionIndex !== question.correctAnswer &&
                          " (your answer)"}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/dashboard/quizzes")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight truncate">{quiz.title}</h1>
          <p className="text-xs text-muted-foreground">From: {lecture.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            <Clock className="h-3 w-3 mr-1" /> {formatTime(timeLeft)}
          </Badge>
          {previousAttempt && (
            <Badge variant="secondary" className="text-xs">
              Previous: {previousAttempt.score}%
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span>
              Question {currentQuestion + 1} of {quiz.questions.length}
            </span>
            <span>{answeredCount} answered</span>
          </div>
          <Progress value={((currentQuestion + 1) / quiz.questions.length) * 100} className="h-1.5" />
        </CardContent>
      </Card>

      <Card key={currentQuestion} className="quiz-card-in">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" /> Question {currentQuestion + 1}
          </CardTitle>
          <CardDescription className="text-sm font-medium text-foreground pt-1">
            {quiz.questions[currentQuestion].question}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={answers[currentQuestion]?.toString() || ""}
            onValueChange={(value) => handleAnswerChange(currentQuestion, parseInt(value, 10))}
          >
            {quiz.questions[currentQuestion].options.map((option, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <RadioGroupItem value={index.toString()} id={`opt-${index}`} />
                <Label htmlFor={`opt-${index}`} className="flex-1 cursor-pointer text-sm">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentQuestion((value) => Math.max(0, value - 1))}
          disabled={currentQuestion === 0}
        >
          Previous
        </Button>
        {currentQuestion === quiz.questions.length - 1 ? (
          <Button size="sm" onClick={handleSubmitQuiz} disabled={!canSubmit || submitting}>
            {submitting ? "Submitting..." : "Submit Quiz"}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setCurrentQuestion((value) => value + 1)}
            disabled={answers[currentQuestion] === -1}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  )
}
