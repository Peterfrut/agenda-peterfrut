"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  initialPosition?: { x: number; y: number };
  className?: string;
  children: React.ReactNode;
};

export function DraggablePanel({
  open,
  onClose,
  title,
  initialPosition = { x: 480, y: 140 },
  className,
  children,
}: Props) {
  const [pos, setPos] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setPos(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      if (!dragging) return;
      setPos({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    }

    function handleUp() {
      setDragging(false);
    }

    if (dragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, offset]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed z-40 w-[380px] rounded-lg border bg-card shadow-2xl",
        className
      )}
      style={{ top: pos.y, left: pos.x }}
    >
      {/* header arrastável */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-zinc-950 cursor-move rounded-t-lg text-white"
        onMouseDown={(e) => {
          setDragging(true);
          setOffset({
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
          });
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
  );
}
