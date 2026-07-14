// Touch-screen customer signature capture (SOW Section 4 / 2.6).
// Canvas accepts touch and stylus via pointer events; exports a PNG blob for
// cloud storage and inline embedding in the offer-letter PDF.

import { useEffect, useRef, useState } from 'react'

interface SignaturePadProps {
  /** called with the PNG blob + data URL each time the drawing changes */
  onChange: (result: { blob: Blob; dataUrl: string } | null) => void
}

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Match the backing store to the displayed size for crisp strokes.
    const scale = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * scale
    canvas.height = rect.height * scale
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(scale, scale)
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#0f172a'
    }
  }, [])

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function emit() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    canvas.toBlob((blob) => {
      if (blob) onChange({ blob, dataUrl })
    }, 'image/png')
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = e.currentTarget.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }

  function handleUp() {
    if (!drawing.current) return
    drawing.current = false
    emit()
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(null)
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        className="w-full h-40 bg-white border-2 border-dashed border-slate-300 rounded-md touch-none"
        aria-label="Customer signature area"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {hasInk ? 'Signature captured' : 'Customer signs above'}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-slate-500 underline min-h-11 px-2"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
