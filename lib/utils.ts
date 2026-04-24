import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Lecture status → pill Tailwind classes */
export const lectureStatusStyle: Record<string, string> = {
  completed:  "text-emerald-700 bg-emerald-50 border-emerald-200",
  processing: "text-[#EAB308] bg-[#EAB308]/8 border-[#EAB308]/20",
  queued:     "text-[#EAB308] bg-[#EAB308]/8 border-[#EAB308]/20",
  uploaded:   "text-muted-foreground bg-muted border-border",
  failed:     "text-red-600 bg-red-50 border-red-200",
}

export function getLectureStatusStyle(status: string): string {
  return lectureStatusStyle[status] ?? lectureStatusStyle.uploaded
}

/** Safe average of a number array; returns 0 for empty arrays */
export function safeAvg(nums: number[]): number {
  if (!nums.length) return 0
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

/** Safe percentage (numerator/denominator * 100); returns 0 for zero denominator */
export function safePct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

/** Short date format e.g. "Apr 2" */
export function fmtDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Long date format e.g. "April 2, 2026" */
export function fmtDateLong(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}
