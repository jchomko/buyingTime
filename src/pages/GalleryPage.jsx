import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../context/useWallet.js'
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
  const [fadeMode, setFadeMode] = useState('swap')
  const [gridLayoutMode, setGridLayoutMode] = useState('factor-fit')
  const [chromeHidden, setChromeHidden] = useState(true)
  const [waveRippleEnabled, setWaveRippleEnabled] = useState(true)
  const [chromaticNudgeSource, setChromaticNudgeSource] = useState('manual')

  useEffect(() => {
    if (chromaticNudgeSource === 'lab') setWaveRippleEnabled(false)
  }, [chromaticNudgeSource])

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
        <div className="viewer-frame">
          {/* <ViewerBrand
            chromeHidden={chromeHidden}
            walletAccount={walletAccount}
            walletBusy={walletBusy}
            onConnect={connectWallet}
          /> */}
          <CanvasView
            mode="gallery"
            showFps={showFps}
            selectedIndex={selectedIndex}
            fadeMode={fadeMode}
            gridLayoutMode={gridLayoutMode}
            waveRippleEnabled={waveRippleEnabled}
            chromaticNudgeSource={chromaticNudgeSource}
            getSoldMinuteIndices={getSoldMinuteIndices}
            onCanvasClick={undefined}
            onGridCellClick={handleCellClick}
          />
        </div>
      </section>
    </main>
  )
}
