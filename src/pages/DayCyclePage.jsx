import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasView } from '../viewer/CanvasView.jsx'

/**
 * Live single-cell hull for the full local day — canvas only (matches on-chain
 * day embed). Tap canvas to open the gallery.
 */
export default function DayCyclePage() {
  const navigate = useNavigate()
  const goGallery = useCallback(() => {
    navigate('/gallery')
  }, [navigate])

  return (
    <main className="site-shell site-shell--fullscreen">
      <section className="hero-section">
        <div className="viewer-frame">
          <div className="piece-viewport">
            <CanvasView
              mode="square"
              showFps={false}
              selectedIndex={null}
              gridLayoutMode="factor-fit"
              waveRippleEnabled
              getSoldMinuteIndices={undefined}
              onSquareHalfStep={undefined}
              onCanvasClick={goGallery}
              onGridCellClick={undefined}
              canvasCursor={undefined}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
