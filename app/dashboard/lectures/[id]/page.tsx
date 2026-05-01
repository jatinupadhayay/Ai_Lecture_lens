"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { useAppStore } from "@/lib/store"
import type { Document as DocType, Lecture, ChatMessage, Flashcard } from "@/lib/types"
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
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Presentation,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  User,
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

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  // Flashcards
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [flashcardsLoading, setFlashcardsLoading] = useState(false)
  const [flashcardsGenerating, setFlashcardsGenerating] = useState(false)
  const [currentCard, setCurrentCard] = useState(0)
  const [flipped, setFlipped] = useState(false)

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

  const fetchFlashcards = async () => {
    try {
      setFlashcardsLoading(true)
      const { flashcards: cards } = await apiService.getFlashcards(id)
      setFlashcards(cards)
    } catch { /* none yet */ } finally {
      setFlashcardsLoading(false)
    }
  }

  const handleGenerateFlashcards = async () => {
    setFlashcardsGenerating(true)
    setFlipped(false)
    setCurrentCard(0)
    try {
      const { flashcards: cards } = await apiService.generateFlashcards(id, 10)
      setFlashcards(cards)
    } catch { /* ignore */ } finally {
      setFlashcardsGenerating(false)
    }
  }

  const exportCSV = () => {
    const rows = [["Front", "Back", "Category"], ...flashcards.map((c) => [c.front, c.back, c.category])]
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "flashcards.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetchLecture()
    fetchBooks()
    fetchFlashcards()
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

  const sendChatMessage = useCallback(async () => {
    const msg = chatInput.trim()
    if (!msg || chatSending) return
    setChatInput("")
    setChatMessages((prev) => [...prev, { role: "user", content: msg }])
    setChatSending(true)
    try {
      const { answer, sources } = await apiService.chatWithLecture(id, msg)
      setChatMessages((prev) => [...prev, { role: "assistant", content: answer }])
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }])
    } finally {
      setChatSending(false)
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    }
  }, [chatInput, chatSending, id])

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
            <TabsList className={`grid w-full ${lecture.pptUrl ? "grid-cols-6" : "grid-cols-5"}`}>
              <TabsTrigger value="summary">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Summary
              </TabsTrigger>
              <TabsTrigger value="transcript">
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Transcript
              </TabsTrigger>
              <TabsTrigger value="flashcards">
                <Layers className="mr-1.5 h-3.5 w-3.5" /> Flashcards
                {flashcards.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-[#EAB308]/20 text-[#EAB308] px-1.5 py-0.5 rounded-full">
                    {flashcards.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="books">
                <BookMarked className="mr-1.5 h-3.5 w-3.5" /> Books
                {books.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-[#EAB308]/20 text-[#EAB308] px-1.5 py-0.5 rounded-full">
                    {books.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="chat">
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Ask AI
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

            {/* ── Flashcards tab ── */}
            <TabsContent value="flashcards">
              {flashcardsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : flashcards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-[#EAB308]/10 flex items-center justify-center">
                    <Layers className="h-7 w-7 text-[#EAB308]" />
                  </div>
                  <div>
                    <p className="font-medium mb-1">No flashcards yet</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Generate AI flashcards from this lecture to start studying.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateFlashcards}
                    disabled={flashcardsGenerating || lecture.status !== "completed"}
                    className="bg-[#EAB308] hover:bg-[#EAB308]/90 text-black font-semibold"
                  >
                    {flashcardsGenerating
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating…</>
                      : <><Sparkles className="mr-2 h-4 w-4" />Generate Flashcards</>}
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Controls */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Card <span className="font-semibold text-foreground">{currentCard + 1}</span> of {flashcards.length}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 text-xs">
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={handleGenerateFlashcards}
                        disabled={flashcardsGenerating}
                        className="h-8 text-xs"
                      >
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${flashcardsGenerating ? "animate-spin" : ""}`} />
                        Regenerate
                      </Button>
                    </div>
                  </div>

                  {/* Flip card */}
                  <div
                    className="relative mx-auto cursor-pointer select-none"
                    style={{ height: 240, perspective: "1000px", maxWidth: 600 }}
                    onClick={() => setFlipped((f) => !f)}
                  >
                    <div
                      className="relative w-full h-full transition-transform duration-500"
                      style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                    >
                      {/* Front */}
                      <div
                        className="absolute inset-0 rounded-2xl border border-border bg-card flex flex-col items-center justify-center p-8 gap-3"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        {flashcards[currentCard]?.category && (
                          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#EAB308]/15 text-[#EAB308] font-medium uppercase tracking-wide">
                            {flashcards[currentCard].category}
                          </span>
                        )}
                        <p className="text-base font-semibold text-center leading-snug">
                          {flashcards[currentCard]?.front}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">Tap to reveal answer</p>
                      </div>
                      {/* Back */}
                      <div
                        className="absolute inset-0 rounded-2xl border border-[#EAB308]/30 bg-[#EAB308]/5 flex flex-col items-center justify-center p-8 gap-3"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        <p className="text-sm text-center leading-relaxed text-foreground/90">
                          {flashcards[currentCard]?.back}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">Tap to flip back</p>
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      variant="outline" size="sm"
                      disabled={currentCard === 0}
                      onClick={() => { setCurrentCard((c) => c - 1); setFlipped(false) }}
                      className="h-9 px-5"
                    >
                      ← Prev
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setFlipped(false)}
                      className="h-9 px-3 text-muted-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      disabled={currentCard === flashcards.length - 1}
                      onClick={() => { setCurrentCard((c) => c + 1); setFlipped(false) }}
                      className="h-9 px-5"
                    >
                      Next →
                    </Button>
                  </div>

                  {/* Card grid preview */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-2">
                    {flashcards.map((card, i) => (
                      <button
                        key={i}
                        onClick={() => { setCurrentCard(i); setFlipped(false) }}
                        className={cn(
                          "text-left p-3 rounded-xl border text-xs transition-all",
                          i === currentCard
                            ? "border-[#EAB308] bg-[#EAB308]/10 text-foreground"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-[#EAB308]/40"
                        )}
                      >
                        <p className="font-medium line-clamp-2">{card.front}</p>
                      </button>
                    ))}
                  </div>
                </div>
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

            {/* ── Chat tab ── */}
            <TabsContent value="chat" className="flex flex-col" style={{ height: 480 }}>
              {lecture.status !== "completed" && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">AI chat not available yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    {isProcessing
                      ? "This lecture is still being processed. Check back in a moment."
                      : "This lecture needs to be processed successfully before you can ask questions."}
                  </p>
                  {!isProcessing && lecture.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={handleReprocess} disabled={reprocessing}>
                      <RefreshCw className={`mr-2 h-3.5 w-3.5 ${reprocessing ? "animate-spin" : ""}`} />
                      Retry Processing
                    </Button>
                  )}
                </div>
              )}
              {lecture.status === "completed" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <div className="h-12 w-12 rounded-full bg-[#EAB308]/10 flex items-center justify-center">
                      <Bot className="h-6 w-6 text-[#EAB308]" />
                    </div>
                    <p className="text-sm font-medium">Ask anything about this lecture</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      I'll only answer based on what was said in the video — no outside knowledge.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {["What are the key concepts?", "Summarize the main points", "What examples were given?"].map((q) => (
                        <button
                          key={q}
                          onClick={() => { setChatInput(q) }}
                          className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-[#EAB308]/50 hover:bg-[#EAB308]/5 transition-all text-muted-foreground"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="h-7 w-7 rounded-full bg-[#EAB308]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-[#EAB308]" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#EAB308] text-black font-medium rounded-br-sm"
                          : "bg-muted/60 text-foreground rounded-bl-sm"
                      }`}>
                        {msg.content}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {chatSending && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-7 w-7 rounded-full bg-[#EAB308]/10 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-[#EAB308]" />
                    </div>
                    <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 items-end border border-border rounded-xl p-2 bg-muted/20 focus-within:border-[#EAB308]/50 transition-colors">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                  placeholder="Ask about this lecture..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 max-h-32"
                />
                <Button
                  size="icon"
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatSending}
                  className="h-8 w-8 shrink-0 bg-[#EAB308] hover:bg-[#EAB308]/90 text-black rounded-lg"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
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
