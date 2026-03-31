"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
  Loader2,
  Upload,
} from "lucide-react"

export default function LecturesPage() {
  const router = useRouter()
  const { lectures, uploadLecture, fetchLectures } = useAppStore()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const [newLecture, setNewLecture] = useState({
    title: "",
    url: "",
    pptFile: null as File | null,
    audioFile: null as File | null,
    videoFile: null as File | null,
  })

  useEffect(() => {
    fetchLectures()
  }, [fetchLectures])

  const handleAddLecture = async () => {
    if (!newLecture.title) return
    if (!newLecture.url && !newLecture.videoFile && !newLecture.audioFile && !newLecture.pptFile) {
      toast.error("Please provide a YouTube URL or upload at least one file.")
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
      toast.success("Lecture uploaded successfully")
    } catch {
      toast.error("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: "ppt" | "audio" | "video") => {
    const file = event.target.files?.[0]
    if (!file) return
    setNewLecture((prev) => ({ ...prev, [`${type}File`]: file }))
  }

  const getStatusVariant = (status: string) => {
    if (status === "completed") return "default" as const
    if (status === "processing" || status === "queued") return "secondary" as const
    return "outline" as const
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lectures</h1>
          <p className="text-muted-foreground text-sm mt-1">Upload and manage your lecture content</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Lecture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload a lecture</DialogTitle>
              <DialogDescription>
                Add a YouTube link or upload video, audio, or slides
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Data Structures - Lecture 5"
                  value={newLecture.title}
                  onChange={(e) => setNewLecture((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">YouTube URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={newLecture.url}
                  onChange={(e) => setNewLecture((prev) => ({ ...prev, url: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "video", label: "Video", accept: "video/*", icon: Video, file: newLecture.videoFile },
                  { id: "audio", label: "Audio", accept: "audio/*", icon: AudioLines, file: newLecture.audioFile },
                  { id: "ppt", label: "Slides", accept: ".pdf,.ppt,.pptx", icon: Presentation, file: newLecture.pptFile },
                ].map((input) => (
                  <div key={input.id} className="space-y-1.5">
                    <Label htmlFor={input.id} className="text-sm">
                      {input.label} <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id={input.id}
                      type="file"
                      accept={input.accept}
                      onChange={(e) => handleFileUpload(e, input.id as "ppt" | "audio" | "video")}
                      className="text-sm file:mr-3 file:text-sm"
                    />
                    {input.file && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <input.icon className="h-3 w-3" /> {input.file.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddLecture} disabled={isUploading || !newLecture.title}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: lectures.length },
          { label: "Completed", value: lectures.filter((l: any) => l.status === "completed").length },
          { label: "Processing", value: lectures.filter((l: any) => l.status === "processing" || l.status === "queued").length },
          { label: "With media", value: lectures.filter((l: any) => l.audioUrl || l.videoUrl || l.youtubeUrl).length },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-bold mt-0.5">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lecture grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...lectures]
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((lecture: any, index: number) => (
            <Card key={lecture._id || index} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base line-clamp-2 leading-snug">{lecture.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-2 text-xs">
                      <Calendar className="h-3 w-3" />
                      {new Date(lecture.createdAt).toLocaleDateString()}
                      {lecture.pptUrl && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                          <Presentation className="h-2.5 w-2.5 mr-0.5" />
                          Slides
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={getStatusVariant(lecture.status)} className="text-[10px] shrink-0">
                    {lecture.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => router.push(`/dashboard/lectures/${lecture._id}`)}
                  >
                    <PlayCircle className="mr-1 h-3 w-3" />
                    {lecture.youtubeUrl ? "Watch" : "View"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => router.push(`/dashboard/summaries?lecture=${lecture._id}`)}
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    Summary
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => router.push(`/dashboard/quizzes?lecture=${lecture._id}`)}
                  >
                    <Brain className="mr-1 h-3 w-3" />
                    Quiz
                  </Button>
                </div>

                {lecture.youtubeUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs text-muted-foreground"
                    onClick={() => window.open(lecture.youtubeUrl, "_blank")}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open in YouTube
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Empty state */}
      {lectures.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No lectures yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload your first lecture to get started</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lecture
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
