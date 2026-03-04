"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  initialPosition?: { x: number; y: number } // usado em desktop
  className?: string
  children: React.ReactNode
}

const PANEL_W = 380
const LG_BREAKPOINT = 1024 // Tailwind lg

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function DraggablePanel({
  open,
  onClose,
  title,
  initialPosition = { x: 480, y: 140 },
  className,
  children,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  const [pos, setPos] = useState(initialPosition)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Reposiciona quando abrir / redimensionar (centraliza em < lg, padrão em >= lg)
  useLayoutEffect(() => {
    if (!open) return

    const computeInitialPos = () => {
      const w = window.innerWidth
      const h = window.innerHeight

      const panelH = panelRef.current?.offsetHeight ?? 300

      // Mobile/tablet: centraliza
      if (w < LG_BREAKPOINT) {
        const x = Math.round((w - PANEL_W) / 2)
        const y = Math.round((h - panelH) / 2)

        setPos({
          x: clamp(x, 8, w - PANEL_W - 8),
          y: clamp(y, 8, h - panelH - 8),
        })
        return
      }

      // Desktop: usa o padrão
      setPos(initialPosition)
    }

    computeInitialPos()

    window.addEventListener("resize", computeInitialPos)
    return () => window.removeEventListener("resize", computeInitialPos)
  }, [open, initialPosition.x, initialPosition.y])

  // Drag
  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!dragging) return
      setPos({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      })
    }

    function handleUp() {
      setDragging(false)
    }

    if (dragging) {
      window.addEventListener("mousemove", handleMove)
      window.addEventListener("mouseup", handleUp)
    }

    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [dragging, offset])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      className={cn("fixed z-40 w-[380px] rounded-lg border bg-card shadow-2xl", className)}
      style={{ top: pos.y, left: pos.x }}
    >
      {/* header arrastável */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-secondary-foreground cursor-move rounded-t-lg text-white"
        onMouseDown={(e) => {
          setDragging(true)
          setOffset({
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
          })
        }}
      >
        <span className="text-[18px] font-semibold">{title}</span>
        <button
          type="button"
          className="p-1 rounded hover:bg-zinc-200"
          onClick={onClose}
        >
          <X className="w-4 h-4 cursor-pointer" />
        </button>
      </div>

      <div className="p-3">{children}</div>
    </div>
  )
}