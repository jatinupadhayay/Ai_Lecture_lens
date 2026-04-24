import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-secondary/40 relative">
            {/* Dot-grid texture across entire content area */}
            <div className="bg-dot-grid absolute inset-0 pointer-events-none" aria-hidden />
            {/* Warm ambient blobs — top-right and bottom-left */}
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
            <div className="max-w-5xl mx-auto px-6 py-7 lg:px-8 relative z-10">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
