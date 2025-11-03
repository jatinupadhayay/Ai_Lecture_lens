"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { useAppStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  PlayCircle,
  FileText,
  Brain,
  ExternalLink,
  Clock,
  BookOpen,
  Presentation,
  Download,
  Loader2,
  AudioLines,
  Video as VideoIcon,
} from "lucide-react"

export default function LectureViewerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAppStore()

  const [lecture, setLecture] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch lecture from backend
  useEffect(() => {
    const fetchLecture = async () => {
      try {
        const data = await apiService.getLecture(id)
        setLecture(data)
      } catch (err) {
        console.error("Failed to fetch lecture:", err)
        setError("Failed to load lecture details")
      } finally {
        setLoading(false)
      }
    }
    fetchLecture()
  }, [id])

  // Helper: get YouTube video ID
  const getYouTubeId = (url: string) => {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  const videoId = lecture?.youtubeUrl ? getYouTubeId(lecture.youtubeUrl) : null

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-3 text-gray-600">Loading lecture...</p>
      </div>
    )

  if (error || !lecture)
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">{error || "Lecture not found"}</h1>
        <Button onClick={() => router.push("/dashboard/lectures")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Lectures
        </Button>
      </div>
    )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/lectures")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{lecture.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
            Uploaded on {new Date(lecture.createdAt).toLocaleDateString()}
            {lecture.pptUrl && (
              <Badge variant="secondary" className="text-xs">
                <Presentation className="h-3 w-3 mr-1" />
                Slides Available
              </Badge>
            )}
          </p>
        </div>
        <Badge variant="outline">
          <div
            className={`w-2 h-2 rounded-full mr-1 ${
              lecture.status === "completed"
                ? "bg-green-500"
                : lecture.status === "processing"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          />
          {lecture.status}
        </Badge>
      </div>

      {/* Video / Audio / PPT Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Media Player */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              {videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={lecture.title}
                  className="w-full h-[400px] rounded-t-lg"
                  allowFullScreen
                />
              ) : lecture.videoUrl ? (
                <video src={lecture.videoUrl} controls className="w-full rounded-t-lg" />
              ) : lecture.audioUrl ? (
                <div className="flex flex-col items-center py-10">
                  <AudioLines className="h-8 w-8 mb-2 text-gray-500" />
                  <audio controls className="w-4/5">
                    <source src={lecture.audioUrl} />
                  </audio>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-t-lg">
                  <p className="text-gray-500">No media available</p>
                </div>
              )}

              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-gray-600">
                    {lecture.status === "completed" ? "100%" : "Processing..."}
                  </span>
                </div>
                <Progress
                  value={lecture.status === "completed" ? 100 : 60}
                  className="h-2 bg-gray-200"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info + Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => router.push(`/dashboard/summaries?lecture=${lecture._id}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Summary
              </Button>
              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => router.push(`/dashboard/quizzes?lecture=${lecture._id}`)}
              >
                <Brain className="mr-2 h-4 w-4" />
                Take Quiz
              </Button>
              {lecture.pptUrl && (
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => window.open(lecture.pptUrl, "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Slides
                </Button>
              )}
              {lecture.youtubeUrl && (
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  onClick={() => window.open(lecture.youtubeUrl, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in YouTube
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Lecture Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Teacher:</span>
                <span>{lecture.teacher?.name || user?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className="capitalize">{lecture.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Uploaded:</span>
                <span>{new Date(lecture.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Transcript:</span>
                <span>{lecture.transcript?.length || 0} lines</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs for Transcript, Summary, Slides */}
      <Card>
        <Tabs defaultValue="summary" className="w-full">
          <CardHeader>
            <TabsList className={`grid w-full ${lecture.pptUrl ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="summary">
                <BookOpen className="mr-2 h-4 w-4" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="transcript">
                <FileText className="mr-2 h-4 w-4" />
                Transcript
              </TabsTrigger>
              {lecture.pptUrl && (
                <TabsTrigger value="slides">
                  <Presentation className="mr-2 h-4 w-4" />
                  Slides
                </TabsTrigger>
              )}
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* Summary */}
            <TabsContent value="summary">
              {lecture.summary ? (
                <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
                  <p>{lecture.summary.localSummary || lecture.summary.aiSummary}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Summary not generated yet.</p>
              )}
            </TabsContent>

            {/* Transcript */}
            <TabsContent value="transcript" className="space-y-3">
              {lecture.transcript?.length ? (
                lecture.transcript.map((line: any, i: number) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {Math.floor(line.start)}s
                    </Badge>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{line.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Transcript not available.</p>
              )}
            </TabsContent>

            {/* Slides */}
            {lecture.pptUrl && (
              <TabsContent value="slides" className="text-center py-8">
                <Presentation className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Download or view the uploaded slides.
                </p>
                <div className="flex justify-center gap-2">
                  <Button onClick={() => window.open(lecture.pptUrl, "_blank")}>
                    <Download className="mr-2 h-4 w-4" /> Download Slides
                  </Button>
                  <Button variant="outline" onClick={() => window.open(lecture.pptUrl, "_blank")}>
                    <ExternalLink className="mr-2 h-4 w-4" /> View Online
                  </Button>
                </div>
              </TabsContent>
            )}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
