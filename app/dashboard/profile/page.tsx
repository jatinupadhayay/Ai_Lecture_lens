"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Mail, Calendar, Trophy, BookOpen, Brain, TrendingUp, Save, Edit } from "lucide-react"

export default function ProfilePage() {
  const { user, updateProfile, lectures, getUserQuizAttempts } = useAppStore()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  if (!user) return null

  const quizAttempts = getUserQuizAttempts()
  const completedLectures = lectures.filter((lecture) => lecture.completionStatus === 100).length
  const averageScore =
    user.scores.length > 0 ? Math.round(user.scores.reduce((a, b) => a + b, 0) / user.scores.length) : 0

  const handleSave = async () => {
    setIsSaving(true)
    try {
      updateProfile(formData)
      setIsEditing(false)
      setSaveMessage("Profile updated successfully!")
      setTimeout(() => setSaveMessage(""), 3000)
    } catch (error) {
      setSaveMessage("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: user.name,
      email: user.email,
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account settings and view your progress</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      {saveMessage && (
        <Alert>
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-blue-600 text-white text-2xl">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{user.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
                  <Badge variant="outline" className="mt-1">
                    Student
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">{user.name}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  {isEditing ? (
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  ) : (
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">{user.email}</div>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Learning Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Learning Statistics
              </CardTitle>
              <CardDescription>Your learning journey at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{lectures.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Lectures</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedLectures}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{quizAttempts.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Quizzes Taken</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{averageScore}%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Score</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Quiz Scores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Recent Quiz Scores
              </CardTitle>
              <CardDescription>Your latest quiz performance</CardDescription>
            </CardHeader>
            <CardContent>
              {user.scores.length > 0 ? (
                <div className="space-y-3">
                  {user.scores
                    .slice(-5)
                    .reverse()
                    .map((score, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Brain className="h-4 w-4 text-purple-600" />
                          <span className="text-sm">Quiz {user.scores.length - index}</span>
                        </div>
                        <Badge variant={score >= 70 ? "default" : "secondary"}>{score}%</Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400 text-center py-4">No quiz scores yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Attendance</span>
                </div>
                <Badge variant="outline">{user.attendance}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Completion Rate</span>
                </div>
                <Badge variant="outline">{Math.round((completedLectures / lectures.length) * 100)}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm">Best Score</span>
                </div>
                <Badge variant="outline">{user.scores.length > 0 ? Math.max(...user.scores) : 0}%</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 dark:text-gray-400">Email verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 dark:text-gray-400">Member since Jan 2024</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600 dark:text-gray-400">Student account</span>
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Achievements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {completedLectures >= 1 && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Trophy className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300">First Lecture Complete</span>
                </div>
              )}
              {quizAttempts.length >= 1 && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Brain className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">Quiz Taker</span>
                </div>
              )}
              {averageScore >= 80 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <Trophy className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">High Achiever</span>
                </div>
              )}
              {completedLectures === 0 && quizAttempts.length === 0 && (
                <p className="text-gray-600 dark:text-gray-400 text-sm text-center py-2">
                  Complete lectures and take quizzes to earn achievements!
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
