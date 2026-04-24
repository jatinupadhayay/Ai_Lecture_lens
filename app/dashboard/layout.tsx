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
          <main className="flex-1 overflow-y-auto bg-secondary/40">
            <div className="max-w-5xl mx-auto px-6 py-7 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
