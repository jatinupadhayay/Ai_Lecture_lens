"use client"
import { useEffect, useRef } from "react"

interface Dot {
  x: number; y: number
  vx: number; vy: number
  r: number; a: number
}

// Neural-network style floating particles — warm amber to match design system.
// Renders into an absolute-positioned canvas that fills its nearest `relative` parent.
export function ParticleCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let raf: number

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()

    const N    = 75
    const LINK = 140
    const dots: Dot[] = Array.from({ length: N }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      r:  Math.random() * 1.4 + 0.4,
      a:  Math.random() * 0.22 + 0.06,
    }))

    const tick = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      for (const d of dots) {
        d.x = (d.x + d.vx + W) % W
        d.y = (d.y + d.vy + H) % H
      }

      // connections
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx   = dots[i].x - dots[j].x
          const dy   = dots[i].y - dots[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < LINK) {
            ctx.beginPath()
            ctx.moveTo(dots[i].x, dots[i].y)
            ctx.lineTo(dots[j].x, dots[j].y)
            ctx.strokeStyle = `rgba(180,145,55,${(1 - dist / LINK) * 0.055})`
            ctx.lineWidth   = 0.7
            ctx.stroke()
          }
        }
      }

      // dots
      for (const d of dots) {
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180,145,55,${d.a})`
        ctx.fill()
      }

      raf = requestAnimationFrame(tick)
    }
    tick()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  )
}
