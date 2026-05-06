import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ViewerBrand } from '../components/ViewerBrand.jsx'
import { readTokenOwner } from '../lib/readPurchasedTokenIds.js'
import { useWallet } from '../context/useWallet.js'
import { getMinuteIndexFromDate } from '../render/clockHullRenderer.js'
import { CanvasView } from '../viewer/CanvasView.jsx'
import {
  TOTAL_SQUARES,
  formatOwnerDisplay,
  formatWorkTime,
  normalizeMinuteIndex
} from '../timeGrid.js'

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

const PIECE_MINUTE_KEY = 'pieceSelectedMinute'
const INFO_THEME_KEY = 'pieceInfoTheme'

function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`
}

function luminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function sampleCanvasTheme(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const { width, height } = canvas
  if (width <= 0 || height <= 0) return null

  const stepX = Math.max(1, Math.floor(width / 24))
  const stepY = Math.max(1, Math.floor(height / 24))
  let darkest = { r: 0, g: 0, b: 0 }
  let lightest = { r: 255, g: 255, b: 255 }
  let darkestL = Number.POSITIVE_INFINITY
  let lightestL = Number.NEGATIVE_INFINITY

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const p = ctx.getImageData(x, y, 1, 1).data
      const c = { r: p[0], g: p[1], b: p[2] }
      const l = luminance(c)
      if (l < darkestL) {
        darkestL = l
        darkest = c
      }
      if (l > lightestL) {
        lightestL = l
        lightest = c
      }
    }
  }

  return {
    bg: rgbToCss(darkest),
    fg: rgbToCss(lightest)
  }
}

function readStoredPieceMinute() {
  try {
    const raw = sessionStorage.getItem(PIECE_MINUTE_KEY)
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? normalizeMinuteIndex(n) : null
  } catch {
    return null
  }
}

export default function PiecePage() {
  const navigate = useNavigate()
  const [selectedIndex, setSelectedIndex] = useState(readStoredPieceMinute)
  const now = useNow(1000)
  const displayMinuteIndex = useMemo(() => {
    const live = getMinuteIndexFromDate(now, TOTAL_SQUARES)
    return selectedIndex != null ? selectedIndex : live
  }, [now, selectedIndex])

  const [showFps, setShowFps] = useState(false)
  const [fadeMode, setFadeMode] = useState('swap')
  const [gridLayoutMode, setGridLayoutMode] = useState('factor-fit')
  const [chromeHidden, setChromeHidden] = useState(true)
  const [waveRippleEnabled, setWaveRippleEnabled] = useState(true)
  const [chromaticNudgeSource, setChromaticNudgeSource] = useState('manual')

  useEffect(() => {
    if (chromaticNudgeSource === 'lab') setWaveRippleEnabled(false)
  }, [chromaticNudgeSource])

  const ownerByTokenRef = useRef(new Map())
  const [workOwnerLine, setWorkOwnerLine] = useState('')
  const {
    walletAccount,
    walletBusy,
    walletError,
    rpcUrl,
    contractAddress,
    connectWallet,
    disconnectWallet,
    refreshSold,
    getSoldMinuteIndices
  } = useWallet()

  useEffect(() => {
    try {
      if (selectedIndex == null) sessionStorage.removeItem(PIECE_MINUTE_KEY)
      else sessionStorage.setItem(PIECE_MINUTE_KEY, String(selectedIndex))
    } catch {
      /* ignore */
    }
  }, [selectedIndex])

  useEffect(() => {
    const idx = normalizeMinuteIndex(displayMinuteIndex)
    let cancelled = false
    const apply = (fn) => {
      queueMicrotask(() => {
        if (!cancelled) fn()
      })
    }
    if (!rpcUrl || !contractAddress) {
      apply(() => setWorkOwnerLine(''))
      return () => {
        cancelled = true
      }
    }
    const cached = ownerByTokenRef.current.get(idx)
    if (cached !== undefined) {
      apply(() => setWorkOwnerLine(formatOwnerDisplay(cached)))
      return () => {
        cancelled = true
      }
    }
    apply(() => setWorkOwnerLine('…'))
    readTokenOwner({ rpcUrl, contractAddress, tokenId: idx })
      .then((addr) => {
        if (cancelled) return
        const value = addr ? addr : 'UNMINTED'
        ownerByTokenRef.current.set(idx, value)
        setWorkOwnerLine(formatOwnerDisplay(value))
      })
      .catch(() => {
        if (cancelled) return
        setWorkOwnerLine('')
      })
    return () => {
      cancelled = true
    }
  }, [displayMinuteIndex, rpcUrl, contractAddress])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'c' && e.key !== 'C') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) return
      setChromeHidden((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isLive = selectedIndex == null

  const stepWork = useCallback((delta) => {
    const live = getMinuteIndexFromDate(new Date(), TOTAL_SQUARES)
    setSelectedIndex((prev) => {
      const cur = prev != null ? prev : live
      return (cur + delta + TOTAL_SQUARES) % TOTAL_SQUARES
    })
  }, [])

  const goGallery = useCallback(() => {
    navigate('/gallery')
  }, [navigate])

  const handleMintClick = useCallback(async () => {
    if (!walletAccount) {
      await connectWallet()
      return
    }
    // Mint flow will be wired here once contract write is implemented.
  }, [walletAccount, connectWallet])

  const ownerDisplay =
    !rpcUrl || !contractAddress
      ? ''
      : workOwnerLine === '…'
        ? '…'
        : workOwnerLine || ''

  const goNow = () => {
    setSelectedIndex(null)
    try {
      sessionStorage.removeItem(PIECE_MINUTE_KEY)
    } catch {
      /* ignore */
    }
  }

  const handleCellClick = (idx) => {
    const m = normalizeMinuteIndex(idx)
    setSelectedIndex(m)
    try {
      sessionStorage.setItem(PIECE_MINUTE_KEY, String(m))
    } catch {
      /* ignore quota / private mode */
    }
    navigate('/')
  }

  const captureInfoTheme = useCallback(() => {
    try {
      const canvas = document.querySelector('.piece-viewport .live-canvas')
      const sampled = canvas ? sampleCanvasTheme(canvas) : null
      const theme = sampled || { bg: 'rgb(0, 0, 0)', fg: 'rgb(255, 255, 255)' }
      sessionStorage.setItem(INFO_THEME_KEY, JSON.stringify(theme))
    } catch {
      /* ignore storage/access errors */
    }
  }, [])

  return (
    <main className="site-shell site-shell--fullscreen">
      <section className="hero-section">
      
        {!chromeHidden && (
          <div className="hero-toolbar">
            <div className="toolbar-actions">
              
              <label className="fps-toggle">
                <input
                  type="checkbox"
                  checked={showFps}
                  onChange={(e) => setShowFps(e.target.checked)}
                />
                <span>FPS</span>
              </label>
              <label className="fps-toggle">
                <span>Fade</span>
                <select
                  className="toggle-select"
                  value={fadeMode}
                  onChange={(e) => setFadeMode(e.target.value)}
                >
                  <option value="swap">Swap</option>
                  <option value="inner-fade">Inner fade</option>
                </select>
              </label>
              <label className="fps-toggle" title={chromaticNudgeSource === 'lab' ? 'Lab uses a uniform wave (no Y ripple).' : undefined}>
                <input
                  type="checkbox"
                  checked={waveRippleEnabled}
                  disabled={chromaticNudgeSource === 'lab'}
                  onChange={(e) => setWaveRippleEnabled(e.target.checked)}
                />
                <span>Ripple</span>
              </label>
              <label className="fps-toggle">
                <span>Chroma</span>
                <select
                  className="toggle-select"
                  value={chromaticNudgeSource}
                  onChange={(e) => setChromaticNudgeSource(e.target.value)}
                >
                  <option value="manual">Manual nudges</option>
                  <option value="gradient">Gradient peak</option>
                  <option value="combo">Combo (inner split)</option>
                  <option value="lab">Lab (spatial + hand proximity)</option>
                </select>
              </label>
              {!isLive && (
                <button type="button" className="toggle-button" onClick={goNow}>
                  Now
                </button>
              )}
              {walletAccount ? (
                <>
                  <span className="wallet-pill mono" title={walletAccount}>
                    {walletAccount.slice(0, 6)}…{walletAccount.slice(-4)}
                  </span>
                  <button
                    type="button"
                    className="toggle-button"
                    disabled={walletBusy || !rpcUrl || !contractAddress}
                    onClick={refreshSold}
                  >
                    Refresh sold
                  </button>
                  <button type="button" className="toggle-button" onClick={disconnectWallet}>
                    Disconnect
                  </button>
                </>
              ) : null}
            </div>
            {walletError && <div className="wallet-banner">{walletError}</div>}
          </div>
        )}

        <div className="viewer-frame">
          <ViewerBrand
            chromeHidden={chromeHidden}
            navTo="/gallery"
            navLabel="Gallery"
            onBrandClick={captureInfoTheme}
          />
          <div className="piece-viewport">
            <CanvasView
              mode="square"
              showFps={showFps}
              selectedIndex={selectedIndex}
              fadeMode={fadeMode}
              gridLayoutMode="factor-fit"
              waveRippleEnabled={waveRippleEnabled}
              chromaticNudgeSource={chromaticNudgeSource}
              getSoldMinuteIndices={getSoldMinuteIndices}
              onSquareHalfStep={undefined}
              onCanvasClick={goGallery}
              onGridCellClick={undefined}
              canvasCursor={undefined}
            />
          </div>
          <div className="viewer-piece-foot viewer-chrome-invert">
            <div className="work-meta">
              <div className="work-meta-time-row">
                <button
                  type="button"
                  className="work-meta-step-button mono"
                  aria-label="Previous minute"
                  title="Previous minute"
                  onClick={(e) => {
                    e.stopPropagation()
                    stepWork(-1)
                  }}
                >
                  ←
                </button>
                <p
                  role="button"
                  tabIndex={0}
                  className="work-meta-time mono work-meta-time--clickable"
                  title="Return to live time"
                  onClick={(e) => {
                    e.stopPropagation()
                    goNow()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      goNow()
                    }
                  }}
                >
                  {formatWorkTime(displayMinuteIndex)}
                </p>
                <button
                  type="button"
                  className="work-meta-mint-button mono"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMintClick()
                  }}
                  disabled={walletBusy}
                  title={!walletAccount ? 'Connect wallet to mint' : 'Mint this minute'}
                >
                  {walletBusy ? '...' : 'Mint'}
                </button>
                <button
                  type="button"
                  className="work-meta-step-button mono"
                  aria-label="Next minute"
                  title="Next minute"
                  onClick={(e) => {
                    e.stopPropagation()
                    stepWork(1)
                  }}
                >
                  →
                </button>
              </div>
              {ownerDisplay ? (
                <p className="work-meta-owner mono">
                  <span className="work-meta-label">Owner</span>{' '}
                  <span className="work-meta-owner-value">{ownerDisplay}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
