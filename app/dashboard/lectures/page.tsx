"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import type { Lecture } from "@/lib/types"
import { fmtDateShort, getLectureStatusStyle } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AudioLines,
  BookOpen,
  Brain,
  Calendar,
  ExternalLink,
  FileText,
  Loader2,
  PlayCircle,
  Plus,
  Presentation,
  Upload,
  Video,
  BookMarked,
} from "lucide-react"

export default function LecturesPage() {
  const router = useRouter()
  const { lectures, uploadLecture, fetchLectures } = useAppStore()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: "",
    url: "",
    pptFile: null as File | null,
    audioFile: null as File | null,
    videoFile: null as File | null,
    bookFiles: [] as File[],
  })

  useEffect(() => {
    fetchLectures()
  }, [fetchLectures])

  const handleUpload = async () => {
    if (!form.title.trim()) return

    if (!form.url && !form.videoFile && !form.audioFile && !form.pptFile) {
      toast.error("Provide a YouTube URL or upload at least one file.")
      return
    }

    setUploading(true)

    try {
      const result = await uploadLecture({
        title: form.title.trim(),
        youtubeUrl: form.url.trim(),
        pptFile: form.pptFile,
        audioFile: form.audioFile,
        videoFile: form.videoFile,
        bookFiles: form.bookFiles,
      })

      setForm({
        title: "",
        url: "",
        pptFile: null,
        audioFile: null,
        videoFile: null,
        bookFiles: [],
      })
      setOpen(false)

      if (result.processingFailed) {
        toast.error("Lecture was uploaded, but processing failed. Open it to review the error.")
      } else {
        toast.success(result.message)
      }
    } catch {
      toast.error("Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleFile = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "ppt" | "audio" | "video" | "book"
  ) => {
    const file = event.target.files?.[0]
    if (file) {
      setForm((previous) => ({ ...previous, [`${type}File`]: file }))
    }
  }

  const sortedLectures = useMemo(
    () =>
      [...(lectures as Lecture[])].sort(
        (a, b) =>
          new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()
      ),
    [lectures]
  )

  const counts = useMemo(() => {
    const total = lectures.length
    let completed = 0
    let processing = 0

    for (const lecture of lectures as Lecture[]) {
      if (lecture.status === "completed") completed += 1
      if (lecture.status === "processing" || lecture.status === "queued") processing += 1
    }

    return { total, completed, processing }
  }, [lectures])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-foreground">Lectures</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Upload and manage your lecture content
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-foreground text-background hover:bg-foreground/90 h-9 px-5 text-[13px] font-semibold rounded-lg shadow-warm">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Lecture
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[17px]">Upload a lecture</DialogTitle>
              <DialogDescription className="text-[13px]">
                Add a YouTube link or upload video, audio, or slides.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium">Title</Label>
                <Input
                  placeholder="e.g. Data Structures - Lecture 5"
                  value={form.title}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, title: event.target.value }))
                  }
                  className="h-10 text-[14px] bg-secondary border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium">
                  YouTube URL <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={form.url}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, url: event.target.value }))
                  }
                  className="h-10 text-[14px] bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                {[
                  {
                    id: "video",
                    label: "Video",
                    accept: "video/*",
                    icon: Video,
                    file: form.videoFile,
                  },
                  {
                    id: "audio",
                    label: "Audio",
                    accept: "audio/*",
                    icon: AudioLines,
                    file: form.audioFile,
                  },
                  {
                    id: "ppt",
                    label: "Slides",
                    accept: ".pdf,.ppt,.pptx",
                    icon: Presentation,
                    file: form.pptFile,
                  },
                ].map((input) => (
                  <div key={input.id} className="space-y-1">
                    <Label className="text-[12px] font-medium text-muted-foreground">
                      {input.label} <span className="font-normal">(optional)</span>
                    </Label>
                    <Input
                      type="file"
                      accept={input.accept}
                      onChange={(event) =>
                        handleFile(event, input.id as "ppt" | "audio" | "video")
                      }
                      className="text-[13px] h-9 bg-secondary border-border file:text-[12px] file:mr-2"
                    />
                    {input.file && (
                      <p className="text-[11px] text-primary flex items-center gap-1">
                        <input.icon className="h-3 w-3" /> {input.file.name}
                      </p>
                    )}
                  </div>
                ))}

                {/* Book / Reference PDFs — indexed into vector DB */}
                <div className="space-y-2 pt-1 border-t border-border">
                  <Label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <BookMarked className="h-3 w-3 text-[#EAB308]" />
                    Reference Books / PDFs
                    <span className="font-normal">(optional, up to 5)</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground/60">
                    Students can ask AI questions about these in the Library.
                  </p>
                  <Input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      setForm((prev) => ({
                        ...prev,
                        bookFiles: [...prev.bookFiles, ...files].slice(0, 5),
                      }))
                      e.target.value = ""
                    }}
                    className="text-[13px] h-9 bg-secondary border-border file:text-[12px] file:mr-2"
                  />
                  {form.bookFiles.length > 0 && (
                    <div className="space-y-1">
                      {form.bookFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] text-[#EAB308] bg-[#EAB308]/5 rounded-lg px-2.5 py-1.5">
                          <span className="flex items-center gap-1.5 truncate">
                            <BookMarked className="h-3 w-3 shrink-0" />{f.name}
                          </span>
                          <button
                            onClick={() => setForm((prev) => ({ ...prev, bookFiles: prev.bookFiles.filter((_, j) => j !== i) }))}
                            className="text-muted-foreground hover:text-red-400 shrink-0 ml-2"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  className="text-[13px] h-9"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-foreground text-background hover:bg-foreground/90 text-[13px] h-9"
                  onClick={handleUpload}
                  disabled={uploading || !form.title.trim()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-1.5 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: counts.total },
          { label: "Completed", value: counts.completed },
          { label: "Processing", value: counts.processing },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 rounded-2xl bg-card border border-border shadow-warm"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              {stat.label}
            </p>
            <p className="text-[28px] font-bold tracking-tight text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {sortedLectures.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedLectures.map((lecture) => {
            const lectureId = lecture._id || lecture.id

            return (
              <div
                key={lectureId}
                className="group bg-card border border-border rounded-2xl shadow-warm hover:shadow-warm-md hover:border-primary/30 transition-all duration-150 overflow-hidden cursor-pointer"
                onClick={() => router.push(`/dashboard/lectures/${lectureId}`)}
              >
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <BookOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${getLectureStatusStyle(
                        lecture.status
                      )}`}
                    >
                      {lecture.status}
                    </span>
                  </div>

                  <h3 className="text-[15px] font-semibold text-foreground line-clamp-2 leading-snug mb-2">
                    {lecture.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {fmtDateShort(lecture.createdAt || "")}
                    {lecture.pptUrl && (
                      <span className="ml-1 flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground/70">
                        <span aria-hidden="true">-</span>
                        <Presentation className="h-2.5 w-2.5" />
                        Slides
                      </span>
                    )}
                  </div>

                  {lecture.status === "failed" && lecture.errorMessage && (
                    <p className="mt-2 text-[11px] text-red-600 line-clamp-2">
                      {lecture.errorMessage}
                    </p>
                  )}
                </div>

                <div className="px-5 pb-4 flex gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-[12px] bg-foreground text-background hover:bg-foreground/90 rounded-lg"
                    onClick={(event) => {
                      event.stopPropagation()
                      router.push(`/dashboard/lectures/${lectureId}`)
                    }}
                  >
                    <PlayCircle className="mr-1 h-3.5 w-3.5" />
                    {lecture.youtubeUrl ? "Watch" : "View"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[12px] border-border rounded-lg"
                    onClick={(event) => {
                      event.stopPropagation()
                      router.push(`/dashboard/summaries?lecture=${lectureId}`)
                    }}
                  >
                    <FileText className="mr-1 h-3.5 w-3.5" />
                    Summary
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[12px] border-border rounded-lg"
                    onClick={(event) => {
                      event.stopPropagation()
                      router.push(`/dashboard/quizzes?lecture=${lectureId}`)
                    }}
                  >
                    <Brain className="mr-1 h-3.5 w-3.5" />
                    Quiz
                  </Button>
                </div>

                {lecture.youtubeUrl && (
                  <div className="px-5 pb-4">
                    <button
                      className="w-full text-[11px] text-muted-foreground hover:text-primary flex items-center justify-center gap-1 transition-colors"
                      onClick={(event) => {
                        event.stopPropagation()
                        window.open(lecture.youtubeUrl || "", "_blank")
                      }}
                    >
                      <ExternalLink className="h-3 w-3" /> Open in YouTube
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl bg-card border border-dashed border-border gap-4">
          <Upload className="h-14 w-14 text-muted-foreground/20" />
          <div className="text-center">
            <h3 className="text-[16px] font-semibold mb-1">No lectures yet</h3>
            <p className="text-[13px] text-muted-foreground">
              Upload your first lecture to get started
            </p>
          </div>
          <Button
            className="bg-foreground text-background hover:bg-foreground/90 h-9 px-6 text-[13px] rounded-lg mt-2"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Lecture
          </Button>
        </div>
      )}
    </div>
  )
}
