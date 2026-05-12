import { readPurchasedTokenIds } from '../lib/readPurchasedTokenIds.js'
import {
  DEFAULT_CLOCK_HULL_PARAMS,
  DEFAULT_SWAP_PARAMS,
  drawPiece
} from './clockHullRenderer.js'

function n(v, fallback = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : fallback
}

function parseIds(text) {
  if (!text || !text.trim()) return []
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((v) => Number.isFinite(v) && v >= 0)
}

function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
}

function secondNow() {
  const d = new Date()
  return d.getSeconds() + d.getMilliseconds() / 1000
}

function drawSingleSquareCanvas(ctx, canvas, {
  minuteIndex,
  secondInMinute
}) {
  const swapParams = { ...DEFAULT_SWAP_PARAMS, mode: 'y-wave' }
  drawPiece(
    ctx,
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
    DEFAULT_CLOCK_HULL_PARAMS,
    swapParams,
    secondInMinute,
    minuteIndex,
    0,
    60,
    null
  )
}

function drawPurchasedGridCanvas(ctx, canvas, {
  minuteIndex,
  secondInMinute,
  cols,
  rows,
  totalSquares,
  purchasedTokenIds,
  showMissing,
  missingOpacity
}) {
  const swapParams = { ...DEFAULT_SWAP_PARAMS, mode: 'y-wave' }
  const safeCols = Math.max(1, cols | 0)
  const safeRows = Math.max(1, rows | 0)
  const safeTotal = Math.max(1, Math.min(totalSquares | 0, safeCols * safeRows))
  const cellW = canvas.width / safeCols
  const cellH = canvas.height / safeRows
  const purchased = new Set((purchasedTokenIds || []).map((v) => ((v % safeTotal) + safeTotal) % safeTotal))

  // Global backdrop.
  ctx.fillStyle = `rgb(${swapParams.colOut.r},${swapParams.colOut.g},${swapParams.colOut.b})`
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (showMissing) {
    const alpha = Math.max(0, Math.min(1, missingOpacity))
    ctx.fillStyle = `rgba(255,255,255,${alpha})`
    for (let i = 0; i < safeTotal; i++) {
      if (purchased.has(i)) continue
      const row = (i / safeCols) | 0
      const col = i % safeCols
      const x = col * cellW + cellW * 0.16
      const y = row * cellH + cellH * 0.16
      ctx.fillRect(x, y, cellW * 0.68, cellH * 0.68)
    }
  }

  // Draw only purchased token cells.
  for (const i of purchased) {
    const row = (i / safeCols) | 0
    const col = i % safeCols
    drawPiece(
      ctx,
      { x: col * cellW, y: row * cellH, w: cellW, h: cellH },
      DEFAULT_CLOCK_HULL_PARAMS,
      swapParams,
      secondInMinute,
      i,
      row,
      safeRows,
      null
    )
  }

  // Highlight current minute token if purchased.
  const active = ((minuteIndex % safeTotal) + safeTotal) % safeTotal
  if (purchased.has(active)) {
    const row = (active / safeCols) | 0
    const col = active % safeCols
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(1, Math.min(cellW, cellH) * 0.06)
    ctx.strokeRect(col * cellW + 1, row * cellH + 1, cellW - 2, cellH - 2)
  }
}

export function initSingleSquarePage() {
  const els = {
    canvas: document.getElementById('frame'),
    minute: document.getElementById('minute'),
    second: document.getElementById('second'),
    useNow: document.getElementById('useNow'),
    renderBtn: document.getElementById('renderBtn'),
    playBtn: document.getElementById('playBtn'),
    stats: document.getElementById('stats')
  }
  const ctx = els.canvas.getContext('2d')

  let raf = 0
  let playing = false

  function render() {
    const t0 = performance.now()
    sizeCanvas(els.canvas)
    const sec = els.useNow.checked ? secondNow() : n(els.second.value, 0)
    if (els.useNow.checked) els.second.value = sec.toFixed(2)
    drawSingleSquareCanvas(ctx, els.canvas, {
      minuteIndex: n(els.minute.value, 0),
      secondInMinute: sec
    })
    els.stats.textContent = `Canvas: ${els.canvas.width}×${els.canvas.height} | render: ${(performance.now() - t0).toFixed(2)}ms`
  }

  function tick() {
    if (!playing) return
    const sec = (n(els.second.value, 0) + 0.1) % 60
    els.second.value = sec.toFixed(2)
    render()
    raf = requestAnimationFrame(tick)
  }

  function setPlaying(next) {
    playing = next
    els.playBtn.textContent = playing ? 'Pause' : 'Play second'
    cancelAnimationFrame(raf)
    if (playing) raf = requestAnimationFrame(tick)
  }

  new ResizeObserver(render).observe(els.canvas)
  for (const id of ['minute', 'second', 'useNow']) {
    els[id].addEventListener('change', render)
  }
  els.renderBtn.addEventListener('click', render)
  els.playBtn.addEventListener('click', () => setPlaying(!playing))

  render()
}

export function initPurchasedGridPage() {
  const els = {
    canvas: document.getElementById('frame'),
    minute: document.getElementById('minute'),
    second: document.getElementById('second'),
    useNow: document.getElementById('useNow'),
    cols: document.getElementById('cols'),
    rows: document.getElementById('rows'),
    total: document.getElementById('total'),
    showMissing: document.getElementById('showMissing'),
    missingOpacity: document.getElementById('missingOpacity'),
    purchasedIds: document.getElementById('purchasedIds'),
    rpcUrl: document.getElementById('rpcUrl'),
    contractAddress: document.getElementById('contractAddress'),
    soldCount: document.getElementById('soldCount'),
    randomizeBtn: document.getElementById('randomizeBtn'),
    fetchBtn: document.getElementById('fetchBtn'),
    renderBtn: document.getElementById('renderBtn'),
    playBtn: document.getElementById('playBtn'),
    status: document.getElementById('status'),
    stats: document.getElementById('stats')
  }
  const ctx = els.canvas.getContext('2d')

  let raf = 0
  let playing = false

  function purchasedTokenIds() {
    return parseIds(els.purchasedIds.value)
  }

  function render() {
    const t0 = performance.now()
    const ids = purchasedTokenIds()
    sizeCanvas(els.canvas)
    const sec = els.useNow.checked ? secondNow() : n(els.second.value, 0)
    if (els.useNow.checked) els.second.value = sec.toFixed(2)
    drawPurchasedGridCanvas(ctx, els.canvas, {
      minuteIndex: n(els.minute.value, 0),
      secondInMinute: sec,
      cols: n(els.cols.value, 24),
      rows: n(els.rows.value, 60),
      totalSquares: n(els.total.value, 1440),
      purchasedTokenIds: ids,
      showMissing: !!els.showMissing.checked,
      missingOpacity: n(els.missingOpacity.value, 0.08)
    })
    els.stats.textContent =
      `Purchased: ${ids.length} | Canvas: ${els.canvas.width}×${els.canvas.height} | render: ${(performance.now() - t0).toFixed(2)}ms`
  }

  async function fetchFromContract() {
    const rpcUrl = els.rpcUrl.value.trim()
    const contractAddress = els.contractAddress.value.trim()
    if (!rpcUrl || !contractAddress) {
      els.status.textContent = 'Set both RPC URL and contract address first.'
      return
    }
    els.status.textContent = 'Fetching purchased token ids from contract...'
    try {
      const ids = await readPurchasedTokenIds({ rpcUrl, contractAddress })
      els.purchasedIds.value = ids.join(', ')
      els.status.textContent = `Loaded ${ids.length} purchased token ids.`
      render()
    } catch (err) {
      els.status.textContent = `Contract fetch failed: ${err?.message || String(err)}`
    }
  }

  function randomizeUnsold() {
    const total = Math.max(1, n(els.total.value, 1440) | 0)
    const requestedSold = n(els.soldCount.value, Math.floor(total * 0.25)) | 0
    const sold = Math.max(0, Math.min(total, requestedSold))

    // Fisher-Yates shuffle over token IDs, then take `sold`.
    const ids = Array.from({ length: total }, (_, i) => i)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0
      const t = ids[i]
      ids[i] = ids[j]
      ids[j] = t
    }
    const purchased = ids.slice(0, sold).sort((a, b) => a - b)
    els.purchasedIds.value = purchased.join(', ')
    els.status.textContent = `Randomized: ${sold} sold / ${total} total (${total - sold} unsold).`
    render()
  }

  function tick() {
    if (!playing) return
    const sec = (n(els.second.value, 0) + 0.1) % 60
    els.second.value = sec.toFixed(2)
    render()
    raf = requestAnimationFrame(tick)
  }

  function setPlaying(next) {
    playing = next
    els.playBtn.textContent = playing ? 'Pause' : 'Play second'
    cancelAnimationFrame(raf)
    if (playing) raf = requestAnimationFrame(tick)
  }

  for (const id of [
    'minute', 'second', 'useNow', 'cols', 'rows',
    'total', 'showMissing', 'missingOpacity', 'purchasedIds'
  ]) {
    els[id].addEventListener('change', render)
    els[id].addEventListener('input', () => {
      if (id === 'purchasedIds') return
      render()
    })
  }
  els.renderBtn.addEventListener('click', render)
  els.fetchBtn.addEventListener('click', fetchFromContract)
  els.randomizeBtn.addEventListener('click', randomizeUnsold)
  els.playBtn.addEventListener('click', () => setPlaying(!playing))
  new ResizeObserver(render).observe(els.canvas)

  render()
}
