"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import type { Document as DocType, ChatMessage } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft, Send, Loader2, Trash2, FileText,
  BookOpen, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────
// Source panel (collapsible)
// ─────────────────────────────────────────────────────────────────

function SourcesPanel({ sources }: { sources: { text: string; score: number }[] }) {
  const [open, setOpen] = useState(false)
  if (!sources.length) return null
  return (
    <div className="mt-2 rounded-xl border border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground hover:bg-accent/30 transition-colors"
      >
        <span className="font-medium">{sources.length} source excerpt{sources.length !== 1 ? "s" : ""} used</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="divide-y divide-border/40">
          {sources.map((s, i) => (
            <div key={i} className="px-3 py-2.5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Excerpt {i + 1}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {Math.round(s.score * 100)}% match
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Chat bubble
// ─────────────────────────────────────────────────────────────────

function ChatBubble({
  msg,
  sources,
}: {
  msg: ChatMessage
  sources?: { text: string; score: number }[]
}) {
  const isUser = msg.role === "user"
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5",
        isUser
          ? "bg-[#EAB308]/20 text-[#EAB308]"
          : "bg-accent text-muted-foreground"
      )}>
        {isUser ? "U" : <Sparkles className="h-3.5 w-3.5" />}
      </div>

      <div className={cn("flex-1 max-w-[82%] space-y-1", isUser && "items-end flex flex-col")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-[#EAB308]/12 text-foreground rounded-tr-sm"
            : "bg-card border border-border text-foreground rounded-tl-sm"
        )}>
          {/* Render newlines */}
          {msg.content.split("\n").map((line, i) => (
            <span key={i}>{line}{i < msg.content.split("\n").length - 1 && <br />}</span>
          ))}
        </div>

        {/* Sources — only on assistant messages */}
        {!isUser && sources && sources.length > 0 && (
          <div className="w-full">
            <SourcesPanel sources={sources} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Suggested questions
// ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Summarize the main ideas of this document",
  "What are the key concepts explained here?",
  "Create 5 study questions from this material",
  "Explain the most important points simply",
]

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────

export default function DocumentChatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [doc, setDoc] = useState<DocType | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // Map from assistant message index → sources
  const [sourcesMap, setSourcesMap] = useState<Record<number, { text: string; score: number }[]>>({})
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadDoc = useCallback(async () => {
    try {
      const { document } = await apiService.getDocument(id)
      setDoc(document)
      setMessages(document.chatHistory || [])
    } catch {
      router.push("/dashboard/library")
    } finally {
      setLoadingDoc(false)
    }
  }, [id, router])

  useEffect(() => { loadDoc() }, [loadDoc])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || sending) return

    setInput("")
    setSending(true)

    // Optimistic user message
    const userMsg: ChatMessage = { role: "user", content: msg }
    setMessages((prev) => [...prev, userMsg])

    try {
      const { answer, sources } = await apiService.chatWithDocument(id, msg)
      const assistantMsg: ChatMessage = { role: "assistant", content: answer }
      setMessages((prev) => {
        const updated = [...prev, assistantMsg]
        // Store sources keyed by the assistant message's index
        setSourcesMap((sm) => ({ ...sm, [updated.length - 1]: sources }))
        return updated
      })
    } catch (err: any) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: err?.response?.data?.message || "Something went wrong. Please try again.",
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function clearChat() {
    if (!confirm("Clear all chat history for this document?")) return
    setClearing(true)
    try {
      await apiService.clearDocumentChat(id)
      setMessages([])
      setSourcesMap({})
    } finally {
      setClearing(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (loadingDoc) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading document…
      </div>
    )
  }

  if (!doc) return null

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/library")}
            className="h-8 w-8 p-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">{doc.title}</h1>
            <p className="text-[11px] text-muted-foreground">
              {doc.chunkCount} indexed chunks · {doc.totalWords.toLocaleString()} words
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            disabled={clearing}
            className="h-8 shrink-0 text-muted-foreground hover:text-red-400 text-[12px]"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
            Clear chat
          </Button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center pb-8">
            <div className="h-14 w-14 rounded-2xl bg-[#EAB308]/12 flex items-center justify-center mb-4">
              <BookOpen className="h-7 w-7 text-[#EAB308]" />
            </div>
            <p className="text-sm font-semibold text-foreground">Ask anything about this document</p>
            <p className="text-xs text-muted-foreground mt-1 mb-6 max-w-xs">
              AI will search the document and answer based on what it finds.
            </p>
            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-border bg-card hover:border-[#EAB308]/40 hover:bg-[#EAB308]/5 text-muted-foreground hover:text-foreground transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                msg={msg}
                sources={msg.role === "assistant" ? sourcesMap[i] : undefined}
              />
            ))}

            {sending && (
              <div className="flex gap-3">
                <div className="h-7 w-7 rounded-full shrink-0 bg-accent flex items-center justify-center mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 shrink-0">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-4 py-3 focus-within:border-[#EAB308]/40 transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about this document…"
            disabled={sending}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32 overflow-y-auto leading-relaxed"
            style={{ minHeight: "24px" }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = "auto"
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`
            }}
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            size="sm"
            className="h-8 w-8 p-0 shrink-0 bg-[#EAB308] hover:bg-[#EAB308]/90 disabled:opacity-40"
          >
            {sending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
              : <Send className="h-3.5 w-3.5 text-black" />
            }
          </Button>
        </div>
        <p className="text-[10.5px] text-muted-foreground/50 text-center mt-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  )
}
