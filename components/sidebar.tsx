"use client"

import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, FileText, Brain, Trophy, BarChart3, User, LayoutDashboard } from "lucide-react"

const sidebarItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Lectures", href: "/dashboard/lectures", icon: BookOpen },
  { title: "Summaries", href: "/dashboard/summaries", icon: FileText },
  { title: "Quizzes", href: "/dashboard/quizzes", icon: Brain },
  { title: "Scores", href: "/dashboard/scores", icon: Trophy },
  { title: "Progress", href: "/dashboard/progress", icon: BarChart3 },
  { title: "Profile", href: "/dashboard/profile", icon: User },
]

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card shrink-0">
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))

            return (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full justify-start h-9 px-3 font-normal",
                  isActive && "bg-primary/10 text-primary font-medium hover:bg-primary/15",
                )}
                onClick={() => router.push(item.href)}
              >
                <item.icon className={cn("mr-2.5 h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.title}
              </Button>
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}
