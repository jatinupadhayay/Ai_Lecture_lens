"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Mail, Calendar, Trophy, BookOpen, Brain, TrendingUp, Save, Edit } from "lucide-react"

export default function ProfilePage() {
  const { user, updateProfile, lectures, getUserQuizAttempts } = useAppStore()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({ name: user?.name || "", email: user?.email || "" })
  const [isSaving, setIsSaving] = useState(false)

  if (!user) return null

  const quizAttempts = getUserQuizAttempts()
  const completedLectures = lectures.filter((l: any) => l.status === "completed").length
  const scores = user.scores || []
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const success = await updateProfile(formData)
      if (success) {
        setIsEditing(false)
        toast.success("Profile updated")
      } else {
        toast.error("Failed to update profile")
      }
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account</p>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Profile card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Personal Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl font-medium">
                    {user.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <Badge variant="outline" className="mt-1 text-xs capitalize">{user.role || "student"}</Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  {isEditing ? (
                    <Input value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} />
                  ) : (
                    <div className="p-2 bg-muted/50 rounded-md text-sm">{user.name}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  {isEditing ? (
                    <Input type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} />
                  ) : (
                    <div className="p-2 bg-muted/50 rounded-md text-sm">{user.email}</div>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-1.5 h-3.5 w-3.5" /> {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setFormData({ name: user.name, email: user.email }) }}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {[
                  { label: "Lectures", value: lectures.length, color: "text-primary" },
                  { label: "Completed", value: completedLectures, color: "text-emerald-500" },
                  { label: "Quizzes", value: quizAttempts.length, color: "text-violet-500" },
                  { label: "Avg Score", value: `${avgScore}%`, color: "text-amber-500" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Calendar, label: "Attendance", value: `${user.attendance || 0}%`, color: "text-primary" },
                { icon: BookOpen, label: "Completion", value: `${lectures.length > 0 ? Math.round((completedLectures / lectures.length) * 100) : 0}%`, color: "text-emerald-500" },
                { icon: Trophy, label: "Best Score", value: `${scores.length > 0 ? Math.max(...scores) : 0}%`, color: "text-amber-500" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-sm">{s.label}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{s.value}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email verified</div>
              <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> <span className="capitalize">{user.role || "Student"}</span> account</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Achievements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {completedLectures >= 1 && (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-300">
                  <Trophy className="h-3.5 w-3.5" /> First Lecture Complete
                </div>
              )}
              {quizAttempts.length >= 1 && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg text-xs text-primary">
                  <Brain className="h-3.5 w-3.5" /> Quiz Taker
                </div>
              )}
              {avgScore >= 80 && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                  <Trophy className="h-3.5 w-3.5" /> High Achiever
                </div>
              )}
              {completedLectures === 0 && quizAttempts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Complete lectures and quizzes to earn achievements</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
