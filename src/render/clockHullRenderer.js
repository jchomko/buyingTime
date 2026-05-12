// Framework-free clock-hull renderer.
// This file is the canonical "on-chain companion" script: no imports, no DOM
// framework dependencies. It renders a single square or an entire grid into a
// 2d canvas. The same code powers the mint site live views and is structured
// to be embeddable verbatim into the NFT contract's animation_url HTML shell.
//
// Coordinate model: every piece is designed inside a virtual 100x100 unit box
// centered at (50,50). Geometry is computed in a centered system (origin at 0)
// and placed at (50,50) with shape scale (`scl`). The draw helpers stretch that box to
// whatever pixel bounds the caller supplies (warping the aspect as needed).

export const DEFAULT_CLOCK_HULL_PARAMS = Object.freeze({
  hLen: 0.9,
  mLen: 1.0,
  sLen: 1.0,
  hTail: 0.7,
  mTail: 0.8,
  sTail: 0.8,
  hdReach: 1.0,
  frHr: 1.9,
  frMr: 2.0,
  frSr: 2.0,
  scl: 1.0,
  hdW: 1.0,
  useSec: true
})

// `mode` is kept for compatibility but y-wave is the only supported schedule.
// Cross-second is derived from canonical row (plus optional edge advance).
// Base colors linearly interpolate between colOut and colIn per shape
// and swap phase. Optional chromatic "nudge" lists apply additive RGB offsets
// on top of that base lerp. Each nudge:
//   { t, dr, dg, db, wid?, str? }  (aliases `width` / `strength` still accepted)
// where `t` is local progress [0..1], `dr/dg/db` are channel deltas (in RGB
// units), `wid` is the half-width of a tent falloff around t (default 0.06),
// and `str` scales the delta (default 1). Use direction-specific arrays:
//   nOi / nOo
//   nIi / nIo
// The older `nLegI` / `nLegO` / `nLeg`
// fields are accepted as fallbacks when a shape-specific list is absent.
export const DEFAULT_SWAP_PARAMS = Object.freeze({
  colOut: { r: 0, g: 0, b: 0 },
  // colOut: { r: 230, g: 224, b: 255 },
  // colOut: { r: 204, g: 40, b: 40 },
  colIn: { r: 255, g: 255, b: 255 },
  // colIn: { r: 8, g: 8, b: 12 },
  // colIn: { r: 14, g: 10, b: 200 },
  // colIn: { r: 0, g: 0, b: 220 },

  //black to white
  nOo: [
    // { t: 0.65, dr: +0, dg: +3,  db: +12, width: 0.3, strength: 1.0 },
    // { t: 0.70, dr: +0, dg: +18,  db: +6, width: 0.3, strength: 1.0 },
    // { t: 0.75, dr: +8, dg: +10, db: +0, width: 0.3, strength: 1.0 },
    // { t: 0.55, dr: +0, dg: +1, db: +0, width: 0.3, strength: 1.0 }
    { t: 0.50, dr: +5, dg: +0,  db: +0, wid: 0.05, str: 1.0 },
    // { t: 0.54, dr: +3, dg: +8,  db: +0, width: 0.05, strength: 1.0 },
    // { t: 0.52, dr: +1, dg: +4, db: +4, width: 0.05, strength: 1.0 },
    // { t: 0.50, dr: +0, dg: +3, db: +6, width: 0.05, strength: 1.0 },
   
  ],
  
    //outer black to white
   nOi: [
  //  { t: 0.55, dr: +10, dg: +0, db: +0, width: 0.3, strength: 1.0 }
  // { t: 0.40, dr: +0, dg: +1,  db: +12, width: 0.15, strength: 1.0 },
  // { t: 0.42, dr: +1, dg: +4,  db: +4, width: 0.15, strength: 1.0 },
  // { t: 0.44, dr: +3, dg: +8, db: +0, width: 0.15, strength: 1.0 },
  // { t: 0.46, dr: +12, dg: +1, db: +0, width: 0.15, strength: 1.0 },
   ],


  //inner white to black
  nIo: [ 
    // { t: 0.8, dr: +0, dg: +4,  db: +12, width: 0.3, strength: 1.0 },
    // { t: 0.6, dr: +0, dg: +8,  db: +8, width: 0.3, strength: 1.0 },
    // { t: 0.3, dr: +12, dg: +10, db: +0, width: 0.3, strength: 1.0 },
    // { t: 0.1, dr: +8, dg: +1, db: +0, width: 0.3, strength: 1.0 }],

    { t: 0.40, dr: +8, dg: +1,  db: +0, wid: 0.1, str: 1.0 },
    { t: 0.42, dr: +4, dg: +8,  db: +0, wid: 0.1, str: 1.0 },
    { t: 0.44, dr: +2, dg: +6, db: +6, wid: 0.1, str: 1.0 },
    { t: 0.46, dr: +0, dg: +2, db: +8, wid: 0.1, str: 1.0 },
  ],

    // { t: 0.45, dr: +0, dg: +5,  db: +32, width: 0.1, strength: 1.0 },
    // { t: 0.50, dr: +0, dg: +28,  db: +18, width: 0.1, strength: 1.0 },
    // { t: 0.55, dr: +42, dg: +30, db: +0, width: 0.1, strength: 1.0 },
    // { t: 0.60, dr: +34, dg: +1, db: +0, width: 0.1, strength: 1.0 }],

    //inner black to white 
    nIi: [
      { t: 0.50, dr: +0, dg: +0,  db: +5, wid: 0.15, str: 1.0 },
   
      // { t: 0.0, dr: +0, dg: +3,  db: +2, width: 0.3, strength: 1.0 },
      // { t: 0.1, dr: +0, dg: +8,  db: +6, width: 0.3, strength: 1.0 },
      // { t: 0.3, dr: +8, dg: +3, db: +0, width: 0.3, strength: 1.0 },
      // { t: 0.6, dr: +6, dg: +1, db: +0, width: 0.3, strength: 1.0 },
      // { t: 0.40, dr: +0, dg: +13,  db: +14, width: 0.1, strength: 1.0 },
      // { t: 0.45, dr: +0, dg: +10,  db: +20, width: 0.1, strength: 1.0 },
      // { t: 0.55, dr: +13, dg: +15, db: +0, width: 0.1, strength: 1.0 },
      // { t: 0.60, dr: +6, dg: +5, db: +0, width: 0.1, strength: 1.0 }
    ],

  xLead: 1.4,
  xLag: 8.0,
  //   'swap'       — outer and inner both ramp: background and hull trade roles
  //                  each cycle (classic full swap).
  //   'inner-fade' — outer stays at colOut; only the inner hull animates.
  xBeh: 'swap',
  // How many full swap cycles fit inside one real minute. 1 = classic (the
  // whole ramp-up / plateau / ramp-down schedule spans 60s, so each cell
  // flips once per minute). 2 = cycle compresses to 30s (each cell flips
  // twice per minute, wave front crosses the grid twice). All crossSecond-
  // valued params (wTop, wBot) are interpreted within [0, 60 / cycPm).
  cycPm: 3,
  // Optional cycle-specific y-wave overrides. Cycle index is derived from
  // secondInMinute and repeats when this list is shorter than
  // cycPm. Any omitted field falls back to the global wave*
  // setting below. Useful for per-cycle direction/style changes.
  // Default: one entry reused for every cycle (same as matching global wTop/
  // wBot/wRip).
  ywPrm: [{ wTop: 10.0, wBot: 18.0, wRip: true }],
  mode: 'y-wave',
  // When true (default), each cell's swap phase is staggered by canonical
  // row/column (y-wave "ripple"). When false, every cell shares the same
  // cross-second (the midpoint of waveTop/Bottom) so swap colors move in
  // lockstep — hulls still animate per minuteIndex (hands, etc.).
  wRip: true,
  wTop: 10.0,
  wBot: 18.0,
  // Shoaling exponent for the y-wave: 1 = linear (original), >1 compresses
  // cells' flip times toward the wave's destination (the row with the later
  // crossSecond), so the wave decelerates as it arrives — like an ocean wave
  // running into shallow water. Typical range 1.5–3.
  wShoal: 2.0,
  // Horizontal edge advance (seconds): cells in the canonical grid's left/
  // right edge columns flip up to this many seconds BEFORE cells at the
  // row's center, so the wave front bows upward at the edges (diffraction-
  // like). 0 disables the effect. Typical range 0.3–1.2.
  wAdv: 0.6,
  // Falloff exponent shaping how quickly the advance ramps from center (0)
  // to edge (full). 1 = linear, >1 keeps the middle of each row mostly flat
  // and only curves up near the ends. Typical range 1.5–3.
  wFall: 2.8,
  // Canonical grid dims for the y-wave. The cell's row and column are derived
  // from its minuteIndex against these constants, NOT the live display grid,
  // so the flip timing (shoaling + edge curl) is deterministic per minuteIndex
  // regardless of how the grid is laid out on screen. Must match the canonical
  // layout the on-chain contract uses.
  wCols: 24,
  wRows: 60,
  // Global per-token additive RGB nudge along token id 0 → gNmax (default
  // 1440). With gNm set, lerps start → mid in the first half of that range and
  // mid → end in the second half; without mid, lerps start → end. Applied after
  // chromatic nudges to give each piece a subtle hue offset.
  gNs: { dr: 0, dg: 0, db: 15 },
  gNm: { dr: 0, dg: 0, db: 0 },
  gNe: { dr: 0, dg: 0, db: 15 },
  gNmax: 1440,
  // Only y-wave parameters are used.
})

const PI = Math.PI
const DEG_TO_RAD = PI / 180
const BASE_RADIUS = 16
const FRAME_HALF = 24
const CYCLE_SECONDS = 60
const CAP_STEPS = 4
// const DEBUG_LOG_SWAP_CYCLE = true
// let _lastLoggedSwapCycle = null

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v) }
function lerp(a, b, t) { return a + (b - a) * t }

// -------- swap colors --------

// Cross-second schedule for the y-wave mode, derived purely from the cell's
// canonical (col, row) — i.e. from minuteIndex against `wCols/Rows`,
// NOT from the live display grid. Pinning the schedule to the canonical grid
// keeps the animation deterministic per minuteIndex, which is what an on-chain
// renderer (and any stored NFT metadata) needs.
//
// Two shaping terms compose:
//   - Shoaling: a power curve along `yNorm` that decelerates the wave as it
//     reaches its destination (the row with the later crossSecond). Feels
//     like an ocean wave running into a beach.
//   - Edge advance: canonical-edge columns flip up to `wAdv` seconds
//     before the center of the same row, so the wave front bows upward at the
//     left/right boundaries.
//
// `gridRow`/`gridRowCount` are accepted for signature compatibility but
// deliberately ignored — the canonical row comes from minuteIndex.
export function getYWaveSwapSecond(gridRow, gridRowCount, minuteIndex, swap) {
  const p = resolveCycleWaveParams(0, swap)
  return getYWaveSwapSecondWithParams(minuteIndex, swap, p)
}

function getYWaveSwapSecondWithParams(minuteIndex, swap, p) {
  const canonCols = swap.wCols > 0 ? swap.wCols | 0 : 24
  const canonRows = swap.wRows > 0 ? swap.wRows | 0 : 60
  const total = canonCols * canonRows
  const idx = (((minuteIndex | 0) % total) + total) % total
  const col = idx % canonCols
  const row = (idx / canonCols) | 0

  const rowSpan = Math.max(1, canonRows - 1)
  const yNorm = clamp(row / rowSpan, 0, 1)
  const shoal = p.wShoal > 0 ? p.wShoal : 1
  const T = p.wTop
  const B = p.wBot

  let base
  if (shoal === 1) {
    base = lerp(T, B, yNorm)
  } else {
    // `progress` runs 0 at the wave's origin → 1 at its destination.
    // Pow(progress, shoal) flattens the curve near the origin (fast departure)
    // and steepens it near the destination (slow arrival).
    const topIsDestination = T >= B
    const progress = topIsDestination ? 1 - yNorm : yNorm
    const shaped = Math.pow(progress, shoal)
    base = topIsDestination ? B + shaped * (T - B) : T + shaped * (B - T)
  }

  const advance = p.wAdv > 0 ? p.wAdv : 0
  if (advance > 0 && canonCols > 1) {
    const cCol = (canonCols - 1) / 2
    // d: 0 at canonical-row center → 1 at canonical-row edges.
    const d = cCol > 0 ? Math.abs(col - cCol) / cCol : 0
    const falloff = p.wFall > 0 ? p.wFall : 1
    const shaped = falloff === 1 ? d : Math.pow(d, falloff)
    base -= advance * shaped
  }

  return base
}

function getSwapCycleIndex(secondInMinute, swap) {
  const cpm = swap && swap.cycPm > 0 ? swap.cycPm : 1
  const cycle = CYCLE_SECONDS / cpm
  const sec = ((secondInMinute % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS
  return Math.floor(sec / cycle) % cpm
}

function resolveCycleWaveParams(secondInMinute, swap) {
  const cycleParams = swap && Array.isArray(swap.ywPrm) ? swap.ywPrm : null
  const idx = getSwapCycleIndex(secondInMinute, swap)
  // if (DEBUG_LOG_SWAP_CYCLE && _lastLoggedSwapCycle !== idx) {
    // const cpm = swap && swap.cycPm > 0 ? swap.cycPm : 1
    // console.log('[clockHullRenderer] active swap cycle', {
    //   cycleIndex: idx,
    //   cycleHuman: idx + 1,
    //   cycPm: cpm,
    //   secondInMinute
    // })
    // _lastLoggedSwapCycle = idx
  // }
  const per = cycleParams && cycleParams.length > 0 ? cycleParams[idx % cycleParams.length] : null
  return {
    wTop: per && per.wTop != null ? per.wTop : swap.wTop,
    wBot: per && per.wBot != null ? per.wBot : swap.wBot,
    wShoal: per && per.wShoal != null ? per.wShoal : swap.wShoal,
    wAdv: per && per.wAdv != null ? per.wAdv : swap.wAdv,
    wFall: per && per.wFall != null ? per.wFall : swap.wFall,
    wRip: per && per.wRip != null ? per.wRip : swap.wRip
  }
}

function yWaveUniformCrossSecond(p) {
  const T = p.wTop != null ? p.wTop : 10
  const B = p.wBot != null ? p.wBot : 18
  return 0.5 * (T + B)
}

// Y-wave staggered timing per cell, unless `swap.wRip === false`.
export function getSwapCrossSecond(minuteIndex, gridRow, gridRowCount, swap, secondInMinute = 0) {
  const p = resolveCycleWaveParams(secondInMinute, swap)
  if (p.wRip === false) {
    return yWaveUniformCrossSecond(p)
  }
  return getYWaveSwapSecondWithParams(minuteIndex, swap, p)
}

// Shared scratch for getCrossWindowPhase. Returned by reference; callers must
// consume the fields before issuing another call.
const _phaseOut = { t: 0, direction: 1 }

// Computes { t, direction } for the current second inside one swap cycle:
//   direction = +1 during the ramp-up (outer heading toward colIn) and
//               during the held-at-1 plateau.
//   direction = -1 during the ramp-down (outer heading back toward colOut).
// Callers that only need t can use getCrossWindowProgress below.
// `cycleSeconds` defaults to the full minute (60s), so a single swap event
// per minute. Shorter cycles (e.g. 30s for two cycles per minute) make the
// whole schedule repeat more often — secondInMinute is wrapped into the
// cycle via modulo, so the first and second halves of the minute render
// identically.
export function getCrossWindowPhase(secondInMinute, crossSecond, lead, lag, cycleSeconds) {
  const cycle = cycleSeconds > 0 ? cycleSeconds : CYCLE_SECONDS
  const sec = ((secondInMinute % cycle) + cycle) % cycle
  const leadC = lead < 0 ? 0 : lead
  const lagC = lag < 0 ? 0 : lag
  const rampUpDuration = clamp(leadC + lagC, 0.001, cycle - 0.001)
  const start = crossSecond - leadC
  const secPhase = ((sec - start) % cycle + cycle) % cycle

  if (secPhase < rampUpDuration) {
    _phaseOut.t = secPhase / rampUpDuration
    _phaseOut.direction = 1
    return _phaseOut
  }

  const rampDownStart = Math.max(rampUpDuration, cycle - rampUpDuration)
  if (secPhase < rampDownStart) {
    _phaseOut.t = 1
    _phaseOut.direction = 1
    return _phaseOut
  }

  const rampDownDuration = Math.max(0.001, cycle - rampDownStart)
  const rampDownProgress = (secPhase - rampDownStart) / rampDownDuration
  _phaseOut.t = clamp(1 - rampDownProgress, 0, 1)
  _phaseOut.direction = -1
  return _phaseOut
}

// export function getCrossWindowProgress(secondInMinute, crossSecond, lead, lag, cycleSeconds) {
//   return getCrossWindowPhase(secondInMinute, crossSecond, lead, lag, cycleSeconds).t
// }

// Helper: resolves `swap.cycPm` (≥1) into an effective cycle
// length in seconds. Kept as a single call site so the on-chain port has one
// obvious line to mirror.
function resolveSwapCycleSeconds(swap) {
  const cpm = swap && swap.cycPm > 0 ? swap.cycPm : 1
  return CYCLE_SECONDS / cpm
}

// Picks one of the four (shape, destination) chromatic-nudge lists.
// Falls back to direction-agnostic legacy lists when present.
function selectChromaticNudges(swap, shape, toInner) {
  if (!swap) return null
  let primary
  if (shape === 'outer') {
    primary = toInner ? swap.nOi : swap.nOo
  } else {
    primary = toInner ? swap.nIi : swap.nIo
  }
  if (primary && primary.length > 0) return primary
  const legacyDir = toInner ? swap.nLegI : swap.nLegO
  if (legacyDir && legacyDir.length > 0) return legacyDir
  const legacyFlat = swap.nLeg
  if (legacyFlat && legacyFlat.length > 0) return legacyFlat
  return null
}

// Applies additive RGB nudges near keyframes in local progress space.
// Returns module scratch; caller must consume before next invocation.
const _nudgeOut = { r: 0, g: 0, b: 0 }
function applyChromaticNudges(base, nudges, p) {
  if (!nudges || nudges.length === 0) {
    _nudgeOut.r = base.r
    _nudgeOut.g = base.g
    _nudgeOut.b = base.b
    return _nudgeOut
  }
  const pc = p < 0 ? 0 : (p > 1 ? 1 : p)
  let dr = 0, dg = 0, db = 0
  for (let i = 0; i < nudges.length; i++) {
    const n = nudges[i]
    const center = n.t
    if (center == null) continue
    const wRaw = n.wid != null ? n.wid : n.width
    const width = wRaw > 0 ? wRaw : 0.06
    const dist = Math.abs(pc - center)
    let w = 0
    if (dist < width) {
      w = 1 - dist / width
    } else if (width <= 1e-9 && dist <= 1e-9) {
      w = 1
    }
    if (w <= 0) continue
    const strRaw = n.str != null ? n.str : n.strength
    const gain = (strRaw != null ? strRaw : 1) * w
    const delta = n.delta || n
    dr += gain * (delta.dr != null ? delta.dr : (delta.r != null ? delta.r : 0))
    dg += gain * (delta.dg != null ? delta.dg : (delta.g != null ? delta.g : 0))
    db += gain * (delta.db != null ? delta.db : (delta.b != null ? delta.b : 0))
  }
  _nudgeOut.r = clamp(base.r + dr, 0, 255)
  _nudgeOut.g = clamp(base.g + dg, 0, 255)
  _nudgeOut.b = clamp(base.b + db, 0, 255)
  return _nudgeOut
}

const _tokenNudgeOut = { r: 0, g: 0, b: 0 }
function applyTokenGlobalNudge(base, minuteIndex, swap) {
  const s = swap && swap.gNs
  const m = swap && swap.gNm
  const e = swap && swap.gNe
  if (!s && !m && !e) {
    _tokenNudgeOut.r = base.r
    _tokenNudgeOut.g = base.g
    _tokenNudgeOut.b = base.b
    return _tokenNudgeOut
  }
  const maxIdx = swap && swap.gNmax > 0
    ? swap.gNmax
    : 1440
  const t = clamp((minuteIndex | 0) / maxIdx, 0, 1)
  const sdr = s && s.dr != null ? s.dr : (s && s.r != null ? s.r : 0)
  const sdg = s && s.dg != null ? s.dg : (s && s.g != null ? s.g : 0)
  const sdb = s && s.db != null ? s.db : (s && s.b != null ? s.b : 0)
  const edr = e && e.dr != null ? e.dr : (e && e.r != null ? e.r : 0)
  const edg = e && e.dg != null ? e.dg : (e && e.g != null ? e.g : 0)
  const edb = e && e.db != null ? e.db : (e && e.b != null ? e.b : 0)
  let dr
  let dg
  let db
  if (m) {
    const mdr = m.dr != null ? m.dr : (m.r != null ? m.r : 0)
    const mdg = m.dg != null ? m.dg : (m.g != null ? m.g : 0)
    const mdb = m.db != null ? m.db : (m.b != null ? m.b : 0)
    if (t <= 0.5) {
      const u = t * 2
      dr = lerp(sdr, mdr, u)
      dg = lerp(sdg, mdg, u)
      db = lerp(sdb, mdb, u)
    } else {
      const u = (t - 0.5) * 2
      dr = lerp(mdr, edr, u)
      dg = lerp(mdg, edg, u)
      db = lerp(mdb, edb, u)
    }
  } else {
    dr = lerp(sdr, edr, t)
    dg = lerp(sdg, edg, t)
    db = lerp(sdb, edb, t)
  }
  _tokenNudgeOut.r = clamp(base.r + dr, 0, 255)
  _tokenNudgeOut.g = clamp(base.g + dg, 0, 255)
  _tokenNudgeOut.b = clamp(base.b + db, 0, 255)
  return _tokenNudgeOut
}

function lerpRgb(a, b, t) {
  const tt = t < 0 ? 0 : (t > 1 ? 1 : t)
  return {
    r: lerp(a.r, b.r, tt),
    g: lerp(a.g, b.g, tt),
    b: lerp(a.b, b.b, tt)
  }
}

function applyChromaticPost(base, minuteIndex, swap, localP, manualNudges) {
  const chroma = applyChromaticNudges(base, manualNudges, localP)
  return applyTokenGlobalNudge(chroma, minuteIndex, swap)
}

// Returns { outerR,outerG,outerB, innerR,innerG,innerB } as integers 0..255.
// `minuteIndex` is consulted for y-wave canonical row/column mapping.
//
// In `swap` mode both shapes lerp between their phase endpoints with manual
// chromatic nudges on each leg. In `inner-fade` mode only the inner animates.
// Nudge `t` values are each shape's local progress along its own leg (0→1).

// Local progress and chromatic nudge lists for outer + inner (swap or inner-fade).
function resolveSwapColorLegs(secondInMinute, minuteIndex, gridRow, gridRowCount, swap) {
  const crossSecond = getSwapCrossSecond(minuteIndex, gridRow, gridRowCount, swap, secondInMinute)
  const cycle = resolveSwapCycleSeconds(swap)
  const phase = getCrossWindowPhase(secondInMinute, crossSecond, swap.xLead, swap.xLag, cycle)
  const t = phase.t
  const direction = phase.direction
  const O = swap.colOut
  const I = swap.colIn
  let outerStart, outerEnd, outerNudges
  let innerStart, innerEnd, innerNudges, localP
  if (direction < 0) {
    localP = 1 - t
    outerStart = I; outerEnd = O
    outerNudges = selectChromaticNudges(swap, 'outer', false)
    innerStart = O; innerEnd = I
    innerNudges = selectChromaticNudges(swap, 'inner', true)
  } else {
    localP = t
    outerStart = O; outerEnd = I
    outerNudges = selectChromaticNudges(swap, 'outer', true)
    innerStart = I; innerEnd = O
    innerNudges = selectChromaticNudges(swap, 'inner', false)
  }
  const innerFade = swap && swap.xBeh === 'inner-fade'
  return {
    innerFade,
    O,
    I,
    localP,
    outerStart,
    outerEnd,
    outerNudges,
    innerStart,
    innerEnd,
    innerNudges
  }
}

export function computeSwapColors(secondInMinute, minuteIndex, gridRow, gridRowCount, swap, _params = null) {
  void _params
  const b = resolveSwapColorLegs(secondInMinute, minuteIndex, gridRow, gridRowCount, swap)
  let oR, oG, oB
  if (b.innerFade) {
    oR = b.O.r | 0
    oG = b.O.g | 0
    oB = b.O.b | 0
  } else {
    const outerBase = lerpRgb(b.outerStart, b.outerEnd, b.localP)
    const outer = applyChromaticPost(
      outerBase, minuteIndex, swap, b.localP, b.outerNudges
    )
    oR = outer.r
    oG = outer.g
    oB = outer.b
  }
  const innerBase = lerpRgb(b.innerStart, b.innerEnd, b.localP)
  const inner = applyChromaticPost(
    innerBase, minuteIndex, swap, b.localP, b.innerNudges
  )
  return {
    outerR: oR | 0,
    outerG: oG | 0,
    outerB: oB | 0,
    innerR: clamp(Math.round(inner.r), 0, 255),
    innerG: clamp(Math.round(inner.g), 0, 255),
    innerB: clamp(Math.round(inner.b), 0, 255)
  }
}

// -------- reusable scratch buffers --------
// Sized generously; actual usage is 3 hands * (4 corners + 2*(CAP_STEPS-1) caps + 2 frame pts) = ~36.
const MAX_CANDIDATES = 96
const _pxs = new Float64Array(MAX_CANDIDATES)
const _pys = new Float64Array(MAX_CANDIDATES)
const _hxs = new Float64Array(MAX_CANDIDATES + 1)
const _hys = new Float64Array(MAX_CANDIDATES + 1)
const _sortBuf = [] // reused plain array; sort() is stable/fast over small sizes

// Ripple-mode scratch. Sized lazily; we only realloc if the grid grows larger
// than the last seen cell count.
let _rippleOuterR = null
let _rippleOuterG = null
let _rippleOuterB = null
let _rippleInnerR = null
let _rippleInnerG = null
let _rippleInnerB = null
function ensureRippleBuffers(n) {
  if (_rippleOuterR && _rippleOuterR.length >= n) return
  _rippleOuterR = new Uint8ClampedArray(n)
  _rippleOuterG = new Uint8ClampedArray(n)
  _rippleOuterB = new Uint8ClampedArray(n)
  _rippleInnerR = new Uint8ClampedArray(n)
  _rippleInnerG = new Uint8ClampedArray(n)
  _rippleInnerB = new Uint8ClampedArray(n)
}

// -------- candidate emission --------

function emitCapsule(k, ax, ay, bx, by, radius) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len < 1e-4) return k
  const tx = dx / len
  const ty = dy / len
  const nx = -ty
  const ny = tx

  // Rectangle corners of the capsule (interior side samples are always inside the hull).
  _pxs[k] = ax + nx * radius; _pys[k] = ay + ny * radius; k++
  _pxs[k] = ax - nx * radius; _pys[k] = ay - ny * radius; k++
  _pxs[k] = bx + nx * radius; _pys[k] = by + ny * radius; k++
  _pxs[k] = bx - nx * radius; _pys[k] = by - ny * radius; k++

  // Cap arc at the forward 'b' end.
  for (let i = 1; i < CAP_STEPS; i++) {
    const tt = i / CAP_STEPS
    const theta = PI / 2 - PI * tt
    const cx = Math.cos(theta)
    const cy = Math.sin(theta)
    _pxs[k] = bx + nx * radius * cx + tx * radius * cy
    _pys[k] = by + ny * radius * cx + ty * radius * cy
    k++
  }
  // Cap arc at the backward 'a' end.
  for (let i = 1; i < CAP_STEPS; i++) {
    const tt = i / CAP_STEPS
    const theta = -PI / 2 + PI * tt
    const cx = Math.cos(theta)
    const cy = Math.sin(theta)
    _pxs[k] = ax - nx * radius * cx - tx * radius * cy
    _pys[k] = ay - ny * radius * cx - ty * radius * cy
    k++
  }
  return k
}

/** Centerline of one hand capsule (same math as `emitHand` / hull construction). */
function handCapsuleCenterline(angleRad, len, tail, hdReach) {
  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  const forward = BASE_RADIUS * hdReach * len
  const backward = forward * tail
  return {
    ax: -dx * backward,
    ay: -dy * backward,
    bx: dx * forward,
    by: dy * forward
  }
}

function emitHand(k, angleRad, len, tail, frameReach, handRadius, hdReach) {
  const { ax, ay, bx, by } = handCapsuleCenterline(angleRad, len, tail, hdReach)
  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  k = emitCapsule(k, ax, ay, bx, by, handRadius)

  // Frame-reach extension points keep the hull anchored at the piece boundary
  // even when all hands point the same direction.
  const absMax = Math.max(Math.abs(dx), Math.abs(dy), 1e-4)
  const frameScale = FRAME_HALF * frameReach / absMax
  _pxs[k] = dx * frameScale; _pys[k] = dy * frameScale; k++
  _pxs[k] = -dx * frameScale * tail; _pys[k] = -dy * frameScale * tail; k++
  return k
}

// -------- convex hull (Andrew's monotone chain, in-place on scratch) --------

function cross2(ox, oy, ax, ay, bx, by) {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox)
}

function computeHull(n) {
  if (n < 3) {
    for (let i = 0; i < n; i++) { _hxs[i] = _pxs[i]; _hys[i] = _pys[i] }
    return n
  }

  _sortBuf.length = n
  for (let i = 0; i < n; i++) _sortBuf[i] = i
  _sortBuf.sort((a, b) => {
    const ax = _pxs[a]
    const bx = _pxs[b]
    if (ax !== bx) return ax - bx
    return _pys[a] - _pys[b]
  })

  let k = 0
  // lower hull
  for (let i = 0; i < n; i++) {
    const id = _sortBuf[i]
    const x = _pxs[id]
    const y = _pys[id]
    while (k >= 2 && cross2(_hxs[k - 2], _hys[k - 2], _hxs[k - 1], _hys[k - 1], x, y) <= 0) k--
    _hxs[k] = x; _hys[k] = y; k++
  }
  const lowerSize = k + 1
  // upper hull
  for (let i = n - 2; i >= 0; i--) {
    const id = _sortBuf[i]
    const x = _pxs[id]
    const y = _pys[id]
    while (k >= lowerSize && cross2(_hxs[k - 2], _hys[k - 2], _hxs[k - 1], _hys[k - 1], x, y) <= 0) k--
    _hxs[k] = x; _hys[k] = y; k++
  }
  return k - 1
}

// -------- hand angles --------
// `minuteIndex` is interpreted mod 720 as a 12h clock face (hour = floor(phase/60),
// minute = phase % 60); `secondInMinute` adds smooth motion for hands when `useSec`.

function computeHandAngles(minuteIndex, secondInMinute, useSec) {
  const minutePhase = ((minuteIndex % 720) + 720) % 720
  const hh = (minutePhase / 60) | 0
  const mm = minutePhase % 60
  const s = useSec ? secondInMinute : 0
  const hourTurns = (hh + mm / 60 + s / 3600) / 12
  const minuteTurns = (mm + s / 60) / 60
  const secondTurns = s / 60
  return {
    hour: (hourTurns * 360 - 90) * DEG_TO_RAD,
    minute: (minuteTurns * 360 - 90) * DEG_TO_RAD,
    second: (secondTurns * 360 - 90) * DEG_TO_RAD
  }
}

// -------- hull building (into _hxs/_hys) --------

function buildHullPoints(params, secondInMinute, minuteIndex) {
  const ang = computeHandAngles(minuteIndex, secondInMinute, params.useSec)
  const r = params.hdW / 2
  let k = 0
  k = emitHand(k, ang.hour, params.hLen, params.hTail, params.frHr, r, params.hdReach)
  k = emitHand(k, ang.minute, params.mLen, params.mTail, params.frMr, r, params.hdReach)
  if (params.useSec) {
    k = emitHand(k, ang.second, params.sLen, params.sTail, params.frSr, r, params.hdReach)
  }
  return computeHull(k)
}

// -------- canvas drawing primitives --------

// Appends one hull subpath to the current ctx path. Does not call fill.
// x,y,w,h are the pixel bounds of the cell this piece draws into.
function appendHullSubpath(ctx, x, y, w, h, params, secondInMinute, minuteIndex) {
  const hullLen = buildHullPoints(params, secondInMinute, minuteIndex)
  if (hullLen < 3) return

  const scale = params.scl
  const cx = x + w / 2
  const cy = y + h / 2
  const sx = w / 100
  const sy = h / 100

  ctx.moveTo(cx + _hxs[0] * scale * sx, cy + _hys[0] * scale * sy)
  for (let i = 1; i < hullLen; i++) {
    ctx.lineTo(cx + _hxs[i] * scale * sx, cy + _hys[i] * scale * sy)
  }
  ctx.closePath()
}

// Draws a single piece: outer rect + hull.
// Pass `options.skipBg` to skip the outer fill (e.g. shapes-only overlays).
export function drawPiece(
  ctx, bounds, params, swap, secondInMinute, minuteIndex, gridRow, gridRowCount,
  options = null
) {
  const skipBg = !!(options && (options.skipBg || options.skipBackground))
  const c = computeSwapColors(secondInMinute, minuteIndex, gridRow, gridRowCount, swap, params)

  if (!skipBg) {
    ctx.fillStyle = `rgb(${c.outerR},${c.outerG},${c.outerB})`
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)
  }

  ctx.fillStyle = `rgb(${c.innerR},${c.innerG},${c.innerB})`
  ctx.beginPath()
  appendHullSubpath(ctx, bounds.x, bounds.y, bounds.w, bounds.h, params, secondInMinute, minuteIndex)
  ctx.fill()
}

/**
 * Highlights the three hand centerlines used to build the hull (hour, minute,
 * second), using `computeHandAngles` and `handCapsuleCenterline` — same
 * geometry as `emitHand` / `buildHullPoints`, not a separate analog clock.
 *
 * Mint-site only: not imported by embed-day-preview / unified-clock-shell, so
 * esbuild drops this export from those inline bundles.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }} bounds  Cell in canvas pixels
 * @param {object} params  Same clock hull params as `drawPiece` (e.g. `DEFAULT_CLOCK_HULL_PARAMS`).
 * @param {object} swap  Same swap / wave params as `drawPiece` (drives outer “background” rgb).
 * @param {number} secondInMinute  Same as `drawPiece`.
 * @param {number} minuteIndex  Same as `drawPiece`.
 * @param {number} gridRow  Row index for `computeSwapColors`, same as `drawPiece`.
 * @param {number} gridRowCount  Row count for `computeSwapColors`, same as `drawPiece`.
 */
export function drawPieceHandSpines(
  ctx, bounds, params, swap, secondInMinute, minuteIndex, gridRow, gridRowCount
) {
  const ang = computeHandAngles(minuteIndex, secondInMinute, params.useSec)
  const hd = params.hdReach
  const bg = computeSwapColors(secondInMinute, minuteIndex, gridRow, gridRowCount, swap, params)
  const handColor = `rgba(${bg.outerR},${bg.outerG},${bg.outerB},0.94)`
  const hands = [
    { seg: handCapsuleCenterline(ang.hour, params.hLen*0.9, 0.1, hd), color: handColor },
    { seg: handCapsuleCenterline(ang.minute, params.mLen*1.3, 0.1, hd), color: handColor }
  ]
  if (params.useSec) {
    hands.push({
      seg: handCapsuleCenterline(ang.second, params.sLen*2.1, 0.1, hd),
      color: handColor
    })
  }

  const scale = params.scl
  const cx = bounds.x + bounds.w / 2
  const cy = bounds.y + bounds.h / 2
  const sx = bounds.w / 100
  const sy = bounds.h / 100
  const toPix = (lx, ly) => [cx + lx * scale * sx, cy + ly * scale * sy]

  const lw = Math.max(1.25, Math.min(bounds.w, bounds.h) * 0.009)

  ctx.save()
  ctx.lineCap = 'square'
  ctx.lineJoin = 'round'

  const strokeSeg = (seg, style, width) => {
    const [x0, y0] = toPix(seg.ax, seg.ay)
    const [x1, y1] = toPix(seg.bx, seg.by)
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }

  for (let i = 0; i < hands.length; i++) {
    strokeSeg(hands[i].seg, 'rgba(6, 8, 14, 0)', lw + 0.2)
  }
  for (let i = 0; i < hands.length; i++) {
    strokeSeg(hands[i].seg, hands[i].color, lw)
  }

  ctx.restore()
}

// Grid renderer. Two code paths:
//   y-wave (default): all cells in a row share the same (outer, inner)
//     colors, so we paint the whole row as one fillRect and union all inner
//     hull subpaths into a single fill call. ~120 draw calls/frame for a 24x60.
//   per-cell fallback: each cell has its own canonical y-wave timing in live
//     layouts that don't match canonical dims (or with edge advance on), so we paint one
//     fillRect per cell. Hulls are still grouped by color key to minimize
//     fillStyle swaps.
export function drawGrid(
  ctx,
  canvasW,
  canvasH,
  cols,
  rows,
  params,
  swap,
  secondInMinute,
  activeIndex = -1,
  options = null
) {
  const skipBg = !!(options && (options.skipBg || options.skipBackground))
  const cellW = canvasW / cols
  const cellH = canvasH / rows

  // Y-wave timing is derived from the canonical (col, row) of each cell's
  // minuteIndex, so any cell in a live row can land on a different canonical
  // row when live dims ≠ canonical dims — and any cell can pick up an edge-
  // curl offset from its canonical column. Both cases break per-row batching,
  // so we fall through to the per-cell path whenever:
  //   - y-wave has an edge curl on, OR
  //   - the live grid's dims don't match the canonical y-wave grid.
  const yWaveNeedsPerCell =
    swap &&
    (
      swap.wAdv > 0 ||
      cols !== (swap.wCols | 0) ||
      rows !== (swap.wRows | 0)
    )
  if (swap && yWaveNeedsPerCell) {
    drawGridPerCell(
      ctx, canvasW, canvasH, cols, rows, cellW, cellH,
      params, swap,
      secondInMinute, activeIndex, skipBg
    )
    return
  }

  for (let r = 0; r < rows; r++) {
    const rowAnchor = r * cols
    const c = computeSwapColors(secondInMinute, rowAnchor, r, rows, swap, params)
    const outerStyle = `rgb(${c.outerR},${c.outerG},${c.outerB})`
    const innerStyle = `rgb(${c.innerR},${c.innerG},${c.innerB})`
    const yTop = r * cellH

    if (!skipBg) {
      ctx.fillStyle = outerStyle
      ctx.fillRect(0, yTop, canvasW, cellH)
    }

    ctx.fillStyle = innerStyle
    ctx.beginPath()
    for (let col = 0; col < cols; col++) {
      const index = rowAnchor + col
      appendHullSubpath(ctx, col * cellW, yTop, cellW, cellH, params, secondInMinute, index)
    }
    ctx.fill()
  }

  drawActiveCell(
    ctx, cols, rows, cellW, cellH, params, swap, secondInMinute, activeIndex,
    skipBg
  )
}

// Per-cell fallback path. Each cell has a distinct cross-second,
// so we can't batch rows. To still minimize fillStyle changes, we draw all
// outer rects in one pass, then all hulls in a second pass, keeping
// the current fillStyle sticky between adjacent cells that happen to share it.
function drawGridPerCell(
  ctx, canvasW, canvasH, cols, rows, cellW, cellH,
  params, swap,
  secondInMinute, activeIndex, skipBg
) {
  const N = cols * rows
  ensureRippleBuffers(N)
  const outerR = _rippleOuterR
  const outerG = _rippleOuterG
  const outerB = _rippleOuterB
  const innerR = _rippleInnerR
  const innerG = _rippleInnerG
  const innerB = _rippleInnerB

  for (let i = 0; i < N; i++) {
    const r = (i / cols) | 0
    const c = computeSwapColors(secondInMinute, i, r, rows, swap, params)
    outerR[i] = c.outerR; outerG[i] = c.outerG; outerB[i] = c.outerB
    innerR[i] = c.innerR; innerG[i] = c.innerG; innerB[i] = c.innerB
  }

  // Pass 1: outer fills. We hold fillStyle between identical
  // colors by tracking the last-emitted RGB. Skipped when the caller only
  // wants the shapes layer.
  if (!skipBg) {
    let lastR = -1, lastG = -1, lastB = -1
    for (let r = 0; r < rows; r++) {
      const yTop = r * cellH
      for (let col = 0; col < cols; col++) {
        const i = r * cols + col
        const xTop = col * cellW
        const oR = outerR[i], oG = outerG[i], oB = outerB[i]
        if (oR !== lastR || oG !== lastG || oB !== lastB) {
          ctx.fillStyle = `rgb(${oR},${oG},${oB})`
          lastR = oR; lastG = oG; lastB = oB
        }
        ctx.fillRect(xTop, yTop, cellW, cellH)
      }
    }
  }

  

  // Pass 2: inner hulls — bucket by solid inner RGB (same as y-wave batch path).
  const solidBuckets = new Map()
  for (let i = 0; i < N; i++) {
    const key = (innerR[i] << 16) | (innerG[i] << 8) | innerB[i]
    let bucket = solidBuckets.get(key)
    if (!bucket) {
      bucket = []
      solidBuckets.set(key, bucket)
    }
    bucket.push(i)
  }

  for (const [key, indices] of solidBuckets) {
    const bR = (key >> 16) & 0xff
    const bG = (key >> 8) & 0xff
    const bB = key & 0xff
    ctx.fillStyle = `rgb(${bR},${bG},${bB})`
    ctx.beginPath()
    for (let j = 0; j < indices.length; j++) {
      const i = indices[j]
      const col = i % cols
      const r = (i / cols) | 0
      appendHullSubpath(ctx, col * cellW, r * cellH, cellW, cellH, params, secondInMinute, i)
    }
    ctx.fill()
  }

  drawActiveCell(
    ctx, cols, rows, cellW, cellH, params, swap, secondInMinute, activeIndex,
    skipBg
  )
}

function drawActiveCell(
  ctx, cols, rows, cellW, cellH, params, swap, secondInMinute, activeIndex,
  skipBg = false
) {
  if (activeIndex < 0 || activeIndex >= cols * rows) return
  const ar = (activeIndex / cols) | 0
  const ac = activeIndex % cols
  const c = computeSwapColors(secondInMinute, activeIndex, ar, rows, swap, params)
  const outerStyle = `rgb(${c.outerR},${c.outerG},${c.outerB})`
  const innerStyle = `rgb(${c.innerR},${c.innerG},${c.innerB})`
  const xTop = ac * cellW
  const yTop = ar * cellH

  // Invert the active cell: paint the cell's inner color as the background,
  // then redraw the hull using the cell's outer color. Background is skipped
  // when the caller only wants the shapes layer.
  if (!skipBg) {
    ctx.fillStyle = innerStyle
    ctx.fillRect(xTop, yTop, cellW, cellH)
  }
  ctx.fillStyle = outerStyle
  ctx.beginPath()
  appendHullSubpath(ctx, xTop, yTop, cellW, cellH, params, secondInMinute, activeIndex)
  ctx.fill()
}

// -------- responsive grid layout --------
// Enumerates every (cols, rows) pair whose product equals totSq
// (default 1440 = minutes-per-day) and picks the one whose aspect ratio is
// closest to the viewport's, subject to optional min/max bounds on either axis.
// Aspect distance is measured in log-space so 2:1 and 1:2 are equally far from
// 1:1, avoiding a bias toward wide layouts.
export function pickResponsiveGrid({
  vw,
  vh,
  totSq = 1440,
  minC = 1,
  maxC = totSq,
  minR = 1,
  maxR = totSq,
  fallback = { cols: 24, rows: 60 }
} = {}) {
  const w = Math.max(1, vw | 0)
  const h = Math.max(1, vh | 0)
  const targetLogAspect = Math.log(w / h)

  let best = null
  for (let c = 1; c <= totSq; c++) {
    if (totSq % c !== 0) continue
    const r = totSq / c
    if (c < minC || c > maxC) continue
    if (r < minR || r > maxR) continue
    const score = Math.abs(Math.log(c / r) - targetLogAspect)
    if (best === null || score < best.score) best = { cols: c, rows: r, score }
  }

  return best ? { cols: best.cols, rows: best.rows } : { cols: fallback.cols, rows: fallback.rows }
}

// -------- time helpers (convenient for both live view and embedded use) --------

export function getMinuteIndexFromDate(date, totSq) {
  const daySeconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000
  const progress = daySeconds / (24 * 3600)
  return Math.floor(progress * totSq) % totSq
}

export function getSecondInMinuteFromDate(date) {
  return date.getSeconds() + date.getMilliseconds() / 1000
}
