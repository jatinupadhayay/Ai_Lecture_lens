"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  BookOpen,
  Brain,
  Trophy,
  BarChart3,
  ArrowRight,
  Mic,
  FileText,
  Sparkles,
  GraduationCap,
} from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAppStore()

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Lecture Lens</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/auth/login")}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => router.push("/auth/signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-6 pt-20 pb-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full border bg-secondary/50 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI-powered learning platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
              Turn any lecture into an
              <span className="text-primary"> interactive study guide</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload a video, audio, or presentation. Get AI-generated transcripts, concise summaries,
              and self-assessment quizzes -- all in seconds.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="px-8" onClick={() => router.push("/auth/signup")}>
                Start for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/auth/login")}>
                Sign in to dashboard
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">How it works</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Three steps from raw lecture to study-ready material</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                icon: Mic,
                title: "Upload your lecture",
                desc: "Drop in a video, audio file, presentation, or paste a YouTube link.",
              },
              {
                step: "02",
                icon: Brain,
                title: "AI processes it",
                desc: "Automatic transcription, OCR, and dual-model summarization run in the background.",
              },
              {
                step: "03",
                icon: FileText,
                title: "Learn & test yourself",
                desc: "Review smart summaries, browse the transcript, and take auto-generated quizzes.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center group">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mb-5 group-hover:bg-primary/15 transition-colors">
                  <item.icon className="h-6 w-6" />
                </div>
                <div className="text-xs font-semibold text-primary/60 uppercase tracking-widest mb-2">Step {item.step}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Everything you need to learn smarter</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Built for students and educators who value their time</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: BookOpen, title: "Multi-format upload", desc: "Video, audio, PPT, PDF, or YouTube links" },
              { icon: Mic, title: "Bilingual transcription", desc: "English and Hindi with timestamps" },
              { icon: Brain, title: "Dual AI summaries", desc: "Local BART model + OpenAI for best results" },
              { icon: Trophy, title: "Auto quizzes", desc: "MCQs generated from lecture content" },
              { icon: FileText, title: "OCR extraction", desc: "Text from slides and whiteboards" },
              { icon: BarChart3, title: "Progress analytics", desc: "Track scores, streaks, and growth" },
              { icon: Sparkles, title: "Real-time processing", desc: "Background AI pipeline with live status" },
              { icon: GraduationCap, title: "Role-based access", desc: "Student, teacher, and admin roles" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow">
                <f.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Ready to learn smarter?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Upload your first lecture and see AI-generated study materials in minutes.
          </p>
          <Button size="lg" className="px-10" onClick={() => router.push("/auth/signup")}>
            Create free account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Lecture Lens</span>
          </div>
          <p>Built with Next.js, Express, and AI</p>
        </div>
      </footer>
    </div>
  )
}
