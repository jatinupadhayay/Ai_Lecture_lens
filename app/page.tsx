"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Brain, Trophy, User } from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAppStore()

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">Smart Lecture AI Lens</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Transform your learning experience with AI-powered lecture analysis, intelligent summaries, and personalized
            quizzes.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => router.push("/auth/login")} className="px-8 py-3">
              Get Started
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push("/auth/signup")} className="px-8 py-3">
              Sign Up
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center">
            <CardHeader>
              <BookOpen className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Smart Lectures</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Upload and organize your lectures with intelligent content analysis</CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Brain className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>AI Summaries</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Get comprehensive chapter-wise summaries powered by AI</CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Trophy className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <CardTitle>Interactive Quizzes</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Test your knowledge with auto-generated quizzes and track progress</CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <User className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Progress Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Monitor your learning journey with detailed analytics</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Demo Section */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Experience the Future of Learning</CardTitle>
            <CardDescription>Join thousands of students already using Smart Lecture AI Lens</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">10,000+</div>
                <div className="text-gray-600 dark:text-gray-300">Lectures Analyzed</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">95%</div>
                <div className="text-gray-600 dark:text-gray-300">Student Satisfaction</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">50,000+</div>
                <div className="text-gray-600 dark:text-gray-300">Quizzes Completed</div>
              </div>
            </div>
            <Button size="lg" onClick={() => router.push("/auth/login")} className="px-12 py-3">
              Start Learning Today
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
