"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { apiService } from "@/lib/api"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  Loader2,
  Brain,
  ArrowLeft,
  Sparkles,
  RefreshCw,
} from "lucide-react"

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

  const lecture = lectures.find((l) => l._id === lectureId || l.id === lectureId)

  const fetchSummary = async () => {
    if (!lectureId) return
    setError(null)
    try {
      const res = await apiService.getLectureSummary(lectureId)
      setSummary(res.summary || res.data?.summary || res.data || res)
      setStatus(res.status || res.data?.status || "")
    } catch (err) {
      console.error("Failed to fetch summary:", err)
      setError("Failed to load summary")
    } finally {
      setLoading(false)
    }
  }

  // Poll summary every 6 seconds while processing
  useEffect(() => {
    if (!lectureId) return
    fetchSummary()
    const interval = setInterval(() => {
      if (status === "processing" || status === "queued") {
        fetchSummary()
      }
    }, 6000)
    return () => clearInterval(interval)
  }, [lectureId, status])

  const regenerateSummary = async () => {
    if (!lectureId) return
    setGenerating(true)
    setError(null)
    setSummary(null)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000/api"}/lectures/${lectureId}/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        }
      )
      if (!res.ok) throw new Error(`Backend returned ${res.status}`)
      setStatus("queued")
    } catch (err) {
      console.error("Regeneration failed:", err)
      setError("Failed to start summary regeneration")
    } finally {
      setGenerating(false)
    }
  }

  if (!lectureId) {
    return (
      <div className="text-center py-20">
        <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Select a lecture to view its summary</p>
      </div>
    )
  }

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-3 text-gray-600">Loading summary...</p>
      </div>
    )

  // 🧠 Empty or not yet processed
  if (!summary || (!summary.local && !summary.ai && !summary.merged)) {
    return (
      <div className="text-center py-20">
        <Brain className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 mb-2">
          {status === "processing" || status === "queued"
            ? "Summary generation in progress..."
            : "No summary available yet for this lecture."}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          {status === "processing" || status === "queued"
            ? "Please wait, the model is generating the summary..."
            : "Click below to start AI summarization."}
        </p>

        {status === "processing" || status === "queued" ? (
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
        ) : (
          <Button
            onClick={regenerateSummary}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Summary
              </>
            )}
          </Button>
        )}
      </div>
    )
  }

  // ✅ Main Content
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {lecture?.title || "Lecture Summary"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            AI-powered summaries generated from lecture content
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/lectures")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={regenerateSummary}
            disabled={generating || status === "processing" || status === "queued"}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`}
            />
            {status === "processing" || status === "queued"
              ? "Processing..."
              : "Regenerate"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs defaultValue="combined" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="combined">Merged</TabsTrigger>
              <TabsTrigger value="local">Local Model</TabsTrigger>
              <TabsTrigger value="ai">OpenAI Model</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* Combined Summary */}
            <TabsContent value="combined">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Unified Summary
                    {(status === "processing" || generating) && (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </CardTitle>
                  <CardDescription>
                    A blend of Local + AI-generated insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {summary.merged || summary.local || summary.ai || "Merged summary not yet available."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Local Summary */}
            <TabsContent value="local">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    Local Model Output
                  </CardTitle>
                  <CardDescription>
                    Generated using your local summarizer model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {summary.local || "Local summary not yet available."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI Summary */}
            <TabsContent value="ai">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4 text-blue-600" />
                    OpenAI GPT Summary
                  </CardTitle>
                  <CardDescription>
                    Generated using OpenAI GPT-4 Turbo API
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                    {summary.ai || "AI summary not yet available."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
