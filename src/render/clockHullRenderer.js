// Framework-free clock-hull renderer.
// This file is the canonical "on-chain companion" script: no imports, no DOM
// framework dependencies. It renders a single square or an entire grid into a
// 2d canvas. The same code powers the mint site live views and is structured
// to be embeddable verbatim into the NFT contract's animation_url HTML shell.
//
// Coordinate model: every piece is designed inside a virtual 100x100 unit box
// centered at (50,50). Geometry is computed in a centered system (origin at 0)
// and placed at (50,50) with shapeScale. The draw helpers stretch that box to
// whatever pixel bounds the caller supplies (warping the aspect as needed).

export const DEFAULT_CLOCK_HULL_PARAMS = Object.freeze({
  hourLength: 0.9,
  minuteLength: 1.0,
  secondLength: 1.0,
  hourTail: 0.7,
  minuteTail: 0.8,
  secondTail: 0.8,
  handReach: 1.0,
  frameHourReach: 1.9,
  frameMinuteReach: 2.0,
  frameSecondReach: 2.0,
  shapeScale: 1.0,
  handWidth: 1.0,
  includeSecond: true
})

// `mode` is kept for compatibility but y-wave is the only supported schedule.
// Cross-second is derived from canonical row (plus optional edge advance).
// Four independent waypoint lists, one per (shape, destination) pair. Each
// stop is { t, color:{r,g,b} } with t strictly between 0 and 1 and the array
// sorted by t ascending. `t` is the shape's LOCAL progress along its own
// transition: 0 = just left its starting color, 1 = fully arrived at its
// destination.
//   outerWaypointsToInner — outer fill on its way to innerColor (e.g. black
//                           → white) during the ramp-up half of the cycle.
//   outerWaypointsToOuter — outer fill on its way back to outerColor
//                           (white → black) during the ramp-down half.
//   innerWaypointsToOuter — inner hull on its way to outerColor (white →
//                           black). Runs simultaneously with the outer's
//                           ramp-up.
//   innerWaypointsToInner — inner hull on its way to innerColor (black →
//                           white). Runs simultaneously with the outer's
//                           ramp-down.
// Leave any list empty to restore a straight lerp for that shape+direction.
// Optional chromatic "nudge" lists apply additive RGB offsets on top of the
// base transition without replacing it with a full waypoint color. Each nudge:
//   { t, dr, dg, db, width?, strength? }
// where `t` is local progress [0..1], `dr/dg/db` are channel deltas (in RGB
// units), `width` is the half-width of a tent falloff around t (default 0.06),
// and `strength` scales the delta (default 1). Provide direction-specific
// arrays using the same shape/destination naming as waypoints.
// The older `waypointsToInner` / `waypointsToOuter` / `waypoints` fields are
// accepted as fallbacks when a shape-specific list is absent.
export const DEFAULT_SWAP_PARAMS = Object.freeze({
  outerColor: { r: 0, g: 0, b: 0 },
  // outerColor: { r: 230, g: 224, b: 255 },
  // outerColor: { r: 204, g: 40, b: 40 },
  innerColor: { r: 255, g: 255, b: 255 },
  // innerColor: { r: 8, g: 8, b: 12 },
  // innerColor: { r: 14, g: 10, b: 200 },
  // innerColor: { r: 0, g: 0, b: 220 },
  // outerWaypointsToInner: [
  //   { t: 0.5, color: { r: 132, g: 124, b: 120 } }
  // ],
  // outerWaypointsToOuter: [
  //   { t: 0.5, color: { r: 120, g: 124, b: 132 } }
  // ],
  innerWaypointsToOuter: [
    // { t: 0.48, color: { r: 0.655*255, g: 0.627*255, b: 0.608*255 } },
    // { t: 0.52, color: { r: 0.608*255, g: 0.694*255, b: 0.404*255 } },
    // { t: 0.54, color: { r: 0.561*255, g: 0.761*255, b: 0.404*255 } },
    // { t: 0.56, color: { r: 0.616*255, g: 0.400*255, b: 0.365*255 } },
    // { t: 0.45, color: { r: 155, g: 155, b: 160 } },
    // { t: 0.55, color: { r: 155, g: 160, b: 155 } },
    
  ],
  innerWaypointsToInner: [
  //  
    // { t: 0.45, color: { r: 165, g: 160, b: 155 } },
    // { t: 0.55, color: { r: 165, g: 155, b: 155 } },
    // { t: 0.34, color: { r: 171, g: 178, b: 153 } },
    // { t: 0.52, color: { r: 80, g: 127, b: 86 } },
    // { t: 0.64, color: { r: 81, g: 34, b: 22 } },
    // { t: 0.56, color: { r: 0.616*125, g: 0.400*125, b: 0.365*125 } },
  ],

  //black to white
  outerChromaticNudgesToOuter: [
    // { t: 0.65, dr: +0, dg: +3,  db: +12, width: 0.3, strength: 1.0 },
    // { t: 0.70, dr: +0, dg: +18,  db: +6, width: 0.3, strength: 1.0 },
    // { t: 0.75, dr: +8, dg: +10, db: +0, width: 0.3, strength: 1.0 },
    // { t: 0.55, dr: +0, dg: +1, db: +0, width: 0.3, strength: 1.0 }
    { t: 0.50, dr: +5, dg: +0,  db: +0, width: 0.15, strength: 1.0 },
    // { t: 0.54, dr: +3, dg: +8,  db: +0, width: 0.05, strength: 1.0 },
    // { t: 0.52, dr: +1, dg: +4, db: +4, width: 0.05, strength: 1.0 },
    // { t: 0.50, dr: +0, dg: +3, db: +6, width: 0.05, strength: 1.0 },
   
  ],
  
    //outer black to white
   outerChromaticNudgesToInner: [
  //  { t: 0.55, dr: +10, dg: +0, db: +0, width: 0.3, strength: 1.0 }
   ],


  //inner white to black
  innerChromaticNudgesToOuter: [ 
    // { t: 0.8, dr: +0, dg: +4,  db: +12, width: 0.3, strength: 1.0 },
    // { t: 0.6, dr: +0, dg: +8,  db: +8, width: 0.3, strength: 1.0 },
    // { t: 0.3, dr: +12, dg: +10, db: +0, width: 0.3, strength: 1.0 },
    // { t: 0.1, dr: +8, dg: +1, db: +0, width: 0.3, strength: 1.0 }],

    { t: 0.40, dr: +8, dg: +1,  db: +0, width: 0.15, strength: 1.0 },
    { t: 0.42, dr: +3, dg: +8,  db: +0, width: 0.15, strength: 1.0 },
    { t: 0.44, dr: +1, dg: +4, db: +4, width: 0.15, strength: 1.0 },
    { t: 0.46, dr: +0, dg: +3, db: +6, width: 0.15, strength: 1.0 },
    // { t: 0.50, dr: +0, dg: +3, db: +8, width: 0.05, strength: 1.0 }
  ],

    // { t: 0.45, dr: +0, dg: +5,  db: +32, width: 0.1, strength: 1.0 },
    // { t: 0.50, dr: +0, dg: +28,  db: +18, width: 0.1, strength: 1.0 },
    // { t: 0.55, dr: +42, dg: +30, db: +0, width: 0.1, strength: 1.0 },
    // { t: 0.60, dr: +34, dg: +1, db: +0, width: 0.1, strength: 1.0 }],

    //inner black to white 
    innerChromaticNudgesToInner: [
      { t: 0.50, dr: +0, dg: +0,  db: +5, width: 0.15, strength: 1.0 },
   
      // { t: 0.0, dr: +0, dg: +3,  db: +2, width: 0.3, strength: 1.0 },
      // { t: 0.1, dr: +0, dg: +8,  db: +6, width: 0.3, strength: 1.0 },
      // { t: 0.3, dr: +8, dg: +3, db: +0, width: 0.3, strength: 1.0 },
      // { t: 0.6, dr: +6, dg: +1, db: +0, width: 0.3, strength: 1.0 },
      // { t: 0.40, dr: +0, dg: +13,  db: +14, width: 0.1, strength: 1.0 },
      // { t: 0.45, dr: +0, dg: +10,  db: +20, width: 0.1, strength: 1.0 },
      // { t: 0.55, dr: +13, dg: +15, db: +0, width: 0.1, strength: 1.0 },
      // { t: 0.60, dr: +6, dg: +5, db: +0, width: 0.1, strength: 1.0 }
    ],

  swapLead: 1.4,
  swapLag: 8.0,
  // How the two shapes animate during each swap event:
  //   'swap'       — classic. Outer and inner exchange colors: outer ramps
  //                  outerColor → innerColor and back, inner ramps
  //                  innerColor → outerColor and back. Each event is a full
  //                  color exchange.
  //   'inner-fade' — outer stays pinned at outerColor forever (a static
  //                  background). Only the inner shape animates, going
  //                  innerColor → outerColor → innerColor across each cycle,
  //                  so at the peak the inner hulls match the background and
  //                  momentarily "disappear." Pair with outerColor=white and
  //                  innerColor=black (or any steady-hull color) for the
  //                  white-bg / black-hull reveal look.
  // Orthogonal to `mode` — the wave SCHEDULE is y-wave only.
  // still controls when each cell flips; `swapBehavior` controls WHAT the
  // flip looks like.
  swapBehavior: 'inner-fade',
  // Per-cell intensity multiplier applied to the INNER shape only, driven by
  // each clock's minute-hand angle. Cells where the hand points at the
  // "bright pole" render the inner at full color; cells where it points at
  // the "dark pole" get their inner RGB multiplied by (1 - handShadeDepth),
  // pushing the hull toward black. The outer/background is never modulated.
  // 0 disables the effect. Typical range 0.3–0.7. Determined purely by
  // (secondInMinute, minuteIndex), so deterministic for the on-chain port.
  handShadeDepth: 0.0,
  // Axis the shading runs along:
  //   'vertical'   — bright at 12, dark at 6 (cos of the hand turn).
  //   'horizontal' — bright at 3, dark at 9 (sin of the hand turn).
  handShadeAxis: 'vertical',
  // How many full swap cycles fit inside one real minute. 1 = classic (the
  // whole ramp-up / plateau / ramp-down schedule spans 60s, so each cell
  // flips once per minute). 2 = cycle compresses to 30s (each cell flips
  // twice per minute, wave front crosses the grid twice). All crossSecond-
  // valued params (waveTopSecond, waveBottomSecond) are interpreted
  // within [0, 60/swapCyclesPerMinute).
  swapCyclesPerMinute: 3,
  // Optional cycle-specific y-wave overrides. Cycle index is derived from
  // secondInMinute and repeats when this list is shorter than
  // swapCyclesPerMinute. Any omitted field falls back to the global wave*
  // setting below. Useful for per-cycle direction/style changes.
  // Default example:
  //   1) top-down ripple
  //   2) bottom-up ripple
  //   3) uniform (no ripple)
  yWaveCycleParams: [
    { waveTopSecond: 10.0, waveBottomSecond: 18.0, waveRippleEnabled: true },
    { waveTopSecond: 10.0, waveBottomSecond: 18.0, waveRippleEnabled: true },
    { waveTopSecond: 10.0, waveBottomSecond: 18.0, waveRippleEnabled: true  }
  ],
  mode: 'y-wave',
  // When true (default), each cell's swap phase is staggered by canonical
  // row/column (y-wave "ripple"). When false, every cell shares the same
  // cross-second so swap colors move in lockstep — hulls still animate per
  // minuteIndex (hands, etc.). Optional `waveUniformCrossSecond` pins the
  // shared second; otherwise the midpoint of waveTop/Bottom is used.
  waveRippleEnabled: true,
  waveUniformCrossSecond: null,
  waveTopSecond: 10.0,
  waveBottomSecond: 18.0,
  // Shoaling exponent for the y-wave: 1 = linear (original), >1 compresses
  // cells' flip times toward the wave's destination (the row with the later
  // crossSecond), so the wave decelerates as it arrives — like an ocean wave
  // running into shallow water. Typical range 1.5–3.
  waveShoalExponent: 2.0,
  // Horizontal edge advance (seconds): cells in the canonical grid's left/
  // right edge columns flip up to this many seconds BEFORE cells at the
  // row's center, so the wave front bows upward at the edges (diffraction-
  // like). 0 disables the effect. Typical range 0.3–1.2.
  waveEdgeAdvance: 0.6,
  // Falloff exponent shaping how quickly the advance ramps from center (0)
  // to edge (full). 1 = linear, >1 keeps the middle of each row mostly flat
  // and only curves up near the ends. Typical range 1.5–3.
  waveEdgeFalloff: 2.8,
  // Canonical grid dims for the y-wave. The cell's row and column are derived
  // from its minuteIndex against these constants, NOT the live display grid,
  // so the flip timing (shoaling + edge curl) is deterministic per minuteIndex
  // regardless of how the grid is laid out on screen. Must match the canonical
  // layout the on-chain contract uses.
  waveCanonicalCols: 24,
  waveCanonicalRows: 60,
  // Chromatic peak tint source (additive peak in local swap progress space):
  //   'manual' — use the four *ChromaticNudges* lists (default).
  //   'gradient' — ignore those lists; sample `chromaticGradientStops` only along
  //     canonical **row** (Y); pull through one tent (peakT / width).
  //   'combo' — outer always uses manual nudges. Inner uses manual nudges while
  //     the inner shape moves toward **innerColor** (ramp-down half), and gradient
  //     while it moves toward **outerColor** (ramp-up half).
  chromaticNudgeSource: 'manual',
  // Experimental inner spatial gradient + chase + area luminance live in the mint
  // UI "Chroma → Lab" preset (`SWAP_CHROMA_LAB_EXPERIMENTAL`), not these defaults.
  innerSpatialChromaticGradient: false,
  innerSpatialChromaticChasePerMinute: 0,
  innerAreaLuminanceMod: false,
  // Used when `innerAreaLuminanceMod` is on (Lab preset): edge blend toward light/dark.
  innerAreaBlendEdge: 0.14,
  innerAreaLightMultiplier: 1.42,
  innerAreaDarkMultiplier: 0.24,
  // If both set, use this fixed [min,max] area for every minute (legacy / global).
  // Otherwise min/max are derived per minuteIndex from that minute's second sweep.
  innerAreaModelMin: null,
  innerAreaModelMax: null,
  // Lab: inner brightness from minute vs second hand alignment (see SWAP_CHROMA_LAB_EXPERIMENTAL).
  innerHandProximityLightness: false,
  handProximityLightMultiplier: 1.48,
  handProximityDarkMultiplier: 0.26,
  // RGB stops for `chromaticNudgeSource === 'gradient'`, top → bottom on the
  // canonical grid: row 0 uses the first stop, last row the last. Two stops =
  // simple vertical lerp; N stops = piecewise-linear bands down the grid.
  chromaticGradientStops: [
    { r: 1, g: 2, b: 71 },
    { r: 35, g: 104, b: 188 },
    { r: 237, g: 226, b: 113 },
    { r: 209, g: 23, b: 16 }
  ],
  // Center of the chromatic peak in local progress [0,1] (same space as nudge `t`).
  chromaticGradientPeakT: 0.42,
  // Half-width of the triangular falloff around peakT (wider = longer-lived tint).
  chromaticGradientPeakWidth: 0.4,
  // 0 = no pull toward the gradient; 1 = full lerp to gradient at peak center.
  chromaticGradientStrength: 0.82,
  // Global per-token additive RGB nudge, linearly interpolated from token 0
  // to token `chromaticGlobalNudgeMaxIndex` (default 1440). Applied after
  // manual/gradient/combo chroma to give each piece a subtle hue offset.
  chromaticGlobalNudgeStart: { dr: 0, dg: 0, db: 0 },
  chromaticGlobalNudgeEnd: { dr: 0, dg: 0, db: 0 },
  chromaticGlobalNudgeMaxIndex: 1440,
  // Only y-wave parameters are used.
})

// Mint UI "Chroma → Lab" tab: merge into `swapParams` beside `chromaticNudgeSource: 'manual'`.
export const SWAP_CHROMA_LAB_EXPERIMENTAL = Object.freeze({
  innerSpatialChromaticGradient: true,
  innerSpatialChromaticChasePerMinute: 1,
  innerHandProximityLightness: true,
  innerAreaLuminanceMod: false,
  waveRippleEnabled: false
})

const PI = Math.PI
const DEG_TO_RAD = PI / 180
const BASE_RADIUS = 16
const FRAME_HALF = 24
const CYCLE_SECONDS = 60
const CAP_STEPS = 4
const DEBUG_LOG_SWAP_CYCLE = true
let _lastLoggedSwapCycle = null

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v) }
function lerp(a, b, t) { return a + (b - a) * t }
function fract01(x) {
  return x - Math.floor(x)
}

// -------- swap colors --------

// Cross-second schedule for the y-wave mode, derived purely from the cell's
// canonical (col, row) — i.e. from minuteIndex against `waveCanonicalCols/Rows`,
// NOT from the live display grid. Pinning the schedule to the canonical grid
// keeps the animation deterministic per minuteIndex, which is what an on-chain
// renderer (and any stored NFT metadata) needs.
//
// Two shaping terms compose:
//   - Shoaling: a power curve along `yNorm` that decelerates the wave as it
//     reaches its destination (the row with the later crossSecond). Feels
//     like an ocean wave running into a beach.
//   - Edge advance: canonical-edge columns flip up to `waveEdgeAdvance` seconds
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
  const canonCols = swap.waveCanonicalCols > 0 ? swap.waveCanonicalCols | 0 : 24
  const canonRows = swap.waveCanonicalRows > 0 ? swap.waveCanonicalRows | 0 : 60
  const total = canonCols * canonRows
  const idx = (((minuteIndex | 0) % total) + total) % total
  const col = idx % canonCols
  const row = (idx / canonCols) | 0

  const rowSpan = Math.max(1, canonRows - 1)
  const yNorm = clamp(row / rowSpan, 0, 1)
  const shoal = p.waveShoalExponent > 0 ? p.waveShoalExponent : 1
  const T = p.waveTopSecond
  const B = p.waveBottomSecond

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

  const advance = p.waveEdgeAdvance > 0 ? p.waveEdgeAdvance : 0
  if (advance > 0 && canonCols > 1) {
    const cCol = (canonCols - 1) * 0.5
    // d: 0 at canonical-row center → 1 at canonical-row edges.
    const d = cCol > 0 ? Math.abs(col - cCol) / cCol : 0
    const falloff = p.waveEdgeFalloff > 0 ? p.waveEdgeFalloff : 1
    const shaped = falloff === 1 ? d : Math.pow(d, falloff)
    base -= advance * shaped
  }

  return base
}

function getSwapCycleIndex(secondInMinute, swap) {
  const cpm = swap && swap.swapCyclesPerMinute > 0 ? swap.swapCyclesPerMinute : 1
  const cycle = CYCLE_SECONDS / cpm
  const sec = ((secondInMinute % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS
  return Math.floor(sec / cycle) % cpm
}

function resolveCycleWaveParams(secondInMinute, swap) {
  const cycleParams = swap && Array.isArray(swap.yWaveCycleParams) ? swap.yWaveCycleParams : null
  const idx = getSwapCycleIndex(secondInMinute, swap)
  if (DEBUG_LOG_SWAP_CYCLE && _lastLoggedSwapCycle !== idx) {
    const cpm = swap && swap.swapCyclesPerMinute > 0 ? swap.swapCyclesPerMinute : 1
    console.log('[clockHullRenderer] active swap cycle', {
      cycleIndex: idx,
      cycleHuman: idx + 1,
      swapCyclesPerMinute: cpm,
      secondInMinute
    })
    _lastLoggedSwapCycle = idx
  }
  const per = cycleParams && cycleParams.length > 0 ? cycleParams[idx % cycleParams.length] : null
  return {
    waveTopSecond: per && per.waveTopSecond != null ? per.waveTopSecond : swap.waveTopSecond,
    waveBottomSecond: per && per.waveBottomSecond != null ? per.waveBottomSecond : swap.waveBottomSecond,
    waveShoalExponent: per && per.waveShoalExponent != null ? per.waveShoalExponent : swap.waveShoalExponent,
    waveEdgeAdvance: per && per.waveEdgeAdvance != null ? per.waveEdgeAdvance : swap.waveEdgeAdvance,
    waveEdgeFalloff: per && per.waveEdgeFalloff != null ? per.waveEdgeFalloff : swap.waveEdgeFalloff,
    waveRippleEnabled: per && per.waveRippleEnabled != null ? per.waveRippleEnabled : swap.waveRippleEnabled,
    waveUniformCrossSecond: per && per.waveUniformCrossSecond != null ? per.waveUniformCrossSecond : swap.waveUniformCrossSecond
  }
}

// Y-wave staggered timing per cell, unless `swap.waveRippleEnabled === false`.
export function getSwapCrossSecond(minuteIndex, gridRow, gridRowCount, swap, secondInMinute = 0) {
  const p = resolveCycleWaveParams(secondInMinute, swap)
  if (p.waveRippleEnabled === false) {
    const u = p.waveUniformCrossSecond
    if (u != null && Number.isFinite(u)) return u
    const T = p.waveTopSecond != null ? p.waveTopSecond : 10
    const B = p.waveBottomSecond != null ? p.waveBottomSecond : 18
    return (T + B) * 0.5
  }
  return getYWaveSwapSecondWithParams(minuteIndex, swap, p)
}

// Shared scratch for getCrossWindowPhase. Returned by reference; callers must
// consume the fields before issuing another call.
const _phaseOut = { t: 0, direction: 1 }

// Computes { t, direction } for the current second inside one swap cycle:
//   direction = +1 during the ramp-up (outer heading toward innerColor) and
//               during the held-at-1 plateau.
//   direction = -1 during the ramp-down (outer heading back toward outerColor).
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

export function getCrossWindowProgress(secondInMinute, crossSecond, lead, lag, cycleSeconds) {
  return getCrossWindowPhase(secondInMinute, crossSecond, lead, lag, cycleSeconds).t
}

// Helper: resolves `swap.swapCyclesPerMinute` (≥1) into an effective cycle
// length in seconds. Kept as a single call site so the on-chain port has one
// obvious line to mirror.
function resolveSwapCycleSeconds(swap) {
  const cpm = swap && swap.swapCyclesPerMinute > 0 ? swap.swapCyclesPerMinute : 1
  return CYCLE_SECONDS / cpm
}

// Picks one of the four (shape, destination) waypoint lists. Falls back to
// the legacy shape-agnostic `waypointsTo*` fields and finally the flat
// `waypoints` array so older configs still render.
//   shape: 'outer' | 'inner'
//   toInner: true if this shape is heading toward innerColor, false if it's
//            heading toward outerColor.
function selectWaypoints(swap, shape, toInner) {
  if (!swap) return null
  let primary
  if (shape === 'outer') {
    primary = toInner ? swap.outerWaypointsToInner : swap.outerWaypointsToOuter
  } else {
    primary = toInner ? swap.innerWaypointsToInner : swap.innerWaypointsToOuter
  }
  if (primary && primary.length > 0) return primary
  const legacyDir = toInner ? swap.waypointsToInner : swap.waypointsToOuter
  if (legacyDir && legacyDir.length > 0) return legacyDir
  const legacyFlat = swap.waypoints
  if (legacyFlat && legacyFlat.length > 0) return legacyFlat
  return null
}

// Picks one of the four (shape, destination) chromatic-nudge lists.
// Falls back to direction-agnostic legacy lists when present.
function selectChromaticNudges(swap, shape, toInner) {
  if (!swap) return null
  let primary
  if (shape === 'outer') {
    primary = toInner ? swap.outerChromaticNudgesToInner : swap.outerChromaticNudgesToOuter
  } else {
    primary = toInner ? swap.innerChromaticNudgesToInner : swap.innerChromaticNudgesToOuter
  }
  if (primary && primary.length > 0) return primary
  const legacyDir = toInner ? swap.chromaticNudgesToInner : swap.chromaticNudgesToOuter
  if (legacyDir && legacyDir.length > 0) return legacyDir
  const legacyFlat = swap.chromaticNudges
  if (legacyFlat && legacyFlat.length > 0) return legacyFlat
  return null
}

// Samples a piecewise-linear color path that starts at `start`, passes
// through `waypoints` (each { t, color }), and ends at `end`, at local
// progress p in [0,1]. Writes components into the module-level scratch
// object and returns it. The caller MUST read the returned values before
// calling this again because the scratch is reused.
const _sampleOut = { r: 0, g: 0, b: 0 }
function sampleColorPath(start, end, waypoints, p) {
  const pc = p < 0 ? 0 : (p > 1 ? 1 : p)

  if (!waypoints || waypoints.length === 0) {
    _sampleOut.r = start.r + (end.r - start.r) * pc
    _sampleOut.g = start.g + (end.g - start.g) * pc
    _sampleOut.b = start.b + (end.b - start.b) * pc
    return _sampleOut
  }

  // Walk the stops (implicit t=0 start, explicit waypoints, implicit t=1
  // end) and locate the segment containing pc. Short lists (≤4 waypoints)
  // make the linear scan cheaper than allocating a sorted array per call.
  let aT = 0, aR = start.r, aG = start.g, aB = start.b
  let bT = 1, bR = end.r, bG = end.g, bB = end.b
  for (let i = 0; i < waypoints.length; i++) {
    const w = waypoints[i]
    const c = w.color || w
    if (pc <= w.t) {
      bT = w.t; bR = c.r; bG = c.g; bB = c.b
      break
    }
    aT = w.t; aR = c.r; aG = c.g; aB = c.b
  }
  const span = bT - aT
  const f = span > 1e-9 ? (pc - aT) / span : 0
  _sampleOut.r = aR + (bR - aR) * f
  _sampleOut.g = aG + (bG - aG) * f
  _sampleOut.b = aB + (bB - aB) * f
  return _sampleOut
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
    const width = n.width > 0 ? n.width : 0.06
    const dist = Math.abs(pc - center)
    let w = 0
    if (dist < width) {
      w = 1 - dist / width
    } else if (width <= 1e-9 && dist <= 1e-9) {
      w = 1
    }
    if (w <= 0) continue
    const gain = (n.strength != null ? n.strength : 1) * w
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
  const s = swap && swap.chromaticGlobalNudgeStart
  const e = swap && swap.chromaticGlobalNudgeEnd
  if (!s && !e) {
    _tokenNudgeOut.r = base.r
    _tokenNudgeOut.g = base.g
    _tokenNudgeOut.b = base.b
    return _tokenNudgeOut
  }
  const maxIdx = swap && swap.chromaticGlobalNudgeMaxIndex > 0
    ? swap.chromaticGlobalNudgeMaxIndex
    : 1440
  const t = clamp((minuteIndex | 0) / maxIdx, 0, 1)
  const sdr = s && s.dr != null ? s.dr : (s && s.r != null ? s.r : 0)
  const sdg = s && s.dg != null ? s.dg : (s && s.g != null ? s.g : 0)
  const sdb = s && s.db != null ? s.db : (s && s.b != null ? s.b : 0)
  const edr = e && e.dr != null ? e.dr : (e && e.r != null ? e.r : 0)
  const edg = e && e.dg != null ? e.dg : (e && e.g != null ? e.g : 0)
  const edb = e && e.db != null ? e.db : (e && e.b != null ? e.b : 0)
  const dr = lerp(sdr, edr, t)
  const dg = lerp(sdg, edg, t)
  const db = lerp(sdb, edb, t)
  _tokenNudgeOut.r = clamp(base.r + dr, 0, 255)
  _tokenNudgeOut.g = clamp(base.g + dg, 0, 255)
  _tokenNudgeOut.b = clamp(base.b + db, 0, 255)
  return _tokenNudgeOut
}

function rgbFromStop(s) {
  if (!s) return { r: 0, g: 0, b: 0 }
  return { r: s.r | 0, g: s.g | 0, b: s.b | 0 }
}

function lerpRgb(a, b, t) {
  const tt = t < 0 ? 0 : (t > 1 ? 1 : t)
  return {
    r: lerp(a.r, b.r, tt),
    g: lerp(a.g, b.g, tt),
    b: lerp(a.b, b.b, tt)
  }
}

/** Canonical (col, row) for minuteIndex — same indexing as getYWaveSwapSecond. */
export function getCanonicalColRow(minuteIndex, swap) {
  const canonCols = swap && swap.waveCanonicalCols > 0 ? swap.waveCanonicalCols | 0 : 24
  const canonRows = swap && swap.waveCanonicalRows > 0 ? swap.waveCanonicalRows | 0 : 60
  const total = canonCols * canonRows
  const idx = (((minuteIndex | 0) % total) + total) % total
  return {
    col: idx % canonCols,
    row: (idx / canonCols) | 0,
    canonCols,
    canonRows
  }
}

function sampleStops1d(stops, t) {
  const n = stops.length
  if (n === 0) return { r: 0, g: 0, b: 0 }
  if (n === 1) return rgbFromStop(stops[0])
  const tt = clamp(t, 0, 1) * (n - 1)
  const i0 = tt | 0
  const i1 = i0 + 1 < n ? i0 + 1 : n - 1
  const f = tt - i0
  return lerpRgb(rgbFromStop(stops[i0]), rgbFromStop(stops[i1]), f)
}

/**
 * RGB from `swap.chromaticGradientStops` using **canonical row only** (Y):
 * v = row / (rows−1), row 0 = top. Column is ignored.
 */
export function sampleChromaticGradientColor(minuteIndex, swap) {
  const stops = swap && swap.chromaticGradientStops
  if (!stops || stops.length < 2) return { r: 0, g: 0, b: 0 }
  const { row, canonRows } = getCanonicalColRow(minuteIndex, swap)
  const v = canonRows > 1 ? row / (canonRows - 1) : 0
  return sampleStops1d(stops, v)
}

// Pulls base RGB toward the per-cell gradient sample through a single tent in
// local progress (replaces manual chromatic nudges when gradient mode is on).
const _gradPeakOut = { r: 0, g: 0, b: 0 }
function applyGradientChromaticPeak(base, minuteIndex, swap, localP) {
  const stops = swap.chromaticGradientStops
  if (!stops || stops.length < 2) {
    _gradPeakOut.r = base.r
    _gradPeakOut.g = base.g
    _gradPeakOut.b = base.b
    return _gradPeakOut
  }
  const g = sampleChromaticGradientColor(minuteIndex, swap)
  const center = swap.chromaticGradientPeakT != null ? swap.chromaticGradientPeakT : 0.42
  const width = swap.chromaticGradientPeakWidth > 0 ? swap.chromaticGradientPeakWidth : 0.4
  const pc = localP < 0 ? 0 : (localP > 1 ? 1 : localP)
  const dist = Math.abs(pc - center)
  let tent = 0
  if (width > 1e-9 && dist < width) {
    tent = 1 - dist / width
  } else if (width <= 1e-9 && dist <= 1e-9) {
    tent = 1
  }
  const strength = swap.chromaticGradientStrength != null ? swap.chromaticGradientStrength : 1
  const k = clamp(tent * strength, 0, 1)
  _gradPeakOut.r = clamp(lerp(base.r, g.r, k), 0, 255)
  _gradPeakOut.g = clamp(lerp(base.g, g.g, k), 0, 255)
  _gradPeakOut.b = clamp(lerp(base.b, g.b, k), 0, 255)
  return _gradPeakOut
}

/**
 * @param {null|{ shape: 'outer'|'inner', innerTowardOuter?: boolean }} chromaOpts
 *   Required for `chromaticNudgeSource === 'combo'`: inner sets `innerTowardOuter`
 *   true when the inner hull is on its I→O leg (toward outerColor).
 */
function applyChromaticPost(base, minuteIndex, swap, localP, manualNudges, chromaOpts = null) {
  const mode = (swap && swap.chromaticNudgeSource) || 'manual'
  let useGradient = mode === 'gradient'
  if (mode === 'combo' && chromaOpts) {
    if (chromaOpts.shape === 'outer') {
      useGradient = false
    } else if (chromaOpts.shape === 'inner') {
      useGradient = !!chromaOpts.innerTowardOuter
    } else {
      useGradient = false
    }
  }
  const chroma = useGradient
    ? applyGradientChromaticPeak(base, minuteIndex, swap, localP)
    : applyChromaticNudges(base, manualNudges, localP)
  return applyTokenGlobalNudge(chroma, minuteIndex, swap)
}

// Returns { outerR,outerG,outerB, innerR,innerG,innerB } as integers 0..255.
// `minuteIndex` is consulted for y-wave canonical row/column mapping.
//
// Each shape walks its own independently-configured color path:
//   Ramp-up   (direction=+1): outer travels outerColor → innerColor using
//                             outerWaypointsToInner. Simultaneously, inner
//                             travels innerColor → outerColor using
//                             innerWaypointsToOuter.
//   Ramp-down (direction=-1): outer travels innerColor → outerColor using
//                             outerWaypointsToOuter. Simultaneously, inner
//                             travels outerColor → innerColor using
//                             innerWaypointsToInner.
// Each shape's waypoint `t` is its own local progress (0 = just starting,
// 1 = arrived), not the raw phase progress, so the two palettes can be
// authored independently without mirror-math gymnastics.
// Multiplier in [1 - handShadeDepth, 1] keyed off the cell's minute-hand
// direction. `axis === 'horizontal'` pivots the bright/dark poles to 3/9
// o'clock; default 'vertical' keeps them at 12/6. Returns 1 (no effect) when
// handShadeDepth is 0 or unset.
export function getHandShadeFactor(secondInMinute, minuteIndex, swap) {
  const depth = swap && swap.handShadeDepth > 0 ? swap.handShadeDepth : 0
  if (depth <= 0) return 1
  const minutePhase = (((minuteIndex | 0) % 720) + 720) % 720
  const mm = minutePhase % 60
  const minuteTurns = (mm + secondInMinute / 60) / 60
  // `axis` picks which orthogonal component of the hand unit-vector we read.
  // cos(2π·turn) peaks at turn=0 (12 o'clock); sin(2π·turn) peaks at turn=¼
  // (3 o'clock). Both outputs live in [-1, 1].
  const angle = 2 * PI * minuteTurns
  const raw = swap && swap.handShadeAxis === 'horizontal' ? Math.sin(angle) : Math.cos(angle)
  const unit = 0.5 * (1 + raw) // [0, 1]; 1 at the bright pole, 0 at the dark pole.
  return 1 - depth * (1 - unit)
}

// Resolves waypoint lists, chroma lists, and local progress for both shapes.
// Used by computeSwapColors and inner spatial-gradient fill.
function resolveSwapColorBranches(secondInMinute, minuteIndex, gridRow, gridRowCount, swap) {
  const crossSecond = getSwapCrossSecond(minuteIndex, gridRow, gridRowCount, swap, secondInMinute)
  const cycle = resolveSwapCycleSeconds(swap)
  const phase = getCrossWindowPhase(secondInMinute, crossSecond, swap.swapLead, swap.swapLag, cycle)
  const t = phase.t
  const direction = phase.direction
  const O = swap.outerColor
  const I = swap.innerColor

  let outerStart, outerEnd, outerList, outerNudges
  let innerStart, innerEnd, innerList, innerNudges, localP
  if (direction < 0) {
    localP = 1 - t
    outerStart = I; outerEnd = O
    outerList = selectWaypoints(swap, 'outer', false)
    outerNudges = selectChromaticNudges(swap, 'outer', false)
    innerStart = O; innerEnd = I
    innerList = selectWaypoints(swap, 'inner', true)
    innerNudges = selectChromaticNudges(swap, 'inner', true)
  } else {
    localP = t
    outerStart = O; outerEnd = I
    outerList = selectWaypoints(swap, 'outer', true)
    outerNudges = selectChromaticNudges(swap, 'outer', true)
    innerStart = I; innerEnd = O
    innerList = selectWaypoints(swap, 'inner', false)
    innerNudges = selectChromaticNudges(swap, 'inner', false)
  }

  const innerFade = swap.swapBehavior === 'inner-fade'
  const innerTowardOuter = direction >= 0
  const outerChromaOpts = { shape: 'outer' }
  const innerChromaOpts = { shape: 'inner', innerTowardOuter }

  return {
    innerFade,
    localP,
    direction,
    O,
    I,
    outerStart,
    outerEnd,
    outerList,
    outerNudges,
    outerChromaOpts,
    innerStart,
    innerEnd,
    innerList,
    innerNudges,
    innerChromaOpts
  }
}

function innerSpatialChromaticWantsGradient(swap, innerNudges, innerChromaOpts) {
  if (!swap || swap.innerSpatialChromaticGradient === false) return false
  const mode = swap.chromaticNudgeSource || 'manual'
  if (mode === 'gradient') return true
  if (mode === 'combo') return true
  return !!(innerNudges && innerNudges.length)
}

// Each entry: u = position along the hull [0,1], p = local progress for chroma
// (fixed to the nudge / band identity). When chase ≠ 0, u = fract(p + chase) so
// stops slide; color always uses p so peaks do not cross-fade in place.
function buildInnerSpatialGradientStops(swap, innerNudges, chase) {
  const mode = (swap && swap.chromaticNudgeSource) || 'manual'
  const out = []
  const moving = chase !== 0 && chase != null && Number.isFinite(chase)
  const pos = (p) => (moving ? fract01(p + chase) : p)

  out.push({ u: 0, p: 0 })
  if (mode === 'manual' && innerNudges && innerNudges.length) {
    for (let i = 0; i < innerNudges.length; i++) {
      const n = innerNudges[i]
      if (n.t == null) continue
      const p0 = n.t < 0 ? 0 : (n.t > 1 ? 1 : n.t)
      out.push({ u: pos(p0), p: p0 })
    }
  } else {
    for (let s = 1; s < 8; s++) {
      const p0 = s / 8
      out.push({ u: pos(p0), p: p0 })
    }
  }
  out.push({ u: 1, p: 1 })
  out.sort((a, b) => (a.u !== b.u ? a.u - b.u : a.p - b.p))
  return out
}

/**
 * Horizontal linear gradient for the inner hull. Each stop uses a fixed chromatic
 * sample `p` (nudge time / band center); spatial position `u` is `p`, or when
 * chase is active `fract(p + chase)` so stops move along the hull (swap-cycle
 * phase from `innerSpatialChromaticChasePerMinute`).
 * @param minuteIndexForPhase minute index used with gridRow for swap timing (y-wave
 *   row batching passes the row anchor, e.g. r * cols).
 * @param minuteIndexForChroma optional; per-cell index for gradient chroma + hand
 *   shade + hull area (defaults to minuteIndexForPhase).
 */
function createInnerSpatialGradient(
  ctx, x, y, w, h,
  params,
  swap, secondInMinute, minuteIndexForPhase, gridRow, gridRowCount,
  branches,
  minuteIndexForChroma = null
) {
  const b = branches || resolveSwapColorBranches(
    secondInMinute, minuteIndexForPhase, gridRow, gridRowCount, swap
  )
  if (!innerSpatialChromaticWantsGradient(swap, b.innerNudges, b.innerChromaOpts)) return null

  const innerBaseFixed = sampleColorPath(b.innerStart, b.innerEnd, b.innerList, b.localP)
  const miC = minuteIndexForChroma != null ? minuteIndexForChroma : minuteIndexForPhase
  const shade = getHandShadeFactor(secondInMinute, miC, swap)
  const yMid = y + h * 0.5
  const g = ctx.createLinearGradient(x, yMid, x + w, yMid)

  const cpm = swap && swap.innerSpatialChromaticChasePerMinute
  let chase = 0
  if (cpm != null && cpm !== 0 && Number.isFinite(cpm)) {
    const cycleSec = resolveSwapCycleSeconds(swap)
    const secInCycle = ((secondInMinute % cycleSec) + cycleSec) % cycleSec
    chase = fract01((secInCycle / cycleSec) * cpm)
  }

  const stopsArr = buildInnerSpatialGradientStops(swap, b.innerNudges, chase)
  const miHull = minuteIndexForChroma != null ? minuteIndexForChroma : minuteIndexForPhase
  const lumK = getInnerHullLightnessMul(params, secondInMinute, miHull, swap)
  let lastU = -1
  for (let i = 0; i < stopsArr.length; i++) {
    let u = stopsArr[i].u
    if (u <= lastU) u = Math.min(1, lastU + 1e-4)
    lastU = u
    const c = applyChromaticPost(
      innerBaseFixed, miC, swap, stopsArr[i].p, b.innerNudges, b.innerChromaOpts
    )
    const r = clamp(Math.round(c.r * shade * lumK), 0, 255)
    const gg = clamp(Math.round(c.g * shade * lumK), 0, 255)
    const bb = clamp(Math.round(c.b * shade * lumK), 0, 255)
    g.addColorStop(u, `rgb(${r},${gg},${bb})`)
  }
  return g
}

export function computeSwapColors(secondInMinute, minuteIndex, gridRow, gridRowCount, swap, params = null) {
  const b = resolveSwapColorBranches(secondInMinute, minuteIndex, gridRow, gridRowCount, swap)
  const { innerFade, localP, O, I, outerStart, outerEnd, outerList, outerNudges, outerChromaOpts,
    innerStart, innerEnd, innerList, innerNudges, innerChromaOpts } = b

  let oR, oG, oB
  if (innerFade) {
    oR = O.r; oG = O.g; oB = O.b
  } else {
    const outerBase = sampleColorPath(outerStart, outerEnd, outerList, localP)
    const outer = applyChromaticPost(
      outerBase, minuteIndex, swap, localP, outerNudges, outerChromaOpts
    )
    oR = outer.r; oG = outer.g; oB = outer.b
  }
  const innerBase = sampleColorPath(innerStart, innerEnd, innerList, localP)
  const inner = applyChromaticPost(
    innerBase, minuteIndex, swap, localP, innerNudges, innerChromaOpts
  )
  const shade = getHandShadeFactor(secondInMinute, minuteIndex, swap)
  const lumK = params ? getInnerHullLightnessMul(params, secondInMinute, minuteIndex, swap) : 1
  return {
    outerR: oR | 0,
    outerG: oG | 0,
    outerB: oB | 0,
    innerR: clamp(Math.round(inner.r * shade * lumK), 0, 255),
    innerG: clamp(Math.round(inner.g * shade * lumK), 0, 255),
    innerB: clamp(Math.round(inner.b * shade * lumK), 0, 255)
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

function emitHand(k, angleRad, len, tail, frameReach, handRadius, handReach) {
  const dx = Math.cos(angleRad)
  const dy = Math.sin(angleRad)
  const forward = BASE_RADIUS * handReach * len
  const backward = forward * tail
  const ax = -dx * backward
  const ay = -dy * backward
  const bx = dx * forward
  const by = dy * forward
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

// Signed area × 0.5; hull winding from monotone chain is consistent → use abs.
function polygonAreaAbs(n) {
  if (n < 3) return 0
  let s = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    s += _hxs[i] * _hys[j] - _hxs[j] * _hys[i]
  }
  return Math.abs(s) * 0.5
}

// -------- hand angles --------

function computeHandAngles(minuteIndex, secondInMinute, includeSecond) {
  const minutePhase = ((minuteIndex % 720) + 720) % 720
  const hh = (minutePhase / 60) | 0
  const mm = minutePhase % 60
  const s = includeSecond ? secondInMinute : 0
  const hourTurns = (hh + mm / 60 + s / 3600) / 12
  const minuteTurns = (mm + s / 60) / 60
  const secondTurns = s / 60
  return {
    hour: (hourTurns * 360 - 90) * DEG_TO_RAD,
    minute: (minuteTurns * 360 - 90) * DEG_TO_RAD,
    second: (secondTurns * 360 - 90) * DEG_TO_RAD
  }
}

function smallestAngleBetweenDirections(a, b) {
  let d = Math.abs(a - b)
  if (d > PI) d = 2 * PI - d
  return d
}

// Inner RGB multiplier: minute & second hands same direction → light; opposite → dark.
function getInnerHandProximityLightnessMul(params, secondInMinute, minuteIndex, swap) {
  if (!swap || swap.innerHandProximityLightness !== true || !params) return 1
  if (!params.includeSecond) return 1
  const ang = computeHandAngles(minuteIndex, secondInMinute, true)
  const d = smallestAngleBetweenDirections(ang.minute, ang.second)
  const t = clamp(d / PI, 0, 1)
  const lightM =
    swap.handProximityLightMultiplier != null ? swap.handProximityLightMultiplier : 1.48
  const darkM =
    swap.handProximityDarkMultiplier != null ? swap.handProximityDarkMultiplier : 0.26
  return lerp(lightM, darkM, t)
}

// -------- hull building (into _hxs/_hys) --------

function buildHullPoints(params, secondInMinute, minuteIndex) {
  const ang = computeHandAngles(minuteIndex, secondInMinute, params.includeSecond)
  const r = params.handWidth * 0.5
  let k = 0
  k = emitHand(k, ang.hour, params.hourLength, params.hourTail, params.frameHourReach, r, params.handReach)
  k = emitHand(k, ang.minute, params.minuteLength, params.minuteTail, params.frameMinuteReach, r, params.handReach)
  if (params.includeSecond) {
    k = emitHand(k, ang.second, params.secondLength, params.secondTail, params.frameSecondReach, r, params.handReach)
  }
  return computeHull(k)
}

function getHullModelArea(params, secondInMinute, minuteIndex) {
  const n = buildHullPoints(params, secondInMinute, minuteIndex)
  return polygonAreaAbs(n)
}

// Cache: hullParamsKey + minuteIndex → { min, max } model-space area over one minute (s∈[0,60)).
const _minuteHullAreaRange = new Map()
let _hullAreaWarmKey = ''

function hullParamsCacheKey(params) {
  if (!params) return ''
  return [
    params.hourLength,
    params.minuteLength,
    params.secondLength,
    params.hourTail,
    params.minuteTail,
    params.secondTail,
    params.handReach,
    params.frameHourReach,
    params.frameMinuteReach,
    params.frameSecondReach,
    params.shapeScale,
    params.handWidth,
    params.includeSecond
  ].join(',')
}

function ensureMinuteHullAreaRangeCached(params, minuteIndex) {
  const pk = hullParamsCacheKey(params)
  // Hull geometry follows `minuteIndex % 720` in `computeHandAngles`; range is per that phase.
  const phase = (((minuteIndex | 0) % 720) + 720) % 720
  const key = `${pk}|${phase}`
  let b = _minuteHullAreaRange.get(key)
  if (b) return b
  let mn = Infinity
  let mx = -Infinity
  for (let s = 0; s < 60; s++) {
    const a = getHullModelArea(params, s, phase)
    if (a < mn) mn = a
    if (a > mx) mx = a
  }
  if (!(mx > mn + 1e-9)) {
    mn = Math.max(0, mn - 1e-3)
    mx = mn + 1e-3
  }
  b = { min: mn, max: mx }
  _minuteHullAreaRange.set(key, b)
  return b
}

function warmupHullAreaRangeCache(params, minuteCount) {
  if (!params) return
  const pk = hullParamsCacheKey(params)
  const flag = `${pk}|${minuteCount | 0}`
  if (_hullAreaWarmKey === flag) return
  _hullAreaWarmKey = flag
  const n = Math.max(0, Math.min(minuteCount | 0, 1440))
  for (let mi = 0; mi < n; mi++) {
    ensureMinuteHullAreaRangeCached(params, mi)
  }
}

// Multiplier on inner RGB: >1 toward light when hull is tight, <1 toward dark when spread.
// Range is per minuteIndex (that token's own min/max area over the second hand sweep).
// Plateau at 1 in the middle so chromatic / spatial gradient read as today.
function getInnerHullAreaLightnessMul(params, secondInMinute, minuteIndex, swap) {
  if (!swap || swap.innerAreaLuminanceMod === false || !params) return 1
  const A = getHullModelArea(params, secondInMinute, minuteIndex)
  let amin
  let amax
  if (
    swap.innerAreaModelMin != null &&
    swap.innerAreaModelMax != null &&
    swap.innerAreaModelMax > swap.innerAreaModelMin + 1e-9
  ) {
    amin = swap.innerAreaModelMin
    amax = swap.innerAreaModelMax
  } else {
    const b = ensureMinuteHullAreaRangeCached(params, minuteIndex)
    amin = b.min
    amax = b.max
  }
  if (!(amax > amin + 1e-9)) return 1
  const t = clamp((A - amin) / (amax - amin), 0, 1)
  const edge = swap.innerAreaBlendEdge != null ? clamp(swap.innerAreaBlendEdge, 0.02, 0.45) : 0.14
  const lightM = swap.innerAreaLightMultiplier != null ? swap.innerAreaLightMultiplier : 1.42
  const darkM = swap.innerAreaDarkMultiplier != null ? swap.innerAreaDarkMultiplier : 0.24
  if (t < edge) {
    const u = edge > 1e-9 ? t / edge : 1
    return lerp(lightM, 1, u)
  }
  if (t > 1 - edge) {
    const u = edge > 1e-9 ? (t - (1 - edge)) / edge : 1
    return lerp(1, darkM, u)
  }
  return 1
}

function getInnerHullLightnessMul(params, secondInMinute, minuteIndex, swap) {
  if (!swap || !params) return 1
  if (swap.innerHandProximityLightness === true) {
    return getInnerHandProximityLightnessMul(params, secondInMinute, minuteIndex, swap)
  }
  return getInnerHullAreaLightnessMul(params, secondInMinute, minuteIndex, swap)
}

// -------- canvas drawing primitives --------

// Appends one hull subpath to the current ctx path. Does not call fill.
// x,y,w,h are the pixel bounds of the cell this piece draws into.
function appendHullSubpath(ctx, x, y, w, h, params, secondInMinute, minuteIndex) {
  const hullLen = buildHullPoints(params, secondInMinute, minuteIndex)
  if (hullLen < 3) return

  const scale = params.shapeScale
  const cx = x + w * 0.5
  const cy = y + h * 0.5
  const sx = w / 100
  const sy = h / 100

  ctx.moveTo(cx + _hxs[0] * scale * sx, cy + _hys[0] * scale * sy)
  for (let i = 1; i < hullLen; i++) {
    ctx.lineTo(cx + _hxs[i] * scale * sx, cy + _hys[i] * scale * sy)
  }
  ctx.closePath()
}

// Draws a single piece: outer rect + hull.
// Pass `options.skipBackground` to skip the outer fill (e.g. shapes-only overlays).
export function drawPiece(
  ctx, bounds, params, swap, secondInMinute, minuteIndex, gridRow, gridRowCount,
  options = null
) {
  const skipBackground = !!(options && options.skipBackground)
  const c = computeSwapColors(secondInMinute, minuteIndex, gridRow, gridRowCount, swap, params)
  const b = resolveSwapColorBranches(secondInMinute, minuteIndex, gridRow, gridRowCount, swap)

  if (!skipBackground) {
    ctx.fillStyle = `rgb(${c.outerR},${c.outerG},${c.outerB})`
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h)
  }

  const innerGrad = createInnerSpatialGradient(
    ctx, bounds.x, bounds.y, bounds.w, bounds.h,
    params,
    swap, secondInMinute, minuteIndex, gridRow, gridRowCount, b, minuteIndex
  )
  ctx.fillStyle = innerGrad || `rgb(${c.innerR},${c.innerG},${c.innerB})`
  ctx.beginPath()
  appendHullSubpath(ctx, bounds.x, bounds.y, bounds.w, bounds.h, params, secondInMinute, minuteIndex)
  ctx.fill()
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
  const skipBackground = !!(options && options.skipBackground)
  const cellW = canvasW / cols
  const cellH = canvasH / rows

  if (swap && swap.innerAreaLuminanceMod !== false) {
    warmupHullAreaRangeCache(params, Math.min(cols * rows, 1440))
  }

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
      swap.waveEdgeAdvance > 0 ||
      swap.handShadeDepth > 0 ||
      cols !== (swap.waveCanonicalCols | 0) ||
      rows !== (swap.waveCanonicalRows | 0)
    )
  if (swap && yWaveNeedsPerCell) {
    drawGridPerCell(
      ctx, canvasW, canvasH, cols, rows, cellW, cellH,
      params, swap,
      secondInMinute, activeIndex, skipBackground
    )
    return
  }

  for (let r = 0; r < rows; r++) {
    const rowAnchor = r * cols
    const c = computeSwapColors(secondInMinute, rowAnchor, r, rows, swap, params)
    const outerStyle = `rgb(${c.outerR},${c.outerG},${c.outerB})`
    const innerStyle = `rgb(${c.innerR},${c.innerG},${c.innerB})`
    const yTop = r * cellH
    const bRow = resolveSwapColorBranches(secondInMinute, rowAnchor, r, rows, swap)
    const useInnerSpatial = innerSpatialChromaticWantsGradient(swap, bRow.innerNudges, bRow.innerChromaOpts)
    const useAreaMod = swap && swap.innerAreaLuminanceMod !== false

    if (!skipBackground) {
      ctx.fillStyle = outerStyle
      ctx.fillRect(0, yTop, canvasW, cellH)
    }

    if (useInnerSpatial) {
      for (let col = 0; col < cols; col++) {
        const xTop = col * cellW
        const index = rowAnchor + col
        const g = createInnerSpatialGradient(
          ctx, xTop, yTop, cellW, cellH,
          params,
          swap, secondInMinute, rowAnchor, r, rows, bRow, index
        )
        ctx.fillStyle = g || innerStyle
        ctx.beginPath()
        appendHullSubpath(ctx, xTop, yTop, cellW, cellH, params, secondInMinute, index)
        ctx.fill()
      }
    } else if (useAreaMod) {
      for (let col = 0; col < cols; col++) {
        const xTop = col * cellW
        const index = rowAnchor + col
        const ci = computeSwapColors(secondInMinute, index, r, rows, swap, params)
        ctx.fillStyle = `rgb(${ci.innerR},${ci.innerG},${ci.innerB})`
        ctx.beginPath()
        appendHullSubpath(ctx, xTop, yTop, cellW, cellH, params, secondInMinute, index)
        ctx.fill()
      }
    } else {
      ctx.fillStyle = innerStyle
      ctx.beginPath()
      for (let col = 0; col < cols; col++) {
        const index = rowAnchor + col
        appendHullSubpath(ctx, col * cellW, yTop, cellW, cellH, params, secondInMinute, index)
      }
      ctx.fill()
    }
  }

  drawActiveCell(
    ctx, cols, rows, cellW, cellH, params, swap, secondInMinute, activeIndex,
    skipBackground
  )
}

// Per-cell fallback path. Each cell has a distinct cross-second,
// so we can't batch rows. To still minimize fillStyle changes, we draw all
// outer rects in one pass, then all hulls in a second pass, keeping
// the current fillStyle sticky between adjacent cells that happen to share it.
function drawGridPerCell(
  ctx, canvasW, canvasH, cols, rows, cellW, cellH,
  params, swap,
  secondInMinute, activeIndex, skipBackground
) {
  const N = cols * rows
  if (swap && swap.innerAreaLuminanceMod !== false) {
    warmupHullAreaRangeCache(params, Math.min(N, 1440))
  }
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
  if (!skipBackground) {
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

  

  // Pass 2: inner hulls — per-cell spatial gradient when chroma calls for it,
  // otherwise bucket by solid inner RGB (same as y-wave batch path).
  const solidBuckets = new Map()
  for (let i = 0; i < N; i++) {
    const r = (i / cols) | 0
    const col = i % cols
    const xTop = col * cellW
    const yTop = r * cellH
    const b = resolveSwapColorBranches(secondInMinute, i, r, rows, swap)
    const g = createInnerSpatialGradient(
      ctx, xTop, yTop, cellW, cellH,
      params,
      swap, secondInMinute, i, r, rows, b, i
    )
    if (g) {
      ctx.fillStyle = g
      ctx.beginPath()
      appendHullSubpath(ctx, xTop, yTop, cellW, cellH, params, secondInMinute, i)
      ctx.fill()
    } else {
      const key = (innerR[i] << 16) | (innerG[i] << 8) | innerB[i]
      let bucket = solidBuckets.get(key)
      if (!bucket) {
        bucket = []
        solidBuckets.set(key, bucket)
      }
      bucket.push(i)
    }
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
    skipBackground
  )
}

function drawActiveCell(
  ctx, cols, rows, cellW, cellH, params, swap, secondInMinute, activeIndex,
  skipBackground = false
) {
  if (activeIndex < 0 || activeIndex >= cols * rows) return
  const ar = (activeIndex / cols) | 0
  const ac = activeIndex % cols
  const c = computeSwapColors(secondInMinute, activeIndex, ar, rows, swap, params)
  const outerStyle = `rgb(${c.outerR},${c.outerG},${c.outerB})`
  const innerStyle = `rgb(${c.innerR},${c.innerG},${c.innerB})`
  const xTop = ac * cellW
  const yTop = ar * cellH
  const bAct = resolveSwapColorBranches(secondInMinute, activeIndex, ar, rows, swap)
  const innerBgGrad = createInnerSpatialGradient(
    ctx, xTop, yTop, cellW, cellH,
    params,
    swap, secondInMinute, activeIndex, ar, rows, bAct, activeIndex
  )

  // Invert the active cell: paint the cell's inner color as the background,
  // then redraw the hull using the cell's outer color. Background is skipped
  // when the caller only wants the shapes layer.
  if (!skipBackground) {
    ctx.fillStyle = innerBgGrad || innerStyle
    ctx.fillRect(xTop, yTop, cellW, cellH)
  }
  ctx.fillStyle = outerStyle
  ctx.beginPath()
  appendHullSubpath(ctx, xTop, yTop, cellW, cellH, params, secondInMinute, activeIndex)
  ctx.fill()
}

// -------- responsive grid layout --------
// Enumerates every (cols, rows) pair whose product equals totalSquares
// (default 1440 = minutes-per-day) and picks the one whose aspect ratio is
// closest to the viewport's, subject to optional min/max bounds on either axis.
// Aspect distance is measured in log-space so 2:1 and 1:2 are equally far from
// 1:1, avoiding a bias toward wide layouts.
export function pickResponsiveGrid({
  viewportW,
  viewportH,
  totalSquares = 1440,
  minCols = 1,
  maxCols = totalSquares,
  minRows = 1,
  maxRows = totalSquares,
  fallback = { cols: 24, rows: 60 }
} = {}) {
  const w = Math.max(1, viewportW | 0)
  const h = Math.max(1, viewportH | 0)
  const targetLogAspect = Math.log(w / h)

  let best = null
  for (let c = 1; c <= totalSquares; c++) {
    if (totalSquares % c !== 0) continue
    const r = totalSquares / c
    if (c < minCols || c > maxCols) continue
    if (r < minRows || r > maxRows) continue
    const score = Math.abs(Math.log(c / r) - targetLogAspect)
    if (best === null || score < best.score) best = { cols: c, rows: r, score }
  }

  return best ? { cols: best.cols, rows: best.rows } : { cols: fallback.cols, rows: fallback.rows }
}

// -------- time helpers (convenient for both live view and embedded use) --------

export function getMinuteIndexFromDate(date, totalSquares) {
  const daySeconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000
  const progress = daySeconds / (24 * 3600)
  return Math.floor(progress * totalSquares) % totalSquares
}

export function getSecondInMinuteFromDate(date) {
  return date.getSeconds() + date.getMilliseconds() / 1000
}
