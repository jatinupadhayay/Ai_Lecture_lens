"use client"

import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, FileText, Brain, Trophy, BarChart3, User, Home } from "lucide-react"

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Lectures",
    href: "/dashboard/lectures",
    icon: BookOpen,
  },
  {
    title: "Summaries",
    href: "/dashboard/summaries",
    icon: FileText,
  },
  {
    title: "Quizzes",
    href: "/dashboard/quizzes",
    icon: Brain,
  },
  {
    title: "Scores",
    href: "/dashboard/scores",
    icon: Trophy,
  },
  {
    title: "Progress",
    href: "/dashboard/progress",
    icon: BarChart3,
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: User,
  },
]

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-white dark:bg-gray-900 border-r">
      <div className="flex h-16 items-center border-b px-6">
        <BookOpen className="h-8 w-8 text-blue-600" />
        <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">Smart Lecture AI</span>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
                )}
                onClick={() => router.push(item.href)}
              >
                <item.icon className="mr-3 h-4 w-4" />
                {item.title}
              </Button>
            )
          })}
        </nav>
      </ScrollArea>
    </div>
  )
}
