import { type NextRequest, NextResponse } from "next/server"

// Mock data storage (in real app, this would be a database)
const lectures = [
  {
    id: "1",
    title: "AI Basics Lecture",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    pptFile: "/slides/ai-basics.pdf", // Added pptFile to mock data
    completionStatus: 75,
    uploadedAt: "2024-01-15",
  },
  {
    id: "2",
    title: "Machine Learning Fundamentals",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    pptFile: "/slides/ml-fundamentals.pdf", // Added pptFile to mock data
    completionStatus: 50,
    uploadedAt: "2024-01-20",
  },
  {
    id: "3",
    title: "Deep Learning Introduction",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    completionStatus: 100,
    uploadedAt: "2024-01-25",
  },
]

export async function GET() {
  return NextResponse.json({ lectures })
}

export async function POST(request: NextRequest) {
  try {
    const { title, url, pptFile } = await request.json() // Added pptFile parameter

    const newLecture = {
      id: Date.now().toString(),
      title,
      url,
      ...(pptFile && { pptFile }), // Conditionally include pptFile if provided
      completionStatus: 0,
      uploadedAt: new Date().toISOString().split("T")[0],
    }

    lectures.push(newLecture)

    return NextResponse.json({ success: true, lecture: newLecture })
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 })
  }
}
