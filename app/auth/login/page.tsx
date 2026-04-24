"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, GraduationCap } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useAppStore()
  const [form, setForm] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { if (user) router.push("/dashboard") }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const ok = await login(form.email, form.password)
      if (ok) toast.success("Welcome back!")
      else setError("Invalid email or password.")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* Left — warm cream branding panel */}
      <div className="hidden lg:flex lg:w-[42%] bg-secondary border-r border-border flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-[14px] font-semibold text-foreground">Lecture Lens</span>
        </div>

        <div>
          <h2 className="text-[32px] font-bold leading-tight tracking-tight text-foreground mb-4">
            Your lectures,<br />intelligently studied.
          </h2>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-xs">
            AI transcripts, smart summaries, and auto-generated quizzes — all from a single upload.
          </p>

          <div className="mt-10 space-y-3">
            {[
              "Upload video, audio, or slides",
              "Get AI summaries in seconds",
              "Test yourself with auto-quizzes",
              "Track performance over time",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[13px] text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground/60 italic">
          "The beautiful thing about learning is that no one can take it away from you."
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-1">Welcome back</h1>
          <p className="text-[14px] text-muted-foreground mb-8">Sign in to continue learning</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-foreground">Email</Label>
              <Input
                id="email" type="email" placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required disabled={loading}
                className="h-10 text-[14px] bg-card border-border focus:border-primary/50 focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] font-medium text-foreground">Password</Label>
              <Input
                id="password" type="password" placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required disabled={loading}
                className="h-10 text-[14px] bg-card border-border focus:border-primary/50 focus-visible:ring-primary/20"
              />
            </div>

            {error && (
              <div className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-10 text-[14px] font-medium bg-foreground text-background hover:bg-foreground/90 rounded-lg shadow-warm mt-1"
              disabled={loading}
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-primary font-medium hover:underline">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
