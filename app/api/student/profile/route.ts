import { type NextRequest, NextResponse } from "next/server"

// Mock user data storage
let userData = {
  id: "1",
  name: "Jatin Upadhyay",
  email: "jatin@example.com",
  attendance: 85,
  scores: [80, 90, 75, 88, 92],
}

export async function GET() {
  return NextResponse.json({ profile: userData })
}

export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json()
    userData = { ...userData, ...updates }

    return NextResponse.json({ success: true, profile: userData })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
