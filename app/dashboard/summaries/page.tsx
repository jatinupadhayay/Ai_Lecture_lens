"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { apiService } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Loader2, Brain, ArrowLeft, Sparkles, RefreshCw } from "lucide-react"

export default function SummariesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lectureId = searchParams.get("lecture")
  const { lectures } = useAppStore()

  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>("")

  const lecture = lectures.find((l: any) => l._id === lectureId || l.id === lectureId)

  const fetchSummary = async () => {
    if (!lectureId) return
    setError(null)
    try {
      const res = await apiService.getLectureSummary(lectureId)
      setSummary(res.summary || res.data?.summary || res.data || res)
      setStatus(res.status || res.data?.status || "")
    } catch {
      setError("Failed to load summary")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!lectureId) return
    fetchSummary()
    const interval = setInterval(() => {
      if (status === "processing" || status === "queued") fetchSummary()
    }, 6000)
    return () => clearInterval(interval)
  }, [lectureId, status])

  const regenerateSummary = async () => {
    if (!lectureId) return
    setGenerating(true)
    setError(null)
    setSummary(null)
    try {
      await apiService.processLecture(lectureId)
      setStatus("queued")
    } catch {
      setError("Failed to start summary regeneration")
    } finally {
      setGenerating(false)
    }
  }

  if (!lectureId) {
    return (
      <div className="text-center py-20">
        <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground">Select a lecture to view its summary</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/dashboard/lectures")}>
          Browse Lectures
        </Button>
      </div>
    )
  }

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-80">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading summary...</p>
      </div>
    )

  if (!summary || (!summary.local && !summary.ai && !summary.merged)) {
    return (
      <div className="text-center py-20">
        <Brain className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium mb-1">
          {status === "processing" || status === "queued" ? "Generating summary..." : "No summary yet"}
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          {status === "processing" || status === "queued"
            ? "The AI models are processing your lecture"
            : "Start AI summarization for this lecture"}
        </p>
        {status === "processing" || status === "queued" ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        ) : (
          <Button onClick={regenerateSummary} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? "Starting..." : "Generate Summary"}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{lecture?.title || "Summary"}</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-generated summaries from lecture content</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/lectures")}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={regenerateSummary}
            disabled={generating || status === "processing" || status === "queued"}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
            {status === "processing" || status === "queued" ? "Processing..." : "Regenerate"}
          </Button>
        </div>
      </div>

      <Card>
        <Tabs defaultValue="combined" className="w-full">
          <CardHeader className="pb-0">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="combined">Merged</TabsTrigger>
              <TabsTrigger value="local">Local Model</TabsTrigger>
              <TabsTrigger value="ai">OpenAI</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            {[
              { value: "combined", title: "Unified Summary", desc: "Blend of local + AI insights", content: summary.merged || summary.local || summary.ai },
              { value: "local", title: "Local Model", desc: "Generated by BART summarizer", content: summary.local, icon: FileText },
              { value: "ai", title: "OpenAI GPT", desc: "Generated by GPT-4o-mini", content: summary.ai, icon: Brain },
            ].map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold mb-1">{tab.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{tab.desc}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {tab.content || `${tab.title} not yet available.`}
                  </p>
                </div>
              </TabsContent>
            ))}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
