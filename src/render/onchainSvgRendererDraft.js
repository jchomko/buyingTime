// Draft "on-chain style" renderer in JavaScript.
// Goal: validate Solidity viability before writing contracts.
//
// Design constraints mirrored from Solidity:
// - Deterministic outputs from (tokenId, squareIndex, time input)
// - Integer-like fixed-point math (minimal float dependence)
// - String-built SVG output
// - Optional sparse keyframes + interpolation

const FP = 10_000 // fixed-point scale
const VIEWBOX_W = 1024
const VIEWBOX_H = 1024

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function lerpInt(a, b, tFp) {
  // tFp in [0, FP]
  return a + Math.floor(((b - a) * tFp) / FP)
}

function fracMod(v, m) {
  const r = v % m
  return r < 0 ? r + m : r
}

// Tiny deterministic hash/PRNG helpers suitable for Solidity translation.
function hash32(n) {
  let x = n >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d)
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b)
  x ^= x >>> 16
  return x >>> 0
}

function randRange(seed, lo, hiInclusive) {
  const span = hiInclusive - lo + 1
  return lo + (hash32(seed) % span)
}

function squareTraits({ tokenId, squareIndex, cols, rows, totalSquares }) {
  const row = Math.floor(squareIndex / cols)
  const col = squareIndex % cols

  // Base grid coordinates in fixed-point.
  const cellW = Math.floor((VIEWBOX_W * FP) / cols)
  const cellH = Math.floor((VIEWBOX_H * FP) / rows)
  const baseX = col * cellW + Math.floor(cellW / 2)
  const baseY = row * cellH + Math.floor(cellH / 2)

  const seedBase = hash32(tokenId ^ (squareIndex * 0x9e3779b9))
  const ampX = randRange(seedBase ^ 0x11111111, Math.floor(cellW / 20), Math.floor(cellW / 5))
  const ampY = randRange(seedBase ^ 0x22222222, Math.floor(cellH / 20), Math.floor(cellH / 5))
  const phase = randRange(seedBase ^ 0x33333333, 0, FP - 1)
  const speed = randRange(seedBase ^ 0x44444444, 700, 1300) // fp-scaled speed bucket
  const hueOffset = randRange(seedBase ^ 0x55555555, -20, 20)

  return {
    row,
    col,
    baseX,
    baseY,
    ampX,
    ampY,
    phase,
    speed,
    hueOffset,
    totalSquares
  }
}

function triangleWave01(phaseFp) {
  // phaseFp in [0, FP)
  // output in [0, FP], piecewise linear
  if (phaseFp < FP / 2) return Math.floor((phaseFp * 2 * FP) / FP)
  return Math.floor(((FP - phaseFp) * 2 * FP) / FP)
}

function positionAtSecond(traits, secondInMinute) {
  // Build a simple Lissajous-like path from two triangle waves.
  // Uses integer math only and can be ported to Solidity.
  const tFp = Math.floor((secondInMinute * FP) / 60)
  const p1 = fracMod(traits.phase + Math.floor((tFp * traits.speed) / FP), FP)
  const p2 = fracMod(traits.phase + Math.floor((tFp * (traits.speed + 173)) / FP), FP)

  const wx = triangleWave01(p1) // [0..FP]
  const wy = triangleWave01(p2)
  // Center around 0: [-FP/2 .. +FP/2]
  const cx = wx - FP / 2
  const cy = wy - FP / 2

  const x = traits.baseX + Math.floor((traits.ampX * cx) / (FP / 2))
  const y = traits.baseY + Math.floor((traits.ampY * cy) / (FP / 2))
  return { x, y }
}

function precomputeKeyframes(traits, keyframeCount = 12) {
  const frames = []
  for (let i = 0; i < keyframeCount; i++) {
    const sec = (60 * i) / keyframeCount
    const pos = positionAtSecond(traits, sec)
    frames.push(pos)
  }
  return frames
}

function positionFromKeyframes(frames, secondInMinute) {
  const n = frames.length
  if (n < 2) return frames[0] || { x: 0, y: 0 }

  const scaled = (secondInMinute / 60) * n
  const i0 = Math.floor(scaled) % n
  const i1 = (i0 + 1) % n
  const frac = scaled - Math.floor(scaled)
  const tFp = Math.floor(frac * FP)

  return {
    x: lerpInt(frames[i0].x, frames[i1].x, tFp),
    y: lerpInt(frames[i0].y, frames[i1].y, tFp)
  }
}

function rgbForSquare(squareIndex, minuteIndex, hueOffset = 0) {
  // Rainbow-ish deterministic color. Easy to replace with project palette.
  // "phase" walks across squares + active minute.
  const p = fracMod(squareIndex * 7 + minuteIndex * 11 + hueOffset, 360)
  // Piecewise HSV-ish approximation with integer branches.
  const seg = Math.floor(p / 60)
  const t = p % 60
  const up = Math.floor((t * 255) / 60)
  const down = 255 - up

  let r = 0
  let g = 0
  let b = 0
  if (seg === 0) { r = 255; g = up; b = 0 }
  else if (seg === 1) { r = down; g = 255; b = 0 }
  else if (seg === 2) { r = 0; g = 255; b = up }
  else if (seg === 3) { r = 0; g = down; b = 255 }
  else if (seg === 4) { r = up; g = 0; b = 255 }
  else { r = 255; g = 0; b = down }

  return { r, g, b }
}

function rectSizeFp(cols, rows) {
  const cellW = Math.floor((VIEWBOX_W * FP) / cols)
  const cellH = Math.floor((VIEWBOX_H * FP) / rows)
  // Keep visible margins.
  return {
    w: Math.floor(cellW * 0.72),
    h: Math.floor(cellH * 0.72)
  }
}

function singleSquareTraits({ tokenId, squareIndex }) {
  const seedBase = hash32(tokenId ^ (squareIndex * 0x9e3779b9))
  const baseX = Math.floor((VIEWBOX_W * FP) / 2)
  const baseY = Math.floor((VIEWBOX_H * FP) / 2)
  const ampX = randRange(seedBase ^ 0x11111111, Math.floor((VIEWBOX_W * FP) / 14), Math.floor((VIEWBOX_W * FP) / 5))
  const ampY = randRange(seedBase ^ 0x22222222, Math.floor((VIEWBOX_H * FP) / 14), Math.floor((VIEWBOX_H * FP) / 5))
  const phase = randRange(seedBase ^ 0x33333333, 0, FP - 1)
  const speed = randRange(seedBase ^ 0x44444444, 700, 1300)
  const hueOffset = randRange(seedBase ^ 0x55555555, -20, 20)
  return { baseX, baseY, ampX, ampY, phase, speed, hueOffset }
}

function rectSvg({ x, y, w, h, fill }) {
  const xPx = (x - w / 2) / FP
  const yPx = (y - h / 2) / FP
  const wPx = w / FP
  const hPx = h / FP
  return `<rect x="${xPx.toFixed(2)}" y="${yPx.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" rx="${(wPx * 0.12).toFixed(2)}" fill="${fill}" />`
}

// Precomputed keyframe animation variant. Emits animate values for x/y.
function rectAnimatedSvg({ frames, w, h, fill }) {
  const wPx = w / FP
  const hPx = h / FP
  const rx = (wPx * 0.12).toFixed(2)
  const valuesX = frames.map((p) => ((p.x - w / 2) / FP).toFixed(2)).join(';')
  const valuesY = frames.map((p) => ((p.y - h / 2) / FP).toFixed(2)).join(';')
  return `<rect width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" rx="${rx}" fill="${fill}">
  <animate attributeName="x" dur="60s" repeatCount="indefinite" values="${valuesX}" />
  <animate attributeName="y" dur="60s" repeatCount="indefinite" values="${valuesY}" />
</rect>`
}

export function buildOnchainStyleMinuteSvg({
  tokenId = 1,
  minuteIndex = 0,
  secondInMinute = 0,
  cols = 24,
  rows = 60,
  totalSquares = 1440,
  mode = 'compute', // 'compute' | 'precomputed'
  keyframeCount = 12,
  background = '#000000'
} = {}) {
  const safeCols = clampInt(cols, 1, 1440)
  const safeRows = clampInt(rows, 1, 1440)
  const safeTotal = clampInt(totalSquares, 1, safeCols * safeRows)
  const safeMinute = fracMod(minuteIndex, safeTotal)
  const safeSecond = clampInt(secondInMinute, 0, 59.999)
  const size = rectSizeFp(safeCols, safeRows)

  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" width="${VIEWBOX_W}" height="${VIEWBOX_H}" shape-rendering="geometricPrecision">`
  )
  parts.push(`<rect width="100%" height="100%" fill="${background}" />`)

  for (let i = 0; i < safeTotal; i++) {
    const traits = squareTraits({
      tokenId,
      squareIndex: i,
      cols: safeCols,
      rows: safeRows,
      totalSquares: safeTotal
    })
    const { r, g, b } = rgbForSquare(i, safeMinute, traits.hueOffset)
    const fill = `rgb(${r},${g},${b})`

    if (mode === 'precomputed') {
      const frames = precomputeKeyframes(traits, keyframeCount)
      parts.push(rectAnimatedSvg({ frames, w: size.w, h: size.h, fill }))
    } else {
      const p = positionAtSecond(traits, safeSecond)
      parts.push(rectSvg({ x: p.x, y: p.y, w: size.w, h: size.h, fill }))
    }
  }

  // Highlight active minute square with a bright stroke.
  const activeTraits = squareTraits({
    tokenId,
    squareIndex: safeMinute,
    cols: safeCols,
    rows: safeRows,
    totalSquares: safeTotal
  })
  const activePos = mode === 'precomputed'
    ? positionFromKeyframes(precomputeKeyframes(activeTraits, keyframeCount), safeSecond)
    : positionAtSecond(activeTraits, safeSecond)
  const ax = (activePos.x - size.w / 2) / FP
  const ay = (activePos.y - size.h / 2) / FP
  parts.push(
    `<rect x="${ax.toFixed(2)}" y="${ay.toFixed(2)}" width="${(size.w / FP).toFixed(2)}" height="${(size.h / FP).toFixed(2)}" rx="${((size.w / FP) * 0.12).toFixed(2)}" fill="none" stroke="white" stroke-width="1.8" />`
  )

  parts.push('</svg>')
  return parts.join('')
}

export function buildOnchainStylePurchasedGridSvg({
  tokenId = 1,
  minuteIndex = 0,
  secondInMinute = 0,
  cols = 24,
  rows = 60,
  totalSquares = 1440,
  purchasedTokenIds = [],
  mode = 'compute', // 'compute' | 'precomputed'
  keyframeCount = 12,
  background = '#000000',
  showMissing = false,
  missingOpacity = 0.08
} = {}) {
  const safeCols = clampInt(cols, 1, 1440)
  const safeRows = clampInt(rows, 1, 1440)
  const safeTotal = clampInt(totalSquares, 1, safeCols * safeRows)
  const safeMinute = fracMod(minuteIndex, safeTotal)
  const safeSecond = clampInt(secondInMinute, 0, 59.999)
  const size = rectSizeFp(safeCols, safeRows)
  const purchased = new Set(
    (purchasedTokenIds || []).map((v) => fracMod(Number(v) || 0, safeTotal))
  )

  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" width="${VIEWBOX_W}" height="${VIEWBOX_H}" shape-rendering="geometricPrecision">`
  )
  parts.push(`<rect width="100%" height="100%" fill="${background}" />`)

  // Optional low-opacity placeholder layer for missing tokens.
  if (showMissing) {
    const cellW = Math.floor((VIEWBOX_W * FP) / safeCols)
    const cellH = Math.floor((VIEWBOX_H * FP) / safeRows)
    const mw = Math.floor(cellW * 0.66)
    const mh = Math.floor(cellH * 0.66)
    const miss = clampInt(Math.floor(missingOpacity * 255), 0, 255) / 255
    for (let i = 0; i < safeTotal; i++) {
      if (purchased.has(i)) continue
      const tr = squareTraits({
        tokenId,
        squareIndex: i,
        cols: safeCols,
        rows: safeRows,
        totalSquares: safeTotal
      })
      const xPx = (tr.baseX - mw / 2) / FP
      const yPx = (tr.baseY - mh / 2) / FP
      const wPx = mw / FP
      const hPx = mh / FP
      parts.push(
        `<rect x="${xPx.toFixed(2)}" y="${yPx.toFixed(2)}" width="${wPx.toFixed(2)}" height="${hPx.toFixed(2)}" rx="${(wPx * 0.12).toFixed(2)}" fill="rgba(255,255,255,${miss.toFixed(3)})" />`
      )
    }
  }

  for (const i of purchased) {
    const traits = squareTraits({
      tokenId,
      squareIndex: i,
      cols: safeCols,
      rows: safeRows,
      totalSquares: safeTotal
    })
    const { r, g, b } = rgbForSquare(i, safeMinute, traits.hueOffset)
    const fill = `rgb(${r},${g},${b})`

    if (mode === 'precomputed') {
      const frames = precomputeKeyframes(traits, keyframeCount)
      parts.push(rectAnimatedSvg({ frames, w: size.w, h: size.h, fill }))
    } else {
      const p = positionAtSecond(traits, safeSecond)
      parts.push(rectSvg({ x: p.x, y: p.y, w: size.w, h: size.h, fill }))
    }
  }

  // Highlight current minute if that token is purchased.
  if (purchased.has(safeMinute)) {
    const activeTraits = squareTraits({
      tokenId,
      squareIndex: safeMinute,
      cols: safeCols,
      rows: safeRows,
      totalSquares: safeTotal
    })
    const activePos = mode === 'precomputed'
      ? positionFromKeyframes(precomputeKeyframes(activeTraits, keyframeCount), safeSecond)
      : positionAtSecond(activeTraits, safeSecond)
    const ax = (activePos.x - size.w / 2) / FP
    const ay = (activePos.y - size.h / 2) / FP
    parts.push(
      `<rect x="${ax.toFixed(2)}" y="${ay.toFixed(2)}" width="${(size.w / FP).toFixed(2)}" height="${(size.h / FP).toFixed(2)}" rx="${((size.w / FP) * 0.12).toFixed(2)}" fill="none" stroke="white" stroke-width="1.8" />`
    )
  }

  parts.push('</svg>')
  return parts.join('')
}

// Convenience preview function for console/devtools:
// document.body.innerHTML = debugPreviewSvg({ mode: 'precomputed' })
export function debugPreviewSvg(opts = {}) {
  return buildOnchainStyleMinuteSvg({
    tokenId: 42,
    minuteIndex: 517,
    secondInMinute: 27,
    cols: 24,
    rows: 60,
    totalSquares: 1440,
    ...opts
  })
}

export function buildOnchainStyleSingleSquareSvg({
  tokenId = 1,
  minuteIndex = 0,
  secondInMinute = 0,
  mode = 'compute', // 'compute' | 'precomputed'
  keyframeCount = 12,
  background = '#000000'
} = {}) {
  const safeSecond = clampInt(secondInMinute, 0, 59.999)
  const safeIndex = fracMod(minuteIndex, 1440)

  const traits = singleSquareTraits({ tokenId, squareIndex: safeIndex })
  const size = {
    w: Math.floor(VIEWBOX_W * FP * 0.36),
    h: Math.floor(VIEWBOX_H * FP * 0.36)
  }
  const { r, g, b } = rgbForSquare(safeIndex, safeIndex, traits.hueOffset)
  const fill = `rgb(${r},${g},${b})`

  const parts = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" width="${VIEWBOX_W}" height="${VIEWBOX_H}" shape-rendering="geometricPrecision">`
  )
  parts.push(`<rect width="100%" height="100%" fill="${background}" />`)

  if (mode === 'precomputed') {
    const frames = precomputeKeyframes(traits, keyframeCount)
    parts.push(rectAnimatedSvg({ frames, w: size.w, h: size.h, fill }))
  } else {
    const p = positionAtSecond(traits, safeSecond)
    parts.push(rectSvg({ x: p.x, y: p.y, w: size.w, h: size.h, fill }))
  }

  const activePos = mode === 'precomputed'
    ? positionFromKeyframes(precomputeKeyframes(traits, keyframeCount), safeSecond)
    : positionAtSecond(traits, safeSecond)
  const ax = (activePos.x - size.w / 2) / FP
  const ay = (activePos.y - size.h / 2) / FP
  parts.push(
    `<rect x="${ax.toFixed(2)}" y="${ay.toFixed(2)}" width="${(size.w / FP).toFixed(2)}" height="${(size.h / FP).toFixed(2)}" rx="${((size.w / FP) * 0.12).toFixed(2)}" fill="none" stroke="white" stroke-width="2.2" />`
  )

  parts.push('</svg>')
  return parts.join('')
}

export function debugPreviewSingleSquareSvg(opts = {}) {
  return buildOnchainStyleSingleSquareSvg({
    tokenId: 42,
    minuteIndex: 517,
    secondInMinute: 27,
    ...opts
  })
}

