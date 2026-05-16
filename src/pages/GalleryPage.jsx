import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVerse } from '../context/useVerse.js'
import { normalizeMinuteIndex } from '../timeGrid.js'
import { CanvasView } from '../viewer/CanvasView.jsx'

const PIECE_MINUTE_KEY = 'pieceSelectedMinute'

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

export default function GalleryPage() {
  const navigate = useNavigate()
  const [selectedIndex, setSelectedIndex] = useState(readStoredPieceMinute)
  const [showFps, setShowFps] = useState(false)
  const [gridLayoutMode, setGridLayoutMode] = useState('factor-fit')
  const [chromeHidden, setChromeHidden] = useState(true)
  const [waveRippleEnabled, setWaveRippleEnabled] = useState(true)

  const {
    verseUser,
    accountLabel,
    verseBusy,
    verseError,
    verseConfigured,
    signIn,
    signOut,
    refreshSold,
    getSoldMinuteIndices
  } = useVerse()

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

  return (
    <main className="site-shell">
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
                  onClick={signIn}
                >
                  Sign in
                </button>
              )}
            </div>
            {verseError && <div className="wallet-banner">{verseError}</div>}
          </div>
        )}
        <div className="viewer-frame">
          <CanvasView
            mode="gallery"
            showFps={showFps}
            selectedIndex={selectedIndex}
            gridLayoutMode={gridLayoutMode}
            waveRippleEnabled={waveRippleEnabled}
            getSoldMinuteIndices={getSoldMinuteIndices}
            onCanvasClick={undefined}
            onGridCellClick={handleCellClick}
          />
        </div>
      </section>
    </main>
  )
}
