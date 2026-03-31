"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  FileText,
  Brain,
  ExternalLink,
  Clock,
  BookOpen,
  Presentation,
  Download,
  Loader2,
  AudioLines,
} from "lucide-react"

export default function LectureViewerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAppStore()

  const [lecture, setLecture] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLecture = async () => {
      try {
        const data = await apiService.getLecture(id)
        setLecture(data)
      } catch {
        setError("Failed to load lecture details")
      } finally {
        setLoading(false)
      }
    }
    fetchLecture()
  }, [id])

  const getYouTubeId = (url: string) => {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  const videoId = lecture?.youtubeUrl ? getYouTubeId(lecture.youtubeUrl) : null

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-80">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading lecture...</p>
      </div>
    )

  if (error || !lecture)
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold mb-3">{error || "Lecture not found"}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/lectures")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lectures
        </Button>
      </div>
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/dashboard/lectures")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{lecture.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{new Date(lecture.createdAt).toLocaleDateString()}</span>
            {lecture.pptUrl && (
              <Badge variant="outline" className="text-[10px] h-4">
                <Presentation className="h-2.5 w-2.5 mr-0.5" /> Slides
              </Badge>
            )}
          </div>
        </div>
        <Badge variant={lecture.status === "completed" ? "default" : "secondary"}>
          {lecture.status}
        </Badge>
      </div>

      {/* Media + Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={lecture.title}
                  className="w-full aspect-video rounded-t-lg"
                  allowFullScreen
                />
              ) : lecture.videoUrl ? (
                <video src={lecture.videoUrl} controls className="w-full rounded-t-lg" />
              ) : lecture.audioUrl ? (
                <div className="flex flex-col items-center py-12 bg-muted/30 rounded-t-lg">
                  <AudioLines className="h-8 w-8 mb-3 text-muted-foreground" />
                  <audio controls className="w-4/5"><source src={lecture.audioUrl} /></audio>
                </div>
              ) : (
                <div className="aspect-video bg-muted/30 flex items-center justify-center rounded-t-lg">
                  <p className="text-sm text-muted-foreground">No media available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" size="sm" onClick={() => router.push(`/dashboard/summaries?lecture=${lecture._id}`)}>
                <FileText className="mr-2 h-4 w-4" /> View Summary
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => router.push(`/dashboard/quizzes?lecture=${lecture._id}`)}>
                <Brain className="mr-2 h-4 w-4" /> Take Quiz
              </Button>
              {lecture.pptUrl && (
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => window.open(lecture.pptUrl, "_blank")}>
                  <Download className="mr-2 h-4 w-4" /> Download Slides
                </Button>
              )}
              {lecture.youtubeUrl && (
                <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => window.open(lecture.youtubeUrl, "_blank")}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in YouTube
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: "Teacher", value: lecture.teacher?.name || user?.name || "N/A" },
                { label: "Status", value: lecture.status },
                { label: "Uploaded", value: new Date(lecture.createdAt).toLocaleDateString() },
                { label: "Transcript", value: `${lecture.transcript?.length || 0} lines` },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium capitalize">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs defaultValue="summary" className="w-full">
          <CardHeader className="pb-0">
            <TabsList className={`grid w-full ${lecture.pptUrl ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="summary"><BookOpen className="mr-1.5 h-3.5 w-3.5" /> Summary</TabsTrigger>
              <TabsTrigger value="transcript"><FileText className="mr-1.5 h-3.5 w-3.5" /> Transcript</TabsTrigger>
              {lecture.pptUrl && <TabsTrigger value="slides"><Presentation className="mr-1.5 h-3.5 w-3.5" /> Slides</TabsTrigger>}
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="summary">
              {lecture.summary ? (
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {lecture.summary.merged || lecture.summary.local || lecture.summary.ai || "Summary not generated yet."}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Summary not generated yet.</p>
              )}
            </TabsContent>
            <TabsContent value="transcript" className="space-y-2">
              {lecture.transcript?.length ? (
                lecture.transcript.map((line: any, i: number) => (
                  <div key={i} className="flex gap-3 p-2.5 rounded-lg bg-muted/40">
                    <Badge variant="outline" className="text-[10px] shrink-0 h-5">{Math.floor(line.start)}s</Badge>
                    <p className="text-sm">{line.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Transcript not available.</p>
              )}
            </TabsContent>
            {lecture.pptUrl && (
              <TabsContent value="slides" className="text-center py-10">
                <Presentation className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">Download or view uploaded slides</p>
                <Button size="sm" onClick={() => window.open(lecture.pptUrl, "_blank")}>
                  <Download className="mr-2 h-4 w-4" /> Download Slides
                </Button>
              </TabsContent>
            )}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
