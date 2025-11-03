import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { answers } = await request.json()
    const quizId = params.id

    // Mock quiz data for scoring
    const quizQuestions: Record<string, any> = {
      "1": [{ correctAnswer: 1 }, { correctAnswer: 1 }, { correctAnswer: 3 }],
      "2": [{ correctAnswer: 0 }, { correctAnswer: 1 }],
    }

    const questions = quizQuestions[quizId] || []
    let correctAnswers = 0

    questions.forEach((question: any, index: number) => {
      if (answers[index] === question.correctAnswer) {
        correctAnswers++
      }
    })

    const score = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0
    const passed = score >= 70

    return NextResponse.json({
      success: true,
      score,
      passed,
      correctAnswers,
      totalQuestions: questions.length,
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
