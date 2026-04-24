"use client"

import { useRouter, usePathname } from "next/navigation"
import { useRef, useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  BookOpen, FileText, Brain, Trophy,
  BarChart3, User, LayoutDashboard, LineChart, Library, Lightbulb,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Home",      href: "/dashboard",           icon: LayoutDashboard },
  { label: "Lectures",  href: "/dashboard/lectures",  icon: BookOpen },
  { label: "Library",   href: "/dashboard/library",   icon: Library },
  { label: "Summaries", href: "/dashboard/summaries", icon: FileText },
  { label: "Quizzes",   href: "/dashboard/quizzes",   icon: Brain },
  { label: "Scores",    href: "/dashboard/scores",    icon: Trophy },
  { label: "Progress",  href: "/dashboard/progress",  icon: BarChart3 },
  { label: "Analytics", href: "/dashboard/analytics", icon: LineChart },
  { label: "Profile",   href: "/dashboard/profile",   icon: User },
] as const

const MIN_W     = 160
const MAX_W     = 320
const DEFAULT_W = 210
const COLLAPSE_THRESHOLD = 180

export function Sidebar() {
  const router   = useRouter()
  const pathname = usePathname()
  const [width, setWidth] = useState(DEFAULT_W)

  // Refs hold mutable drag state — no stale closure risk
  const isResizing = useRef(false)
  const startX     = useRef(0)
  const startWidth = useRef(DEFAULT_W)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const next = Math.min(Math.max(startWidth.current + e.clientX - startX.current, MIN_W), MAX_W)
      setWidth(next)
    }
    const onUp = () => {
      isResizing.current        = false
      document.body.style.cursor     = ""
      document.body.style.userSelect = ""
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup",   onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup",   onUp)
      // Reset body styles if component unmounts mid-drag
      document.body.style.cursor     = ""
      document.body.style.userSelect = ""
    }
  }, []) // stable: only refs and setWidth (stable dispatch) used inside

  const collapsed = useMemo(() => width < COLLAPSE_THRESHOLD, [width])

  const startResize = (e: React.MouseEvent) => {
    isResizing.current        = true
    startX.current            = e.clientX
    startWidth.current        = width
    document.body.style.cursor     = "col-resize"
    document.body.style.userSelect = "none"
  }

  return (
    <aside
      className="relative flex h-full flex-col border-r border-border bg-sidebar shrink-0"
      style={{ width }}
    >
      <ScrollArea className="flex-1 py-4">
        <nav className="px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))

            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-all duration-150 text-left group",
                  active
                    ? "bg-[#EAB308]/12 text-[#EAB308] font-semibold"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-[17px] w-[17px] shrink-0",
                  active
                    ? "text-[#EAB308]"
                    : "text-muted-foreground/70 group-hover:text-foreground/70"
                )} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </ScrollArea>

      {!collapsed && (
        <div className="p-3 border-t border-border">
          {/* Editorial tip card — icon pinned to bottom-right (Behance inspired) */}
          <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-[#EAB308]/10 to-[#D97706]/8 border border-[#EAB308]/20 p-3.5 min-h-[90px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#D97706]/70 mb-1.5">Study Tip</p>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed pr-7">
              Review weak areas before starting new lectures.
            </p>
            {/* Icon pinned bottom-right */}
            <div className="absolute bottom-3 right-3 h-7 w-7 rounded-lg bg-[#EAB308]/15 flex items-center justify-center">
              <Lightbulb className="h-3.5 w-3.5 text-[#D97706]" />
            </div>
          </div>
        </div>
      )}

      {/* Drag handle — 4 px wide, full height */}
      <div
        onMouseDown={startResize}
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
      />
    </aside>
  )
}
