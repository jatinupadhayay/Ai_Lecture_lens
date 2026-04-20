"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type { Document as DocType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Upload, FileText, FileType, Trash2, MessageSquare,
  BookOpen, Loader2, CheckCircle2, AlertCircle, Clock,
  BookMarked, GraduationCap, Library,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function StatusBadge({ status }: { status: DocType["status"] }) {
  const map = {
    uploading:  { label: "Uploading",  icon: Loader2,      cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    processing: { label: "Indexing…",  icon: Loader2,      cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    ready:      { label: "Ready",      icon: CheckCircle2, cls: "text-green-400 bg-green-400/10 border-green-400/20" },
    failed:     { label: "Failed",     icon: AlertCircle,  cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  }
  const { label, icon: Icon, cls } = map[status] ?? map.failed
  const spin = status === "uploading" || status === "processing"
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border", cls)}>
      <Icon className={cn("h-3 w-3 shrink-0", spin && "animate-spin")} />
      {label}
    </span>
  )
}

function FileIcon({ type }: { type: string }) {
  if (type === "pdf") return <FileText className="h-5 w-5 text-red-400" />
  if (type === "docx" || type === "doc") return <FileType className="h-5 w-5 text-blue-400" />
  return <FileText className="h-5 w-5 text-muted-foreground" />
}

// ─────────────────────────────────────────────────────────────────
// Upload zone (standalone books only)
// ─────────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }: { onUploaded: (doc: DocType) => void }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadPct, setUploadPct] = useState(0)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function pickFile(f: File) {
    setFile(f)
    setTitle(f.name.replace(/\.[^/.]+$/, ""))
    setError("")
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError("")
    try {
      const { document: doc } = await apiService.uploadDocument(file, title || file.name, setUploadPct)
      onUploaded(doc)
      setFile(null)
      setTitle("")
      setUploadPct(0)
    } catch (err: any) {
      setError(err?.response?.data?.message || "Upload failed. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Library className="h-4 w-4 text-[#EAB308]" />
        <h2 className="text-sm font-semibold text-foreground">Upload a Book</h2>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer select-none",
          dragging ? "border-[#EAB308]/60 bg-[#EAB308]/5"
          : file ? "border-[#EAB308]/40 bg-[#EAB308]/4"
          : "border-border hover:border-border/80 hover:bg-accent/30"
        )}
      >
        <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />

        {file ? (
          <>
            <div className="h-9 w-9 rounded-xl bg-[#EAB308]/12 flex items-center justify-center">
              <FileIcon type={file.name.split(".").pop() || ""} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(file.size)}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setFile(null); setTitle("") }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline">
              Remove
            </button>
          </>
        ) : (
          <>
            <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm text-foreground font-medium">Drop or click to browse</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, DOCX, TXT — up to 50 MB</p>
            </div>
          </>
        )}
      </div>

      {file && (
        <div className="space-y-3">
          <Input placeholder="Book title (optional)" value={title}
            onChange={(e) => setTitle(e.target.value)} className="bg-background" />

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Uploading…</span><span>{uploadPct}%</span>
              </div>
              <Progress value={uploadPct} className="h-1.5" />
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
            </p>
          )}

          <Button onClick={handleUpload} disabled={uploading}
            className="w-full bg-[#EAB308] hover:bg-[#EAB308]/90 text-black font-semibold">
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : "Upload & Index"}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Document card (shared)
// ─────────────────────────────────────────────────────────────────

function DocCard({ doc, onDelete }: { doc: DocType; onDelete: (id: string) => void }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${doc.title}"?`)) return
    setDeleting(true)
    try {
      await apiService.deleteDocument(doc._id)
      onDelete(doc._id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      onClick={() => doc.status === "ready" && router.push(`/dashboard/library/${doc._id}`)}
      className={cn(
        "group relative rounded-xl border border-border bg-card p-4 transition-all duration-200",
        doc.status === "ready"
          ? "cursor-pointer hover:border-[#EAB308]/30 hover:shadow-[0_0_0_1px_rgba(234,179,8,0.10)] hover:-translate-y-0.5"
          : "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <FileIcon type={doc.fileType} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-foreground truncate">{doc.title}</h3>
            <StatusBadge status={doc.status} />
          </div>

          <div className="flex items-center gap-2.5 mt-1">
            <span className="text-[11px] text-muted-foreground uppercase">{doc.fileType}</span>
            <span className="text-[11px] text-muted-foreground">{formatBytes(doc.fileSize)}</span>
            {doc.status === "ready" && (
              <span className="text-[11px] text-muted-foreground">{doc.chunkCount} chunks</span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
            </span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {doc.status === "ready" && (
                <Button size="sm" variant="ghost"
                  onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/library/${doc._id}`) }}
                  className="h-7 px-2 text-[11px] text-[#EAB308] hover:bg-[#EAB308]/10">
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />Ask AI
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}
                className="h-7 px-2 text-red-400 hover:bg-red-400/10">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Lecture books section — grouped by lecture
// ─────────────────────────────────────────────────────────────────

function LectureBookSection({ docs, onDelete }: { docs: DocType[]; onDelete: (id: string) => void }) {
  // Group by lectureId
  const grouped = docs.reduce<Record<string, { lectureTitle: string; docs: DocType[] }>>((acc, doc) => {
    const key = doc.lectureId || "unknown"
    if (!acc[key]) acc[key] = { lectureTitle: doc.lectureTitle || "Unknown Lecture", docs: [] }
    acc[key].docs.push(doc)
    return acc
  }, {})

  if (Object.keys(grouped).length === 0) {
    return (
      <div className="flex items-center gap-3 py-8 text-center justify-center">
        <div className="text-center">
          <p className="text-[13px] text-muted-foreground">No lecture books yet.</p>
          <p className="text-[12px] text-muted-foreground/60 mt-0.5">
            Attach a PDF when uploading a lecture to see it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([lectureId, group]) => (
        <div key={lectureId} className="space-y-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px] font-semibold text-muted-foreground truncate">{group.lectureTitle}</span>
            <span className="text-[11px] text-muted-foreground/50">({group.docs.length})</span>
          </div>
          <div className="space-y-2 pl-5 border-l border-border">
            {group.docs.map((doc) => (
              <DocCard key={doc._id} doc={doc} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const [docs, setDocs] = useState<DocType[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"standalone" | "lecture">("standalone")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDocs = useCallback(async () => {
    try {
      const { documents } = await apiService.listDocuments()
      setDocs(documents)
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocs()
    pollRef.current = setInterval(() => {
      setDocs((prev) => {
        const hasProcessing = prev.some((d) => d.status === "processing" || d.status === "uploading")
        if (hasProcessing) loadDocs()
        return prev
      })
    }, 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [loadDocs])

  function onUploaded(doc: DocType) {
    setDocs((prev) => [doc, ...prev])
  }

  function onDelete(id: string) {
    setDocs((prev) => prev.filter((d) => d._id !== id))
  }

  const standaloneDocs = docs.filter((d) => !d.lectureId)
  const lectureDocs = docs.filter((d) => !!d.lectureId)

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Document Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload books or notes — ask AI questions about them.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
        {([
          { key: "standalone", label: "My Books", icon: Library, count: standaloneDocs.length },
          { key: "lecture",    label: "Lecture Books", icon: BookMarked, count: lectureDocs.length },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all",
              tab === t.key
                ? "bg-[#EAB308]/15 text-[#EAB308]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            <span className={cn(
              "text-[11px] px-1.5 py-0.5 rounded-full",
              tab === t.key ? "bg-[#EAB308]/20 text-[#EAB308]" : "bg-accent text-muted-foreground"
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading library…
        </div>
      ) : tab === "standalone" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          <UploadZone onUploaded={onUploaded} />

          <div className="space-y-3">
            {standaloneDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-12 w-12 rounded-2xl bg-accent flex items-center justify-center mb-3">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No books uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Upload any PDF, book, or notes to start asking AI questions.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {standaloneDocs.length} book{standaloneDocs.length !== 1 ? "s" : ""} · {standaloneDocs.filter(d => d.status === "ready").length} ready
                </p>
                {standaloneDocs.map((doc) => (
                  <DocCard key={doc._id} doc={doc} onDelete={onDelete} />
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Books attached to lectures when uploading. Grouped by lecture.
          </p>
          <LectureBookSection docs={lectureDocs} onDelete={onDelete} />
        </div>
      )}
    </div>
  )
}
