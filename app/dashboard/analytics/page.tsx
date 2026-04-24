"use client"

import { useEffect, useState } from "react"
import { apiService } from "@/lib/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts"
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Medal,
  BarChart3,
  Users,
  Target,
} from "lucide-react"

interface LectureStat {
  lectureId: string
  title: string
  attempts: { score: number; total: number; createdAt: string }[]
  best: number
  latest: number
  avg: number
  needsImprovement: boolean
}

interface LeaderboardEntry {
  rank: number
  studentId: string
  name: string
  email: string
  avgScore: number
  attempts: number
  best: number
  isMe: boolean
}

interface StudentAnalytics {
  overallAvg: number
  totalAttempts: number
  passed: number
  lectureStats: LectureStat[]
  scoreHistory: { date: string; score: number; lecture: string }[]
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[]
  myRank: number | null
}

const PASS_THRESHOLD = 70

function getRankBadge(rank: number) {
  if (rank === 1) return { icon: "🥇", color: "text-amber-500" }
  if (rank === 2) return { icon: "🥈", color: "text-slate-400" }
  if (rank === 3) return { icon: "🥉", color: "text-amber-700" }
  return { icon: `#${rank}`, color: "text-muted-foreground" }
}

function ScoreTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium mb-0.5">{label}</p>
      <p className="text-primary">{payload[0].value}%</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.all([apiService.getStudentAnalytics(), apiService.getLeaderboard()])
      .then(([a, l]) => {
        setAnalytics(a)
        setLeaderboard(l)
      })
      .catch(() => setError("Failed to load analytics. Make sure you have quiz attempts."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  const weakAreas = analytics?.lectureStats.filter((l) => l.needsImprovement) || []
  const strongAreas = analytics?.lectureStats.filter((l) => !l.needsImprovement) || []

  const historyChartData = (analytics?.scoreHistory || []).map((h, i) => ({
    name: `Q${i + 1}`,
    score: h.score,
    lecture: h.lecture,
  }))

  const lectureBarData = (analytics?.lectureStats || [])
    .slice()
    .sort((a, b) => a.avg - b.avg)
    .map((l) => ({
      name: l.title.length > 20 ? l.title.slice(0, 18) + "…" : l.title,
      avg: l.avg,
      best: l.best,
    }))

  const passRate =
    analytics && analytics.totalAttempts > 0
      ? Math.round((analytics.passed / analytics.totalAttempts) * 100)
      : 0

  const topFive = leaderboard?.leaderboard.slice(0, 5) || []
  const myRank = leaderboard?.myRank

  return (
    <div className="space-y-6">
      <div className="relative">
        {/* Pulsing AI orb — decorative accent */}
        <div className="absolute right-0 top-0 w-16 h-16 pointer-events-none select-none" aria-hidden>
          <div className="orb-ring absolute inset-0 rounded-full bg-amber-400/20" />
          <div className="orb-ring absolute inset-0 rounded-full bg-amber-400/15" style={{ animationDelay: "0.9s" }} />
          <div className="absolute inset-3 rounded-full border border-amber-400/30 animate-pulse" />
          <div className="absolute inset-[22px] rounded-full bg-amber-400/50" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your quiz performance, weak areas, and how you rank among peers
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Overall Average",
            value: `${analytics?.overallAvg ?? 0}%`,
            progress: analytics?.overallAvg ?? 0,
            icon: Target,
            color: "text-primary",
          },
          {
            label: "Pass Rate",
            value: `${passRate}%`,
            progress: passRate,
            icon: CheckCircle2,
            color: "text-emerald-500",
          },
          {
            label: "Total Attempts",
            value: `${analytics?.totalAttempts ?? 0}`,
            progress: Math.min((analytics?.totalAttempts ?? 0) * 10, 100),
            icon: BarChart3,
            color: "text-violet-500",
          },
          {
            label: "Your Rank",
            value: myRank ? `#${myRank}` : "—",
            progress: myRank && leaderboard
              ? Math.max(0, 100 - Math.round(((myRank - 1) / leaderboard.leaderboard.length) * 100))
              : 0,
            icon: Trophy,
            color: "text-amber-500",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold mb-2">{s.value}</p>
              <Progress value={s.progress} className="h-1.5" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="improvement">
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Improvement Areas
            {weakAreas.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-4 text-[10px] px-1">
                {weakAreas.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leaderboard">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* ─── Performance Charts ─── */}
        <TabsContent value="performance" className="space-y-4">
          {historyChartData.length > 0 ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Score Trend
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Your scores across all quiz attempts (pass line at 70%)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={historyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<ScoreTooltip />} />
                      <ReferenceLine y={PASS_THRESHOLD} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Pass", fontSize: 10, fill: "#f59e0b" }} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "hsl(var(--primary))" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {lectureBarData.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-violet-500" />
                      Score by Lecture
                    </CardTitle>
                    <CardDescription className="text-xs">Average score per lecture</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={lectureBarData} margin={{ top: 5, right: 10, left: -20, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => [`${v}%`]} />
                        <ReferenceLine y={PASS_THRESHOLD} stroke="#f59e0b" strokeDasharray="4 4" />
                        <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                          {lectureBarData.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.avg >= PASS_THRESHOLD ? "hsl(var(--primary))" : "#ef4444"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No quiz attempts yet.</p>
                <p className="text-xs text-muted-foreground">Complete quizzes to see your performance charts.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Improvement Areas ─── */}
        <TabsContent value="improvement" className="space-y-4">
          {weakAreas.length === 0 && strongAreas.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No quiz data to analyze yet.</p>
              </CardContent>
            </Card>
          )}

          {weakAreas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Needs Improvement
                </CardTitle>
                <CardDescription className="text-xs">
                  Lectures where your average is below {PASS_THRESHOLD}% — focus here
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {weakAreas.map((l) => (
                  <div key={l.lectureId} className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-medium">{l.title}</p>
                        <p className="text-xs text-muted-foreground">{l.attempts.length} attempt{l.attempts.length > 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-red-500">{l.avg}%</p>
                        <p className="text-[10px] text-muted-foreground">avg</p>
                      </div>
                    </div>
                    <Progress value={l.avg} className="h-1.5 bg-red-200 dark:bg-red-900/40" />
                    <div className="flex gap-4 mt-2">
                      <span className="text-[11px] text-muted-foreground">Best: <strong>{l.best}%</strong></span>
                      <span className="text-[11px] text-muted-foreground">Latest: <strong>{l.latest}%</strong></span>
                      {l.latest > l.avg && (
                        <span className="text-[11px] text-emerald-500 flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" /> Improving
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                      Tip: Review the lecture transcript and summary, then retry the quiz.
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {strongAreas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Strong Areas
                </CardTitle>
                <CardDescription className="text-xs">Lectures where you scored ≥ {PASS_THRESHOLD}%</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {strongAreas.map((l) => (
                  <div key={l.lectureId} className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{l.title}</p>
                        <p className="text-xs text-muted-foreground">{l.attempts.length} attempt{l.attempts.length > 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-500">{l.avg}%</p>
                        <p className="text-[10px] text-muted-foreground">avg</p>
                      </div>
                    </div>
                    <Progress value={l.avg} className="h-1.5 mt-2 bg-emerald-200 dark:bg-emerald-900/40" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Leaderboard ─── */}
        <TabsContent value="leaderboard" className="space-y-4">
          {myRank && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <Medal className="h-8 w-8 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Your current rank: #{myRank}</p>
                  <p className="text-xs text-muted-foreground">
                    Out of {leaderboard?.leaderboard.length} students
                    {myRank <= 3 ? " — Great job, keep it up!" : " — Keep practicing to climb higher!"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {topFive.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Top 5
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={topFive.map((e) => ({ name: e.name.split(" ")[0], avg: e.avgScore, isMe: e.isMe }))} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Avg Score"]} />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                      {topFive.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.isMe ? "hsl(var(--primary))" : i === 0 ? "#f59e0b" : "hsl(var(--muted-foreground) / 0.4)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-500" />
                Full Leaderboard
              </CardTitle>
              <CardDescription className="text-xs">Ranked by average quiz score</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {(leaderboard?.leaderboard || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No quiz attempts recorded yet.
                </p>
              ) : (
                <div className="divide-y">
                  {leaderboard!.leaderboard.map((entry) => {
                    const badge = getRankBadge(entry.rank)
                    return (
                      <div
                        key={entry.studentId.toString()}
                        className={`flex items-center gap-3 px-4 py-2.5 ${entry.isMe ? "bg-primary/5 font-semibold" : ""}`}
                      >
                        <span className={`text-sm w-7 text-center ${badge.color} font-bold shrink-0`}>
                          {badge.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 text-sm truncate">
                            <span className="truncate">{entry.name}</span>
                            {entry.isMe && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary shrink-0">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{entry.attempts} attempt{entry.attempts !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${entry.avgScore >= PASS_THRESHOLD ? "text-emerald-500" : "text-red-400"}`}>
                            {entry.avgScore}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">avg</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
