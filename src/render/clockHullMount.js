// Thin React-side adapters that drive the framework-free renderer from a
// canvas element. These mounts are intentionally small: they own a RAF loop,
// a ResizeObserver, and an FPS tracker, and delegate all pixel work to
// clockHullRenderer.js.

import {
  DEFAULT_CLOCK_HULL_PARAMS,
  DEFAULT_SWAP_PARAMS,
  drawGrid,
  drawPiece
} from './clockHullRenderer.js'

function makeFpsTracker() {
  let frames = 0
  let windowStart = (typeof performance !== 'undefined' ? performance : Date).now()
  let current = 0
  return {
    tick() {
      frames++
      const now = (typeof performance !== 'undefined' ? performance : Date).now()
      const dt = now - windowStart
      if (dt >= 500) {
        current = (frames * 1000) / dt
        frames = 0
        windowStart = now
      }
    },
    get() { return current }
  }
}

function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect()
  const cssW = Math.max(1, rect.width)
  const cssH = Math.max(1, rect.height)
  const dpr = typeof window !== 'undefined'
    ? Math.min(2, Math.max(1, window.devicePixelRatio || 1))
    : 1
  const w = Math.max(1, Math.round(cssW * dpr))
  const h = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
}

function drawSoldMinuteMarkers(ctx, canvasW, canvasH, cols, rows, soldSet) {
  if (!soldSet || soldSet.size === 0) return
  const cellW = canvasW / cols
  const cellH = canvasH / rows
  const N = cols * rows
  const dotR = Math.max(1.25, Math.min(cellW, cellH) * 0.055)
  ctx.save()
  ctx.fillStyle = 'rgba(252, 83, 83, 0.68)'
  // ctx.strokeStyle = 'rgba(24, 24, 24, 0.45)'
  // ctx.lineWidth = Math.max(0.5, dotR * 0.10)
  for (let i = 0; i < N; i++) {
    if (!soldSet.has(i)) continue
    const row = (i / cols) | 0
    const col = i % cols
    const cx = col * cellW + cellW * 0.91
    const cy = row * cellH + cellH * 0.91
    ctx.beginPath()
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2)
    ctx.fill()
    
    // ctx.stroke()
  }
  ctx.restore()
}

function makeLoop({ targetFps, draw, tracker, onFrame }) {
  let rafId = 0
  let running = true
  const frameInterval = targetFps > 0 ? 1000 / targetFps : 0
  let lastDrawn = 0

  const tick = (now) => {
    if (!running) return
    if (!frameInterval || now - lastDrawn >= frameInterval) {
      draw()
      tracker.tick()
      onFrame && onFrame()
      lastDrawn = now
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  return () => {
    running = false
    if (rafId) cancelAnimationFrame(rafId)
  }
}

export function mountSingleClock(canvas, {
  getMinuteIndex,
  getSecondInMinute,
  getGridRow = () => 0,
  // Accepts either a number or a () => number, so the caller can let the
  // color-wave denominator follow a responsive grid layout.
  gridRowCount = 60,
  clockParams = DEFAULT_CLOCK_HULL_PARAMS,
  swapParams = DEFAULT_SWAP_PARAMS,
  targetFps = 60,
  onFrame = null
}) {
  const ctx = canvas.getContext('2d')
  const tracker = makeFpsTracker()

  sizeCanvas(canvas)
  const ro = new ResizeObserver(() => sizeCanvas(canvas))
  ro.observe(canvas)

  const readRowCount = typeof gridRowCount === 'function'
    ? gridRowCount
    : () => gridRowCount

  const draw = () => {
    const w = canvas.width
    const h = canvas.height
    const sec = getSecondInMinute()
    const idx = getMinuteIndex()
    const row = getGridRow()
    drawPiece(
      ctx, { x: 0, y: 0, w, h }, clockParams, swapParams,
      sec, idx, row, readRowCount(), null
    )
  }

  const stop = makeLoop({ targetFps, draw, tracker, onFrame })

  return {
    dispose() {
      stop()
      ro.disconnect()
    },
    getFps: () => tracker.get()
  }
}

// `cols`/`rows` may be passed as fixed numbers, or omitted in favor of a
// `getGridDims(w, h)` callback that returns a fresh `{cols, rows}` each frame.
// The callback variant lets the layout respond to viewport resizes without
// tearing down the RAF loop.
export function mountClockGrid(canvas, {
  cols,
  rows,
  getGridDims = null,
  getSecondInMinute,
  getActiveIndex = () => -1,
  /** When set, called each frame; if it returns a Set of minute indices (0…cols*rows-1), a small marker is drawn on those cells. */
  getSoldMinuteIndices = null,
  clockParams = DEFAULT_CLOCK_HULL_PARAMS,
  swapParams = DEFAULT_SWAP_PARAMS,
  targetFps = 30,
  onFrame = null
}) {
  const ctx = canvas.getContext('2d')
  const tracker = makeFpsTracker()

  sizeCanvas(canvas)
  const ro = new ResizeObserver(() => sizeCanvas(canvas))
  ro.observe(canvas)

  const resolveDims = (w, h) => {
    if (getGridDims) {
      const d = getGridDims(w, h)
      if (d && d.cols > 0 && d.rows > 0) return d
    }
    return { cols, rows }
  }

  let lastDims = resolveDims(canvas.width, canvas.height)
  const draw = () => {
    const w = canvas.width
    const h = canvas.height
    const sec = getSecondInMinute()
    const active = getActiveIndex()
    lastDims = resolveDims(w, h)
    const { cols: gc, rows: gr } = lastDims
    drawGrid(ctx, w, h, gc, gr, clockParams, swapParams, sec, active, null)
    const sold = getSoldMinuteIndices && getSoldMinuteIndices()
    if (sold && sold.size > 0) {
      drawSoldMinuteMarkers(ctx, w, h, gc, gr, sold)
    }
  }

  const stop = makeLoop({ targetFps, draw, tracker, onFrame })

  return {
    dispose() {
      stop()
      ro.disconnect()
    },
    getFps: () => tracker.get(),
    getDims: () => lastDims
  }
}
