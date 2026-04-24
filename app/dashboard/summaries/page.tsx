"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LectureSummaryResponse } from "@/lib/types"
import {
  ArrowLeft,
  Brain,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react"

export default function SummariesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lectureId = searchParams.get("lecture")
  const { lectures } = useAppStore()

  const [summaryState, setSummaryState] = useState<LectureSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lecture = lectures.find((item) => (item._id || item.id) === lectureId)
  const status = summaryState?.status || ""

  const fetchSummary = async () => {
    if (!lectureId) return

    setError(null)

    try {
      const response = await apiService.getLectureSummary(lectureId)
      setSummaryState(response)
    } catch {
      setError("Failed to load summary.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!lectureId) return
    fetchSummary()
  }, [lectureId])

  useEffect(() => {
    if (!lectureId || (status !== "processing" && status !== "queued")) return

    const interval = setInterval(() => {
      fetchSummary()
    }, 10000)

    return () => clearInterval(interval)
  }, [lectureId, status])

  const regenerateSummary = async () => {
    if (!lectureId) return

    setGenerating(true)
    setError(null)

    try {
      const response = await apiService.processLecture(lectureId)
      setSummaryState((previous) => ({
        summary: previous?.summary || {},
        status: response.lecture.status,
        errorMessage: response.lecture.errorMessage || "",
      }))
    } catch {
      setError("Failed to start summary regeneration.")
    } finally {
      setGenerating(false)
    }
  }

  if (!lectureId) {
    return (
      <div className="text-center py-20">
        <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground">Select a lecture to view its summary.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.push("/dashboard/lectures")}
        >
          Browse Lectures
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Loading summary...</p>
      </div>
    )
  }

  const summary = summaryState?.summary
  const hasSummary = Boolean(summary?.local || summary?.ai || summary?.merged)
  const isProcessing = status === "processing" || status === "queued"
  const isFailed = status === "failed"

  if (!hasSummary) {
    return (
      <div className="text-center py-20">
        <Brain className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium mb-1">
          {isProcessing ? "Generating summary..." : isFailed ? "Summary generation failed" : "No summary yet"}
        </p>
        <p className="text-sm text-muted-foreground mb-5">
          {isProcessing
            ? "The AI pipeline is still processing this lecture."
            : isFailed
              ? summaryState?.errorMessage || "The lecture could not be processed."
              : "Start AI summarization for this lecture."}
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {isProcessing ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        ) : (
          <Button onClick={regenerateSummary} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
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
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated summaries from lecture content
          </p>
          {summaryState?.errorMessage && status === "failed" && (
            <p className="text-sm text-red-600 mt-2">{summaryState.errorMessage}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/lectures")}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={regenerateSummary}
            disabled={generating || isProcessing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
            {isProcessing ? "Processing..." : "Regenerate"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
              {
                value: "combined",
                title: "Unified Summary",
                desc: "Combined output from the local model and OpenAI",
                content: summary?.merged || summary?.local || summary?.ai,
              },
              {
                value: "local",
                title: "Local Model",
                desc: "Generated by the local summarizer",
                content: summary?.local,
              },
              {
                value: "ai",
                title: "OpenAI",
                desc: "Generated by GPT-4o-mini",
                content: summary?.ai,
              },
            ].map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <div className="rounded-lg border p-4">
                  <h3 className="text-sm font-semibold mb-1">{tab.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{tab.desc}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {tab.content || `${tab.title} is not available yet.`}
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
