import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Mock authentication - in real app, this would validate against a database
    if (email === "jatin@example.com" && password === "password") {
      return NextResponse.json({
        success: true,
        user: {
          id: "1",
          name: "Jatin Upadhyay",
          email: "jatin@example.com",
          attendance: 85,
          scores: [80, 90, 75, 88, 92],
        },
      })
    }

    return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
