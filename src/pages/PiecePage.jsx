import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ViewerBrand } from '../components/ViewerBrand.jsx'
import { useVerse } from '../context/useVerse.js'
import { getMinuteIndexFromDate } from '../render/clockHullRenderer.js'
import { CanvasView } from '../viewer/CanvasView.jsx'
import { getMintSaleState } from '../lib/saleGate.js'
import {
  TOTAL_SQUARES,
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

  const saleState = useMemo(() => getMintSaleState(now), [now])

  const [showFps, setShowFps] = useState(false)
  const [chromeHidden, setChromeHidden] = useState(true)
  const [waveRippleEnabled, setWaveRippleEnabled] = useState(true)
  const [mintError, setMintError] = useState('')
  const alreadyMintedDialogRef = useRef(null)

  const {
    verseUser,
    accountLabel,
    verseBusy,
    verseError,
    verseConfigured,
    signIn,
    signOut,
    refreshSold,
    purchaseMinute,
    isMinuteSold,
    soldTick,
    projectReady
  } = useVerse()
  void soldTick

  useEffect(() => {
    try {
      if (selectedIndex == null) sessionStorage.removeItem(PIECE_MINUTE_KEY)
      else sessionStorage.setItem(PIECE_MINUTE_KEY, String(selectedIndex))
    } catch {
      /* ignore */
    }
  }, [selectedIndex])

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

  const handleSignInClick = useCallback(async () => {
    setMintError('')
    await signIn()
  }, [signIn])

  const handleMintClick = useCallback(async () => {
    setMintError('')
    if (!saleState.mintEnabled) {
      setMintError(saleState.closedMessage || 'Minting is not open yet.')
      return
    }
    if (!verseConfigured) {
      setMintError('Set VITE_VERSE_ARTWORK_ID before minting.')
      return
    }
    if (!projectReady) {
      setMintError('Loading Verse catalog…')
      return
    }
    const idx = normalizeMinuteIndex(displayMinuteIndex)
    if (isMinuteSold(idx)) {
      alreadyMintedDialogRef.current?.showModal()
      return
    }
    const result = await purchaseMinute(idx, {
      onUnavailable: () => {
        alreadyMintedDialogRef.current?.showModal()
      }
    })
    if (!result.ok && result.error) {
      setMintError(result.error)
    }
  }, [
    saleState.mintEnabled,
    saleState.closedMessage,
    verseConfigured,
    projectReady,
    displayMinuteIndex,
    isMinuteSold,
    purchaseMinute
  ])

  const idx = normalizeMinuteIndex(displayMinuteIndex)
  const isSold = verseConfigured && isMinuteSold(idx)

  const goNow = () => {
    setSelectedIndex(null)
    try {
      sessionStorage.removeItem(PIECE_MINUTE_KEY)
    } catch {
      /* ignore */
    }
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

  const triedMinuteLabel = formatWorkTime(idx)
  const bannerError = mintError || verseError
  return (
    <main className="site-shell site-shell--fullscreen">
      <dialog ref={alreadyMintedDialogRef} className="mint-blocked-dialog">
        <h2 className="mint-blocked-dialog__title mono">Already minted</h2>
        <p className="mint-blocked-dialog__body">
          <span className="mono">{triedMinuteLabel}</span>
          {' '}
          is not available. Someone may have purchased it on Verse first, or the availability list was out of date.
        </p>
        <div className="mint-blocked-dialog__actions">
          <form method="dialog">
            <button type="submit" className="toggle-button">
              OK
            </button>
          </form>
          <Link
            to="/gallery"
            className="toggle-button toolbar-page-link"
            onClick={() => alreadyMintedDialogRef.current?.close()}
          >
            Open gallery
          </Link>
        </div>
      </dialog>
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
                <input
                  type="checkbox"
                  checked={waveRippleEnabled}
                  onChange={(e) => setWaveRippleEnabled(e.target.checked)}
                />
                <span>Ripple</span>
              </label>
              <Link to="/day" className="toggle-button toolbar-page-link">
                Live day
              </Link>
              {!isLive && (
                <button type="button" className="toggle-button" onClick={goNow}>
                  Now
                </button>
              )}
              {verseUser ? (
                <>
                  <span className="wallet-pill mono" title={accountLabel || 'Verse account'}>
                    {accountLabel || 'Verse'}
                  </span>
                  <button
                    type="button"
                    className="toggle-button"
                    disabled={verseBusy || !verseConfigured}
                    onClick={refreshSold}
                  >
                    Refresh
                  </button>
                  <button type="button" className="toggle-button" onClick={signOut}>
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="toggle-button"
                  disabled={verseBusy}
                  onClick={() => {
                    setMintError('')
                    signIn()
                  }}
                >
                  Sign in
                </button>
              )}
            </div>
            {bannerError && <div className="wallet-banner">{bannerError}</div>}
          </div>
        )}

        <div className="viewer-frame">
          <ViewerBrand
            chromeHidden={chromeHidden}
            brandAsLink
            navTo="/gallery"
            navLabel="Gallery"
            onBrandClick={captureInfoTheme}
          />
          <div className="piece-viewport">
            <CanvasView
              mode="square"
              showFps={showFps}
              selectedIndex={selectedIndex}
              gridLayoutMode="factor-fit"
              waveRippleEnabled={waveRippleEnabled}
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
                {!verseUser ? (
                  <button
                    type="button"
                    className="work-meta-mint-button mono"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSignInClick()
                    }}
                    disabled={verseBusy}
                    title="Sign in with Verse"
                  >
                    {verseBusy ? '…' : 'Sign in'}
                  </button>
                ) : isSold ? (
                  <span
                    className="work-meta-mint-button mono work-meta-owner-inline"
                    title="This minute is sold on Verse"
                  >
                    Sold
                  </span>
                ) : !saleState.mintEnabled ? (
                  <button
                    type="button"
                    className="work-meta-mint-button mono"
                    disabled
                    title={saleState.opensLabel ? `Opens ${saleState.opensLabel}` : 'Minting not open yet'}
                  >
                    Soon
                  </button>
                ) : (
                <button
                  type="button"
                  className="work-meta-mint-button mono"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMintClick()
                  }}
                  disabled={verseBusy || !verseConfigured || !projectReady}
                  title="Purchase this minute on Verse"
                >
                  {verseBusy ? '…' : 'Mint'}
                </button>
                )}
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
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
