"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, GraduationCap } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const { signup } = useAppStore()
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const change = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError("Passwords do not match"); return }
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true); setError("")
    try {
      const ok = await signup(form.name, form.email, form.password)
      if (ok) { toast.success("Account created!"); router.push("/dashboard") }
      else setError("Failed to create account. Please try again.")
    } catch { setError("Something went wrong. Please try again.") }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[42%] bg-secondary border-r border-border flex-col justify-between p-10">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-[14px] font-semibold text-foreground">Lecture Lens</span>
        </div>

        <div>
          <h2 className="text-[32px] font-bold leading-tight tracking-tight text-foreground mb-4">
            Start your AI<br />learning journey.
          </h2>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-xs">
            Join students using AI to study smarter — not harder.
          </p>

          <div className="mt-10 space-y-3">
            {[
              "Upload any lecture format",
              "AI summaries in seconds",
              "Auto-generated MCQ quizzes",
              "Peer rankings & analytics",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-[13px] text-muted-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground/60 italic">
          "Education is not the filling of a pail, but the lighting of a fire."
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[360px]">

          <div className="flex justify-center mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-1">Create your account</h1>
          <p className="text-[14px] text-muted-foreground mb-8">Free to start, no credit card needed</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-[13px] font-medium text-foreground">Full name</Label>
              <Input
                id="name" name="name" placeholder="John Doe"
                value={form.name} onChange={change} required disabled={loading}
                className="h-10 text-[14px] bg-card border-border focus:border-primary/50 focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[13px] font-medium text-foreground">Email</Label>
              <Input
                id="email" name="email" type="email" placeholder="you@example.com"
                value={form.email} onChange={change} required disabled={loading}
                className="h-10 text-[14px] bg-card border-border focus:border-primary/50 focus-visible:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] font-medium text-foreground">Password</Label>
                <Input
                  id="password" name="password" type="password" placeholder="Min. 6 chars"
                  value={form.password} onChange={change} required disabled={loading}
                  className="h-10 text-[14px] bg-card border-border focus:border-primary/50 focus-visible:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-[13px] font-medium text-foreground">Confirm</Label>
                <Input
                  id="confirm" name="confirm" type="password" placeholder="Repeat"
                  value={form.confirm} onChange={change} required disabled={loading}
                  className="h-10 text-[14px] bg-card border-border focus:border-primary/50 focus-visible:ring-primary/20"
                />
              </div>
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
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account…</> : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
