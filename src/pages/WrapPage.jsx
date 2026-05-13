import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CanvasView } from '../viewer/CanvasView.jsx'

/**
 * Full-viewport square hull with reference hands (matches the Wrapping embed on /info).
 * Tap canvas to return to the about page.
 */
export default function WrapPage() {
  const navigate = useNavigate()
  const goInfo = useCallback(() => {
    navigate('/info')
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
              onCanvasClick={goInfo}
              onGridCellClick={undefined}
              canvasCursor={undefined}
              overlayReferenceHands
            />
          </div>
        </div>
      </section>
    </main>
  )
}
