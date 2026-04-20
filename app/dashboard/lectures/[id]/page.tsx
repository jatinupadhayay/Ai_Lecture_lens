"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { useAppStore } from "@/lib/store"
import type { Document as DocType, Lecture } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  AudioLines,
  BookMarked,
  Brain,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Presentation,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

export default function LectureViewerPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAppStore()

  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reprocessing, setReprocessing] = useState(false)

  // Books
  const [books, setBooks] = useState<DocType[]>([])
  const [uploadingBooks, setUploadingBooks] = useState(false)
  const [bookError, setBookError] = useState("")
  const bookInputRef = useRef<HTMLInputElement>(null)
  const bookPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLecture = async () => {
    try {
      const data = await apiService.getLecture(id)
      setLecture(data)
      setError(null)
    } catch {
      setError("Failed to load lecture details.")
    } finally {
      setLoading(false)
    }
  }

  const fetchBooks = async () => {
    try {
      const { documents } = await apiService.getLectureBooks(id)
      setBooks(documents)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchLecture()
    fetchBooks()
  }, [id])

  // Poll books while any are still processing
  useEffect(() => {
    bookPollRef.current = setInterval(() => {
      setBooks((prev) => {
        if (prev.some((b) => b.status === "processing")) fetchBooks()
        return prev
      })
    }, 4000)
    return () => { if (bookPollRef.current) clearInterval(bookPollRef.current) }
  }, [])

  async function handleBookUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ""
    setUploadingBooks(true)
    setBookError("")
    try {
      const { books: newBooks } = await apiService.uploadBookToLecture(id, files)
      setBooks((prev) => [...newBooks, ...prev])
    } catch (err: any) {
      setBookError(err?.response?.data?.message || "Upload failed.")
    } finally {
      setUploadingBooks(false)
    }
  }

  async function handleDeleteBook(bookId: string) {
    if (!confirm("Delete this book?")) return
    try {
      await apiService.deleteDocument(bookId)
      setBooks((prev) => prev.filter((b) => b._id !== bookId))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!lecture || (lecture.status !== "processing" && lecture.status !== "queued")) return

    const interval = setInterval(() => {
      fetchLecture()
    }, 10000)

    return () => clearInterval(interval)
  }, [lecture])

  const handleReprocess = async () => {
    setReprocessing(true)
    try {
      const response = await apiService.processLecture(id)
      setLecture(response.lecture)
      setError(null)
    } catch {
      setError("Failed to restart lecture processing.")
    } finally {
      setReprocessing(false)
    }
  }

  const getYouTubeId = (url?: string | null) => {
    const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)
    return match ? match[1] : null
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading lecture...</p>
      </div>
    )
  }

  if (error || !lecture) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-semibold mb-3">{error || "Lecture not found"}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/lectures")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lectures
        </Button>
      </div>
    )
  }

  const lectureId = lecture._id || lecture.id
  const videoId = getYouTubeId(lecture.youtubeUrl)
  const isProcessing = lecture.status === "processing" || lecture.status === "queued"

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/dashboard/lectures")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">{lecture.title}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{new Date(lecture.createdAt || "").toLocaleDateString()}</span>
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

      {lecture.status === "failed" && lecture.errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-red-700">Processing failed</p>
            <p className="text-sm text-red-600 mt-1">{lecture.errorMessage}</p>
          </CardContent>
        </Card>
      )}

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
                  <audio controls className="w-4/5">
                    <source src={lecture.audioUrl} />
                  </audio>
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
              <Button
                className="w-full justify-start"
                size="sm"
                onClick={() => router.push(`/dashboard/summaries?lecture=${lectureId}`)}
              >
                <FileText className="mr-2 h-4 w-4" /> View Summary
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => router.push(`/dashboard/quizzes?lecture=${lectureId}`)}
              >
                <Brain className="mr-2 h-4 w-4" /> Take Quiz
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={handleReprocess}
                disabled={reprocessing || isProcessing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
                {isProcessing ? "Processing..." : "Retry Processing"}
              </Button>
              {lecture.pptUrl && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => window.open(lecture.pptUrl || "", "_blank")}
                >
                  <Download className="mr-2 h-4 w-4" /> Download Slides
                </Button>
              )}
              {lecture.youtubeUrl && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => window.open(lecture.youtubeUrl || "", "_blank")}
                >
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
                { label: "Teacher", value: typeof lecture.teacher === "string" ? lecture.teacher : lecture.teacher?.name || user?.name || "N/A" },
                { label: "Status", value: lecture.status },
                { label: "Uploaded", value: new Date(lecture.createdAt || "").toLocaleDateString() },
                { label: "Transcript", value: `${lecture.transcript?.length || 0} lines` },
              ].map((item) => (
                <div key={item.label} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium capitalize text-right">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <Tabs defaultValue="summary" className="w-full">
          <CardHeader className="pb-0">
            <TabsList className={`grid w-full ${lecture.pptUrl ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="summary">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Summary
              </TabsTrigger>
              <TabsTrigger value="transcript">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Transcript
              </TabsTrigger>
              <TabsTrigger value="books">
                <BookMarked className="mr-1.5 h-3.5 w-3.5" /> Books
                {books.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-[#EAB308]/20 text-[#EAB308] px-1.5 py-0.5 rounded-full">
                    {books.length}
                  </span>
                )}
              </TabsTrigger>
              {lecture.pptUrl && (
                <TabsTrigger value="slides">
                  <Presentation className="mr-1.5 h-3.5 w-3.5" /> Slides
                </TabsTrigger>
              )}
            </TabsList>
          </CardHeader>

          <CardContent className="pt-4">
            <TabsContent value="summary">
              {lecture.summary?.merged || lecture.summary?.local || lecture.summary?.ai ? (
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {lecture.summary?.merged || lecture.summary?.local || lecture.summary?.ai}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isProcessing
                    ? "Summary generation is in progress."
                    : lecture.status === "failed"
                      ? lecture.errorMessage || "Summary generation failed."
                      : "Summary not generated yet."}
                </p>
              )}
            </TabsContent>

            <TabsContent value="transcript" className="space-y-2">
              {lecture.transcript?.length ? (
                lecture.transcript.map((line, index) => (
                  <div key={index} className="flex gap-3 p-2.5 rounded-lg bg-muted/40">
                    <Badge variant="outline" className="text-[10px] shrink-0 h-5">
                      {Math.floor(line.start || 0)}s
                    </Badge>
                    <p className="text-sm">{line.text}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isProcessing ? "Transcript generation is in progress." : "Transcript not available."}
                </p>
              )}
            </TabsContent>

            {/* ── Books tab ── */}
            <TabsContent value="books" className="space-y-4">
              {/* Upload button */}
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-muted-foreground">
                  {books.length === 0
                    ? "No reference books attached yet."
                    : `${books.length} book${books.length !== 1 ? "s" : ""} attached`}
                </p>
                <div>
                  <input
                    ref={bookInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    multiple
                    className="hidden"
                    onChange={handleBookUpload}
                  />
                  <Button
                    size="sm"
                    onClick={() => bookInputRef.current?.click()}
                    disabled={uploadingBooks}
                    className="h-8 text-[12px] bg-[#EAB308] hover:bg-[#EAB308]/90 text-black font-semibold"
                  >
                    {uploadingBooks
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                      : <><Plus className="h-3.5 w-3.5 mr-1.5" />Add Books</>}
                  </Button>
                </div>
              </div>

              {bookError && (
                <p className="text-[12px] text-red-400">{bookError}</p>
              )}

              {/* Book list */}
              {books.length === 0 ? (
                <div
                  onClick={() => bookInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-border cursor-pointer hover:border-[#EAB308]/40 hover:bg-[#EAB308]/3 transition-all"
                >
                  <Upload className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Drop books here or click to browse</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">PDF, DOCX, TXT — up to 5 files</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {books.map((book) => {
                    const isReady = book.status === "ready"
                    const isProcessing = book.status === "processing"
                    return (
                      <div key={book._id} className={cn(
                        "group flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50 transition-all",
                        isReady && "hover:border-[#EAB308]/30 cursor-pointer"
                      )}
                        onClick={() => isReady && router.push(`/dashboard/library/${book._id}`)}
                      >
                        <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <BookMarked className="h-4 w-4 text-[#EAB308]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate">{book.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground uppercase">{book.fileType}</span>
                            {isReady && <span className="text-[11px] text-green-400 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" />Ready</span>}
                            {isProcessing && <span className="text-[11px] text-yellow-400 flex items-center gap-0.5"><Loader2 className="h-3 w-3 animate-spin" />Indexing…</span>}
                            {book.status === "failed" && <span className="text-[11px] text-red-400">Failed</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isReady && (
                            <Button size="sm" variant="ghost"
                              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/library/${book._id}`) }}
                              className="h-7 px-2 text-[11px] text-[#EAB308] hover:bg-[#EAB308]/10">
                              <MessageSquare className="h-3.5 w-3.5 mr-1" />Ask AI
                            </Button>
                          )}
                          <Button size="sm" variant="ghost"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBook(book._id) }}
                            className="h-7 px-2 text-red-400 hover:bg-red-400/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {lecture.pptUrl && (
              <TabsContent value="slides" className="text-center py-10">
                <Presentation className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Download or view the uploaded slides.
                </p>
                <Button size="sm" onClick={() => window.open(lecture.pptUrl || "", "_blank")}>
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
