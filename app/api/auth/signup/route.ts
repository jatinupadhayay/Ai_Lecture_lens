import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Mock signup - in real app, this would create a user in the database
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      attendance: 0,
      scores: [],
    }

    return NextResponse.json({
      success: true,
      user: newUser,
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
