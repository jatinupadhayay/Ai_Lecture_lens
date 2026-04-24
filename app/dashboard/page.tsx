"use client"

import { useEffect, useMemo } from "react"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import { getLectureStatusStyle, safeAvg, safePct, fmtDateShort, fmtDateLong } from "@/lib/utils"
import {
  BookOpen, Brain, Trophy, PlayCircle,
  FileText, Plus, ArrowRight, Sparkles,
  TrendingUp, CheckCircle2, Clock, BarChart3,
} from "lucide-react"
import { ParticleCanvas } from "@/components/3d/ParticleCanvas"
import { TiltCard } from "@/components/3d/TiltCard"

export default function DashboardPage() {
  const router = useRouter()
  const { user, lectures, fetchLectures, getUserQuizAttempts } = useAppStore()

  useEffect(() => { fetchLectures() }, [fetchLectures])
  if (!user) return null

  const attempts = getUserQuizAttempts()

  // Single pass over lectures for all status counts
  const lectureCounts = useMemo(() => {
    const counts = { completed: 0, processing: 0, total: lectures.length }
    for (const l of lectures as any[]) {
      if (l.status === "completed") counts.completed++
      else if (l.status === "processing" || l.status === "queued") counts.processing++
    }
    return counts
  }, [lectures])

  // Sort once, memoized
  const recentLectures = useMemo(
    () => [...lectures as any[]].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 5),
    [lectures]
  )

  const avgScore       = useMemo(() => safeAvg(user.scores || []), [user.scores])
  const bestScore      = useMemo(() => Math.max(0, ...(user.scores || [])), [user.scores])
  const passRate       = useMemo(() => safePct(
    (attempts as any[]).filter((a) => a.score >= 70).length, attempts.length
  ), [attempts])
  const completionPct  = useMemo(() => safePct(lectureCounts.completed, lectureCounts.total), [lectureCounts])

  const continueLecture = recentLectures.find((l) => l.status === "completed")
  const lastAttempt     = (attempts as any[]).at(-1)

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  // Reversed slice memoized
  const recentAttempts = useMemo(
    () => [...(attempts as any[])].reverse().slice(0, 5),
    [attempts]
  )

  return (
    <div className="relative">
      <ParticleCanvas />
      {/* Gradient blobs — ambient depth behind content */}
      <div
        className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(234,179,8,0.07) 0%, transparent 65%)", zIndex: 0 }}
        aria-hidden
      />
      <div
        className="absolute bottom-0 left-0 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(180,145,55,0.05) 0%, transparent 65%)", zIndex: 0 }}
        aria-hidden
      />
      <div className="relative space-y-6" style={{ zIndex: 1 }}>

      {/* ── Section label — Behance inspired "OVERVIEW 01" ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">Overview</span>
          <span className="flex-1 h-px w-10 bg-border" />
        </div>
        <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground/30">01</span>
      </div>

      {/* ── Greeting ── */}
      <div className="flex items-end justify-between gap-4 -mt-2">
        <div>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">{greeting},</p>
          <h1
            className="text-[48px] font-bold tracking-tight leading-[1.0]"
            style={{ background: "linear-gradient(135deg, #1C1917 30%, #92400e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            {user.name?.split(" ")[0]}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-3">
            {lectureCounts.completed > 0
              ? `${lectureCounts.completed} of ${lectureCounts.total} lectures completed`
              : "Upload your first lecture to begin."}
            {lectureCounts.processing > 0 && ` · ${lectureCounts.processing} processing`}
          </p>
        </div>
        <Button
          className="bg-foreground text-background hover:bg-foreground/90 h-9 px-5 text-[13px] font-semibold rounded-lg shadow-warm shrink-0 mb-1"
          onClick={() => router.push("/dashboard/lectures")}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Lecture
        </Button>
      </div>

      {/* ── Achievement strip (700+ / 85% / 2x style) ── */}
      <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card shadow-warm overflow-hidden">
        {([
          { value: String(lectureCounts.total || 0), label: "Lectures Uploaded" },
          { value: `${avgScore}%`,                   label: "Average Score"     },
          { value: String(attempts.length || 0),     label: "Quiz Attempts"     },
        ]).map((s) => (
          <div key={s.label} className="py-5 px-6 text-center">
            <p className="text-[36px] font-bold tracking-tight text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── 4 stat cards — editorial number-first ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { label: "Lectures",   value: lectureCounts.total,      sub: `${lectureCounts.completed} done`,  progress: completionPct,          href: "/dashboard/lectures",  accent: "text-foreground"   },
          { label: "Avg Score",  value: `${avgScore}%`,            sub: `Best ${bestScore}%`,               progress: avgScore,               href: "/dashboard/scores",    accent: "text-[#D97706]"    },
          { label: "Attempts",   value: attempts.length,           sub: `${passRate}% pass rate`,           progress: passRate,               href: "/dashboard/analytics", accent: "text-foreground"   },
          { label: "Attendance", value: `${user.attendance || 0}%`,sub: "This semester",                    progress: user.attendance || 0,   href: "/dashboard/progress",  accent: "text-foreground"   },
        ] as const).map((s) => (
          <TiltCard key={s.label}>
            <button
              onClick={() => router.push(s.href)}
              className="group w-full text-left px-5 pt-5 pb-4 rounded-2xl bg-card border border-border shadow-warm hover:shadow-warm-md hover:border-primary/30 transition-all duration-200"
            >
              <p className={`text-[38px] font-bold tracking-tight leading-none ${s.accent}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/55 mt-2.5">{s.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1 mb-4">{s.sub}</p>
              {/* Thin progress line — Behance style */}
              <div className="h-[2px] bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/50 rounded-full transition-all duration-700"
                  style={{ width: `${s.progress}%` }}
                />
              </div>
            </button>
          </TiltCard>
        ))}
      </div>

      {/* ── Continue Learning ── */}
      {continueLecture && (
        <div
          className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border shadow-warm hover:border-primary/30 hover:shadow-warm-md transition-all duration-150 cursor-pointer"
          onClick={() => router.push(`/dashboard/lectures/${continueLecture._id}`)}
        >
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <PlayCircle className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1">Continue Learning</p>
            <p className="text-[15px] font-semibold text-foreground truncate">{continueLecture.title}</p>
            <p className="text-[12px] text-muted-foreground">{fmtDateLong(continueLecture.createdAt)}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 h-8 px-4 text-[12px] rounded-lg"
              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/summaries?lecture=${continueLecture._id}`) }}>
              <FileText className="mr-1.5 h-3 w-3" />Summary
            </Button>
            <Button size="sm" variant="outline"
              className="h-8 px-4 text-[12px] rounded-lg border-border text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/quizzes?lecture=${continueLecture._id}`) }}>
              <Brain className="mr-1.5 h-3 w-3" />Quiz
            </Button>
          </div>
        </div>
      )}

      {/* ── AI Insight ── */}
      {lastAttempt && (
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-primary/8 border border-primary/20">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-foreground">
              Last quiz score:{" "}
              <span className={lastAttempt.score >= 70 ? "text-emerald-600" : "text-red-500"}>
                {lastAttempt.score}%
              </span>
            </p>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {lastAttempt.score >= 70
                ? "Good result — check Analytics to see your peer ranking."
                : "Below pass threshold — review the summary and retry."}
            </p>
          </div>
          <Button variant="outline" size="sm"
            className="h-8 px-4 text-[12px] rounded-lg border-primary/30 text-primary hover:bg-primary/10 shrink-0"
            onClick={() => router.push("/dashboard/analytics")}>
            Analytics <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}

      {/* ── Section label ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/50">Activity</span>
          <span className="h-px w-10 bg-border" />
        </div>
        <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground/30">02</span>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 -mt-2">

        {/* Lecture list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">Recent Lectures</h2>
            <button
              onClick={() => router.push("/dashboard/lectures")}
              className="text-[12px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {recentLectures.length > 0 ? (
            <div className="rounded-2xl bg-card border border-border shadow-warm overflow-hidden divide-y divide-border">
              {recentLectures.map((lec) => (
                <div
                  key={lec._id}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/dashboard/lectures/${lec._id}`)}
                >
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <BookOpen className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-foreground truncate">{lec.title}</p>
                    <p className="text-[12px] text-muted-foreground">{fmtDateShort(lec.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${getLectureStatusStyle(lec.status)}`}>
                      {lec.status}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {[
                        { label: "Summary", icon: FileText, path: `/dashboard/summaries?lecture=${lec._id}` },
                        { label: "Quiz",    icon: Brain,    path: `/dashboard/quizzes?lecture=${lec._id}` },
                      ].map((btn) => (
                        <button key={btn.label}
                          className="h-7 px-2.5 text-[11px] bg-secondary border border-border rounded-lg text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors flex items-center gap-1"
                          onClick={(e) => { e.stopPropagation(); router.push(btn.path) }}
                        >
                          <btn.icon className="h-3 w-3" /> {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative flex flex-col items-center justify-center py-16 rounded-2xl bg-card border border-dashed border-border gap-3 overflow-hidden">
              <div className="bg-dot-grid absolute inset-0 opacity-40 pointer-events-none" aria-hidden />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200/60 flex items-center justify-center shadow-warm">
                  <BookOpen className="h-6 w-6 text-amber-500" />
                </div>
                <p className="text-[14px] font-medium text-muted-foreground">No lectures yet</p>
                <Button size="sm"
                  className="bg-foreground text-background hover:bg-foreground/90 h-8 px-4 text-[12px] rounded-lg"
                  onClick={() => router.push("/dashboard/lectures")}>
                  <Plus className="mr-1.5 h-3 w-3" /> Upload first lecture
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Quiz Activity */}
          <div>
            <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground/60" />
              Recent Quizzes
            </h2>
            <div className="rounded-2xl bg-card border border-border shadow-warm overflow-hidden">
              {recentAttempts.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentAttempts.map((a, i) => (
                    <div key={a.id || i} className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${a.score >= 70 ? "bg-emerald-50" : "bg-red-50"}`}>
                          {a.score >= 70
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            : <TrendingUp    className="h-4 w-4 text-red-500" />
                          }
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{a.score >= 70 ? "Passed" : "Needs review"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {a.completedAt ? fmtDateShort(a.completedAt) : "Recently"}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[13px] font-bold ${a.score >= 70 ? "text-emerald-600" : "text-red-500"}`}>
                        {a.score}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Brain className="h-9 w-9 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground">No quizzes yet</p>
                </div>
              )}
            </div>
            {recentAttempts.length > 0 && (
              <button
                className="w-full mt-2 text-[12px] text-muted-foreground hover:text-primary transition-colors py-1"
                onClick={() => router.push("/dashboard/analytics")}
              >
                View full analytics →
              </button>
            )}
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-[15px] font-semibold text-foreground mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {([
                { label: "Browse all quizzes", icon: Brain,    href: "/dashboard/quizzes" },
                { label: "View summaries",      icon: FileText, href: "/dashboard/summaries" },
                { label: "Check leaderboard",   icon: Trophy,   href: "/dashboard/analytics" },
              ] as const).map((q) => (
                <button key={q.href} onClick={() => router.push(q.href)}
                  className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-warm text-left hover:border-primary/30 hover:shadow-warm-md transition-all duration-150"
                >
                  <q.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[13px] font-medium text-foreground">{q.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-transparent group-hover:text-muted-foreground ml-auto transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
