"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, fetchProfile } = useAppStore();

  // 🔹 Run only once on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 🔹 Redirect only after loading completes
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !pathname.startsWith("/auth")) {
      router.replace("/auth/login");
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // 🔹 Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // 🔹 Prevent flash during redirect
  if (!isAuthenticated && !pathname.startsWith("/auth")) {
    return null;
  }

  return <>{children}</>;
}
