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
  const quiz = quizzes.find((q) => q.id === quizId)
  const lecture = quiz ? lectures.find((l) => l.id === quiz.lectureId) : null
  const userAttempts = getUserQuizAttempts()
  const previousAttempt = userAttempts.find((attempt) => attempt.quizId === quizId)

  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [quizResult, setQuizResult] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (quiz && !isSubmitted) {
      // Set timer for quiz (2 minutes per question)
      setTimeLeft(quiz.questions.length * 120)
      setAnswers(new Array(quiz.questions.length).fill(-1))
    }
  }, [quiz, isSubmitted])

  useEffect(() => {
    if (timeLeft > 0 && !isSubmitted) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && !isSubmitted) {
      handleSubmitQuiz()
    }
  }, [timeLeft, isSubmitted])

  if (!quiz || !lecture) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Quiz not found</h1>
        <Button onClick={() => router.push("/dashboard/quizzes")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Quizzes
        </Button>
      </div>
    )
  }

  const handleAnswerChange = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...answers]
    newAnswers[questionIndex] = answerIndex
    setAnswers(newAnswers)
  }

  const handleNextQuestion = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmitQuiz = () => {
    const result = submitQuizAttempt(quizId, answers)
    setQuizResult(result)
    setIsSubmitted(true)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getAnsweredCount = () => {
    return answers.filter((answer) => answer !== -1).length
  }

  const canSubmit = () => {
    return answers.every((answer) => answer !== -1)
  }

  if (isSubmitted && quizResult) {
    const correctAnswers = quiz.questions.filter((q, index) => answers[index] === q.correctAnswer).length
    const percentage = Math.round((correctAnswers / quiz.questions.length) * 100)
    const passed = percentage >= 70

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/quizzes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quiz Results</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{quiz.title}</p>
          </div>
        </div>

        {/* Results Card */}
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              {passed ? (
                <Trophy className="h-16 w-16 text-yellow-500" />
              ) : (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>
            <CardTitle className="text-2xl">{passed ? "Congratulations!" : "Keep Learning!"}</CardTitle>
            <CardDescription>
              You scored {correctAnswers} out of {quiz.questions.length} questions correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-4xl font-bold">
              <Badge variant={passed ? "default" : "secondary"} className="text-2xl px-4 py-2">
                {percentage}%
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{correctAnswers}</div>
                <div className="text-sm text-gray-600">Correct</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{quiz.questions.length - correctAnswers}</div>
                <div className="text-sm text-gray-600">Incorrect</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{quiz.questions.length}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => router.push(`/dashboard/lectures/${lecture.id}`)}>Review Lecture</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake Quiz
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard/quizzes")}>
                More Quizzes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Question Review */}
        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
            <CardDescription>Review your answers and see the correct solutions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {quiz.questions.map((question, index) => {
              const userAnswer = answers[index]
              const isCorrect = userAnswer === question.correctAnswer

              return (
                <div key={question.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">
                        Question {index + 1}: {question.question}
                      </h3>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className={`p-2 rounded text-sm ${
                              optionIndex === question.correctAnswer
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                : optionIndex === userAnswer && !isCorrect
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                                  : "bg-gray-50 dark:bg-gray-800"
                            }`}
                          >
                            {option}
                            {optionIndex === question.correctAnswer && " ✓ (Correct)"}
                            {optionIndex === userAnswer && optionIndex !== question.correctAnswer && " ✗ (Your answer)"}
                          </div>
                        ))}
                      </div>
                    </div>
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/quizzes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">From: {lecture.title}</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(timeLeft)}
          </Badge>
          {previousAttempt && <Badge variant="secondary">Previous: {previousAttempt.score}%</Badge>}
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress</span>
            <span>
              {currentQuestion + 1} of {quiz.questions.length}
            </span>
          </div>
          <Progress value={((currentQuestion + 1) / quiz.questions.length) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Question */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              Question {currentQuestion + 1}
            </CardTitle>
            <Badge variant="outline">
              {getAnsweredCount()} / {quiz.questions.length} answered
            </Badge>
          </div>
          <CardDescription className="text-base font-medium text-gray-900 dark:text-white">
            {quiz.questions[currentQuestion].question}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={answers[currentQuestion]?.toString() || ""}
            onValueChange={(value) => handleAnswerChange(currentQuestion, Number.parseInt(value))}
          >
            {quiz.questions[currentQuestion].options.map((option, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePreviousQuestion} disabled={currentQuestion === 0}>
          Previous
        </Button>

        <div className="flex gap-2">
          {currentQuestion === quiz.questions.length - 1 ? (
            <Button onClick={handleSubmitQuiz} disabled={!canSubmit()} className="px-8">
              Submit Quiz
            </Button>
          ) : (
            <Button onClick={handleNextQuestion} disabled={answers[currentQuestion] === -1}>
              Next
            </Button>
          )}
        </div>
      </div>

      {/* Submit Warning */}
      {!canSubmit() && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Please answer all questions before submitting the quiz.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
