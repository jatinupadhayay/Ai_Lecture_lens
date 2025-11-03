"use client"

import { useState } from "react"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import {
  Plus,
  PlayCircle,
  FileText,
  Brain,
  Calendar,
  ExternalLink,
  Presentation,
  Video,
  AudioLines,
} from "lucide-react"



// ✅ Helper for media URLs
const getFullMediaUrl = (path?: string) => {
  if (!path) return ""
  const base =
    process.env.NEXT_PUBLIC_API_BASE?.replace("/api", "") || "http://localhost:5000"
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

export default function LecturesPage() {
  const router = useRouter()
  const { lectures, uploadLecture } = useAppStore()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [newLecture, setNewLecture] = useState({
    title: "",
    url: "",
    pptFile: null as File | null,
    audioFile: null as File | null,
    videoFile: null as File | null,
  })

  // ✅ Upload lecture (supports YouTube or local file(s))
  const handleAddLecture = async () => {
    if (!newLecture.title) return
    if (
      !newLecture.url &&
      !newLecture.videoFile &&
      !newLecture.audioFile &&
      !newLecture.pptFile
    ) {
      alert("Please upload a YouTube URL or at least one file.")
      return
    }

    setIsUploading(true)
    try {
      await uploadLecture({
        title: newLecture.title,
        youtubeUrl: newLecture.url || "",
        pptFile: newLecture.pptFile,
        audioFile: newLecture.audioFile,
        videoFile: newLecture.videoFile,
      })

      setNewLecture({ title: "", url: "", pptFile: null, audioFile: null, videoFile: null })
      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error uploading lecture:", error)
      alert("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  // ✅ Handle file input
  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "ppt" | "audio" | "video"
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    switch (type) {
      case "ppt":
        if (file.type === "application/pdf" || file.name.endsWith(".ppt") || file.name.endsWith(".pptx")) {
          setNewLecture((prev) => ({ ...prev, pptFile: file }))
        } else {
          alert("Please upload a valid PPT or PDF file.")
        }
        break
      case "audio":
        if (
          file.type.startsWith("audio/") ||
          [".mp3", ".wav", ".m4a"].some((ext) => file.name.endsWith(ext))
        ) {
          setNewLecture((prev) => ({ ...prev, audioFile: file }))
        } else {
          alert("Please upload a valid audio file.")
        }
        break
      case "video":
        if (
          file.type.startsWith("video/") ||
          [".mp4", ".mov", ".avi", ".mkv"].some((ext) => file.name.endsWith(ext))
        ) {
          setNewLecture((prev) => ({ ...prev, videoFile: file }))
        } else {
          alert("Please upload a valid video file.")
        }
        break
    }
  }

  // ✅ Helpers
  const getStatusColor = (completion: number) => {
    if (completion === 100) return "bg-green-500"
    if (completion >= 50) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getStatusText = (completion: number) => {
    if (completion === 100) return "Completed"
    if (completion >= 50) return "In Progress"
    return "Not Started"
  }

  const hasMediaFile = (lecture: any) => {
    return lecture.audioUrl || lecture.videoUrl || lecture.youtubeUrl
  }

  // ✅ UI
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Lectures</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and track your uploaded lectures
          </p>
        </div>

        {/* Upload Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Lecture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Lecture</DialogTitle>
              <DialogDescription>
                Upload lecture via YouTube, video, audio, or presentation
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Lecture Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter lecture title"
                  value={newLecture.title}
                  onChange={(e) =>
                    setNewLecture((prev) => ({ ...prev, title: e.target.value }))
                  }
                />
              </div>

              {/* YouTube URL */}
              <div className="space-y-2">
                <Label htmlFor="url">YouTube URL (Optional)</Label>
                <Input
                  id="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={newLecture.url}
                  onChange={(e) =>
                    setNewLecture((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>

              {/* File Inputs */}
              <div className="space-y-2">
                <Label htmlFor="video">Video File (Optional)</Label>
                <Input id="video" type="file" accept="video/*" onChange={(e) => handleFileUpload(e, "video")} />
                {newLecture.videoFile && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Video className="h-3 w-3 mr-1" /> {newLecture.videoFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="audio">Audio File (Optional)</Label>
                <Input id="audio" type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, "audio")} />
                {newLecture.audioFile && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <AudioLines className="h-3 w-3 mr-1" /> {newLecture.audioFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ppt">Presentation File (Optional)</Label>
                <Input id="ppt" type="file" accept=".pdf,.ppt,.pptx" onChange={(e) => handleFileUpload(e, "ppt")} />
                {newLecture.pptFile && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Presentation className="h-3 w-3 mr-1" /> {newLecture.pptFile.name}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLecture}
                  disabled={isUploading || !newLecture.title}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isUploading ? "Uploading..." : "Add Lecture"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Lectures</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{lectures.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{lectures.filter(l => l.status === "completed").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Processing</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{lectures.filter(l => l.status === "processing").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">With Media</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{lectures.filter(hasMediaFile).length}</div></CardContent></Card>
      </div>

      {/* Lecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...lectures].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((lecture, index) => (
          <Card key={lecture._id || index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg line-clamp-2">{lecture.title}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-2">
                    <Calendar className="h-3 w-3" />
                    {new Date(lecture.createdAt).toLocaleDateString()}
                    {lecture.pptUrl && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        <Presentation className="h-3 w-3 mr-1" />
                        Slides
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-2">
                  <div
                    className={`w-2 h-2 rounded-full mr-1 ${getStatusColor(
                      lecture.status === "completed" ? 100 : 60
                    )}`}
                  />
                  {getStatusText(lecture.status === "completed" ? 100 : 60)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>{lecture.status === "completed" ? "100%" : "Processing..."}</span>
                </div>
                <Progress
                  value={lecture.status === "completed" ? 100 : 60}
                  className="h-2"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => router.push(`/dashboard/lectures/${lecture._id}`)}>
                  <PlayCircle className="mr-1 h-3 w-3" /> {lecture.youtubeUrl ? "Watch" : "View"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/summaries?lecture=${lecture._id}`)}>
                  <FileText className="mr-1 h-3 w-3" /> Summary
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/quizzes?lecture=${lecture._id}`)}>
                  <Brain className="mr-1 h-3 w-3" /> Quiz
                </Button>
              </div>

              {/* YouTube Link */}
              {lecture.youtubeUrl && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => window.open(lecture.youtubeUrl, "_blank")}>
                  <ExternalLink className="mr-1 h-3 w-3" /> Open in YouTube
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {lectures.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <PlayCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <CardTitle className="text-xl mb-2">No lectures yet</CardTitle>
            <CardDescription className="mb-4">
              Start by adding your first lecture to begin learning
            </CardDescription>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Your First Lecture
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
