import { pickResponsiveGrid } from './render/clockHullRenderer.js'

export const TOTAL_SQUARES = 1440

export const GRID_BOUNDS = {
  minCols: 12,
  maxCols: 72,
  minRows: 20,
  maxRows: 90
}

export const FALLBACK_DIMS = { cols: 24, rows: 60 }

export function resolveGridDims(w, h) {
  return pickResponsiveGrid({
    viewportW: w,
    viewportH: h,
    totalSquares: TOTAL_SQUARES,
    ...GRID_BOUNDS,
    fallback: FALLBACK_DIMS
  })
}

export function normalizeMinuteIndex(i) {
  const n = Number(i) | 0
  return ((n % TOTAL_SQUARES) + TOTAL_SQUARES) % TOTAL_SQUARES
}

export function formatWorkTime(minuteIndex) {
  const idx = normalizeMinuteIndex(minuteIndex)
  const h = Math.floor(idx / 60)
  const m = idx % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatOwnerDisplay(addressOrUnminted) {
  if (addressOrUnminted == null || addressOrUnminted === '') return ''
  if (addressOrUnminted === 'UNMINTED' || addressOrUnminted === 'Not minted') return 'Not minted'
  const a = String(addressOrUnminted)
  if (a.toLowerCase().endsWith('.eth')) return a
  if (a.length <= 14) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}
