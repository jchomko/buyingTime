import { useEffect, useMemo, useRef, useState } from 'react'
import { mountSingleClock, mountClockGrid } from '../render/clockHullMount.js'
import {
  DEFAULT_SWAP_PARAMS,
  SWAP_CHROMA_LAB_EXPERIMENTAL,
  getMinuteIndexFromDate,
  getSecondInMinuteFromDate
} from '../render/clockHullRenderer.js'
import { FALLBACK_DIMS, TOTAL_SQUARES, resolveGridDims } from '../timeGrid.js'

export function CanvasView({
  mode,
  showFps,
  selectedIndex,
  fadeMode,
  gridLayoutMode,
  waveRippleEnabled,
  /** 'manual' | 'gradient' | 'combo' | 'lab' — lab = manual nudges + SWAP_CHROMA_LAB_EXPERIMENTAL. */
  chromaticNudgeSource,
  getSoldMinuteIndices,
  /** Square mode: click left half → −1, right half → +1 (minute index). */
  onSquareHalfStep,
  onCanvasClick,
  onGridCellClick,
  /** When set, overrides `.live-canvas` cursor (e.g. half-field w/e-resize on piece view). */
  canvasCursor
}) {
  const canvasRef = useRef(null)
  const dimsRef = useRef(FALLBACK_DIMS)
  const [fps, setFps] = useState(0)
  const [dimsLabel, setDimsLabel] = useState(
    `${FALLBACK_DIMS.cols}×${FALLBACK_DIMS.rows}`
  )

  const swapParams = useMemo(() => {
    const base = {
      ...DEFAULT_SWAP_PARAMS,
      mode: 'y-wave',
      swapBehavior: fadeMode,
      waveRippleEnabled
    }
    const src = chromaticNudgeSource || 'manual'
    if (src === 'lab') {
      base.chromaticNudgeSource = 'manual'
      Object.assign(base, SWAP_CHROMA_LAB_EXPERIMENTAL)
    } else {
      base.chromaticNudgeSource = src
      base.innerSpatialChromaticGradient = false
      base.innerSpatialChromaticChasePerMinute = 0
      base.innerAreaLuminanceMod = false
      base.innerHandProximityLightness = false
    }
    if (fadeMode === 'inner-fade') {
      base.outerColor = { r: 255, g: 255, b: 255 }
      base.innerColor = { r: 0, g: 0, b: 0 }
    }
    return base
  }, [fadeMode, waveRippleEnabled, chromaticNudgeSource])

  const resolveLiveDims = (w, h) => {
    if (gridLayoutMode === 'viewport-stretch') return FALLBACK_DIMS
    return resolveGridDims(w, h)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const syncDims = () => {
      const rect = canvas.getBoundingClientRect()
      const d = resolveLiveDims(Math.max(1, rect.width), Math.max(1, rect.height))
      if (d.cols !== dimsRef.current.cols || d.rows !== dimsRef.current.rows) {
        dimsRef.current = d
        setDimsLabel(`${d.cols}×${d.rows}`)
      }
    }
    syncDims()
    const ro = new ResizeObserver(syncDims)
    ro.observe(canvas)

    const getSec = () => getSecondInMinuteFromDate(new Date())
    const getLiveMinuteIndex = () => getMinuteIndexFromDate(new Date(), TOTAL_SQUARES)
    const getMinuteIndex = () =>
      selectedIndex != null ? selectedIndex : getLiveMinuteIndex()
    const getGridRow = () => Math.floor(getMinuteIndex() / dimsRef.current.cols)
    const getGridRowCount = () => dimsRef.current.rows

    let handle
    if (mode === 'square') {
      handle = mountSingleClock(canvas, {
        getMinuteIndex,
        getSecondInMinute: getSec,
        getGridRow,
        gridRowCount: getGridRowCount,
        swapParams,
        targetFps: 60
      })
    } else {
      handle = mountClockGrid(canvas, {
        getGridDims: (w, h) => {
          const d = resolveLiveDims(w, h)
          dimsRef.current = d
          return d
        },
        cols: FALLBACK_DIMS.cols,
        rows: FALLBACK_DIMS.rows,
        getSecondInMinute: getSec,
        getActiveIndex: getMinuteIndex,
        getSoldMinuteIndices,
        swapParams,
        targetFps: 30
      })
    }

    const uiInterval = window.setInterval(() => {
      setFps(handle.getFps())
      if (handle.getDims) {
        const d = handle.getDims()
        if (d.cols !== dimsRef.current.cols || d.rows !== dimsRef.current.rows) {
          dimsRef.current = d
        }
        const label = `${d.cols}×${d.rows}`
        setDimsLabel((prev) => (prev === label ? prev : label))
      }
    }, 500)

    return () => {
      window.clearInterval(uiInterval)
      ro.disconnect()
      handle.dispose()
    }
  }, [mode, selectedIndex, swapParams, gridLayoutMode, getSoldMinuteIndices])

  const handleClick = (e) => {
    if (mode === 'square') {
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const w = Math.max(1, rect.width)
        const rel = e.clientX - rect.left
        const delta = rel < w / 2 ? -1 : 1
        if (onSquareHalfStep) {
          onSquareHalfStep(delta)
          return
        }
      }
      onCanvasClick && onCanvasClick()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const { cols, rows } = dimsRef.current
    const rect = canvas.getBoundingClientRect()
    const xNorm = (e.clientX - rect.left) / rect.width
    const yNorm = (e.clientY - rect.top) / rect.height
    const col = Math.min(cols - 1, Math.max(0, Math.floor(xNorm * cols)))
    const row = Math.min(rows - 1, Math.max(0, Math.floor(yNorm * rows)))
    onGridCellClick && onGridCellClick(row * cols + col)
  }

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        className="live-canvas"
        style={canvasCursor ? { cursor: canvasCursor } : undefined}
        onClick={handleClick}
      />
      {showFps && (
        <div className="fps-readout mono">
          {fps.toFixed(1)} fps · {mode === 'gallery' ? dimsLabel : '1×1'}
        </div>
      )}
    </div>
  )
}
