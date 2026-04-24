"use client"

import { useRouter } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, User, GraduationCap } from "lucide-react"

export function Navbar() {
  const router = useRouter()
  const { user, logout } = useAppStore()

  if (!user) return null

  return (
    <nav className="h-[58px] border-b border-border bg-card px-5 flex items-center justify-between shrink-0 shadow-warm">
      {/* Brand */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-2.5 hover:opacity-75 transition-opacity"
      >
        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-foreground">Lecture Lens</span>
      </button>

      {/* Right */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:block text-[12px] text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border capitalize">
          {user.role || "student"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full p-0 hover:bg-accent">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52 shadow-warm-md border-border" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <p className="text-[13px] font-semibold">{user.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[13px] cursor-pointer"
              onClick={() => router.push("/dashboard/profile")}
            >
              <User className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              Profile settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[13px] cursor-pointer text-red-500 hover:text-red-600 focus:text-red-600"
              onClick={() => { logout(); router.push("/") }}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
