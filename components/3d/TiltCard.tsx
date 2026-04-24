"use client"
import { useRef, type ReactNode } from "react"

interface TiltCardProps {
  children: ReactNode
  className?: string
  intensity?: number   // max tilt degrees, default 7
}

// Wraps children in a div that tilts toward the mouse cursor in 3D.
// Uses CSS perspective transform — no extra dependencies.
export function TiltCard({ children, className, intensity = 7 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width  - 0.5   // -0.5 → 0.5
    const y = (e.clientY - r.top)  / r.height - 0.5
    el.style.transform = `perspective(900px) rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) scale(1.025)`
  }

  const onLeave = () => {
    const el = ref.current
    if (el) el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg) scale(1)"
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: "transform 0.18s ease-out",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  )
}
