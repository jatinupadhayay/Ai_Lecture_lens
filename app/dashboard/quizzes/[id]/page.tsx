"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Clock, Brain, CheckCircle, XCircle, Trophy, RotateCcw } from "lucide-react"

export default function QuizPage() {
  const params = useParams()
  const router = useRouter()
  const { quizzes, lectures, submitQuizAttempt, getUserQuizAttempts } = useAppStore()

  const quizId = params.id as string
  const quiz = quizzes.find((q: any) => q.id === quizId)
  const lecture = quiz ? lectures.find((l: any) => l._id === quiz.lectureId || l.id === quiz.lectureId) : null
  const previousAttempt = getUserQuizAttempts().find((a: any) => a.quizId === quizId)

  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [quizResult, setQuizResult] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (quiz && !isSubmitted) {
      setTimeLeft(quiz.questions.length * 120)
      setAnswers(new Array(quiz.questions.length).fill(-1))
    }
  }, [quiz, isSubmitted])

  useEffect(() => {
    if (timeLeft > 0 && !isSubmitted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && answers.length > 0 && !isSubmitted) {
      handleSubmitQuiz()
    }
  }, [timeLeft, isSubmitted])

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

  const handleAnswerChange = (qi: number, ai: number) => {
    const newAnswers = [...answers]
    newAnswers[qi] = ai
    setAnswers(newAnswers)
  }

  const handleSubmitQuiz = () => {
    const result = submitQuizAttempt(quizId, answers)
    setQuizResult(result)
    setIsSubmitted(true)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
  const answeredCount = answers.filter((a) => a !== -1).length
  const canSubmit = answers.every((a) => a !== -1)

  // Results view
  if (isSubmitted && quizResult) {
    const correctCount = quiz.questions.filter((q: any, i: number) => answers[i] === q.correctAnswer).length
    const pct = Math.round((correctCount / quiz.questions.length) * 100)
    const passed = pct >= 70

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/dashboard/quizzes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Quiz Results</h1>
            <p className="text-xs text-muted-foreground">{quiz.title}</p>
          </div>
        </div>

        <Card className="text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            {passed ? <Trophy className="h-14 w-14 text-amber-500 mx-auto" /> : <XCircle className="h-14 w-14 text-red-400 mx-auto" />}
            <div>
              <h2 className="text-xl font-bold">{passed ? "Great job!" : "Keep practicing!"}</h2>
              <p className="text-sm text-muted-foreground">{correctCount} of {quiz.questions.length} correct</p>
            </div>
            <Badge variant={passed ? "default" : "secondary"} className="text-xl px-4 py-1.5">{pct}%</Badge>
            <div className="flex gap-3 justify-center pt-2">
              <Button size="sm" onClick={() => router.push(`/dashboard/lectures/${lecture._id || lecture.id}`)}>Review Lecture</Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retake
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quiz.questions.map((question: any, index: number) => {
              const userAnswer = answers[index]
              const isCorrect = userAnswer === question.correctAnswer
              return (
                <div key={question.id} className="rounded-lg border p-4">
                  <div className="flex items-start gap-2.5 mb-2">
                    {isCorrect ? <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                    <p className="text-sm font-medium">Q{index + 1}: {question.question}</p>
                  </div>
                  <div className="space-y-1.5 ml-6">
                    {question.options.map((opt: string, oi: number) => (
                      <div
                        key={oi}
                        className={`text-xs px-3 py-1.5 rounded ${
                          oi === question.correctAnswer
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                            : oi === userAnswer && !isCorrect
                              ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                              : "bg-muted"
                        }`}
                      >
                        {opt}
                        {oi === question.correctAnswer && " (correct)"}
                        {oi === userAnswer && oi !== question.correctAnswer && " (your answer)"}
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

  // Quiz-taking view
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/dashboard/quizzes")}>
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
          {previousAttempt && <Badge variant="secondary" className="text-xs">Previous: {previousAttempt.score}%</Badge>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex justify-between text-xs mb-1.5">
            <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
            <span>{answeredCount} answered</span>
          </div>
          <Progress value={((currentQuestion + 1) / quiz.questions.length) * 100} className="h-1.5" />
        </CardContent>
      </Card>

      <Card>
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
            onValueChange={(v) => handleAnswerChange(currentQuestion, parseInt(v))}
          >
            {quiz.questions[currentQuestion].options.map((option: string, index: number) => (
              <div key={index} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent transition-colors">
                <RadioGroupItem value={index.toString()} id={`opt-${index}`} />
                <Label htmlFor={`opt-${index}`} className="flex-1 cursor-pointer text-sm">{option}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))} disabled={currentQuestion === 0}>
          Previous
        </Button>
        {currentQuestion === quiz.questions.length - 1 ? (
          <Button size="sm" onClick={handleSubmitQuiz} disabled={!canSubmit}>Submit Quiz</Button>
        ) : (
          <Button size="sm" onClick={() => setCurrentQuestion(currentQuestion + 1)} disabled={answers[currentQuestion] === -1}>
            Next
          </Button>
        )}
      </div>
    </div>
  )
}
