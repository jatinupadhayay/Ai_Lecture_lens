"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Navbar onMenuToggle={() => setMobileOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — hidden below md */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile sidebar — Sheet overlay */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-[220px] border-r border-border">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <main className="flex-1 overflow-y-auto bg-secondary/40 relative">
          <div className="bg-dot-grid absolute inset-0 pointer-events-none" aria-hidden />
          <div
            className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(234,179,8,0.055) 0%, transparent 70%)" }}
            aria-hidden
          />
          <div
            className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(180,145,55,0.045) 0%, transparent 70%)" }}
            aria-hidden
          />
          <div className="max-w-5xl mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
