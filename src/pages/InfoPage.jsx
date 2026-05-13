import { useCallback, useMemo } from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { NavLink, useNavigate } from 'react-router-dom'
import { CanvasView } from '../viewer/CanvasView.jsx'

const INFO_THEME_KEY = 'pieceInfoTheme'

function readInfoTheme() {
  try {
    const raw = sessionStorage.getItem(INFO_THEME_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.bg !== 'string' || typeof parsed.fg !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export default function InfoPage() {
  const navigate = useNavigate()
  const theme = useMemo(readInfoTheme, [])
  const style = theme ? { backgroundColor: theme.bg, color: theme.fg } : undefined
  const goDay = useCallback(() => {
    navigate('/day')
  }, [navigate])

  return (
    <main className="site-shell info-shell" style={style}>
      {/* <div className="viewer-title-stack viewer-chrome-invert">
        <button
          type="button"
          className="viewer-title viewer-title--link viewer-title--connect"
          onClick={() => navigate(-1)}
        >
          Close
        </button>
      </div> */}
      <section className="content-section content-section--info">
        <Container fluid className="px-0">
          <Row className="g-0">
            <Col md={4} className="content-side-title">
              <NavLink to="/" className="viewer-title viewer-title--link">
                Buying Time
              </NavLink>
            </Col>
            <Col md={4} className="content-main-copy" />
            <Col md={2} />
          </Row>

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title">About</h3>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
                Time is the animating force of computation. Artists focus effort over time to create works that show subjects in new light. 
                Artists sell these creations to support their practice and enable the production of new work.
                Collectors select and collect these representations of effort over time, supporting the continuation of artistic production. 
              </p>
              <p>
               
              </p>
            </Col>
            <Col md={2} />
          </Row>

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title"></h3>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
              Buying Time is a series of 1440 works, each an abstraction of an analog clock moving through one minute of the day.
              The work can be viewed head-on in a <a href="/day" target="_blank"> 24 hour animation</a>, or in <a href="/gallery" target="_blank">parallel</a> where a pattern emerges from the individual animations. 
              </p> 
             
            </Col>
            <Col md={2} />
          </Row>

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title">Background</h3>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
              Buying Time continues a series of works that explore <a href="https://proofofwork.jonathanchomko.com" target="_blank">market valuation</a>, <a href="https://constant.jonathanchomko.com" target="_blank">collective production</a> and <a href="https://aestheticconstant.jonathanchomko.com/" target="_blank">visual abstraction</a>. My aim with this piece was to create a series  that offered multiple perspectives on the same dataset, the individual elements contributing to a larger collective composition. 
              </p>
              
              
            </Col>
            <Col md={2} />
          </Row>

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title">Wrapping</h3>
            </Col>
            <Col md={8} className="content-main-copy">
            <p className="">
                Clock hands are extended on both sides of the axis of rotation, and wrapped in a hull. Some legibility remains - the longest sides are the indicator sides.{' '}
                <a href="/clock" target="_blank" rel="noreferrer">
                  Full screen
                </a>
                .
              </p>
            <div className="info-day-embed">
                <div className="info-day-embed__frame">
                  <div className="piece-viewport">
                    <CanvasView
                      mode="square"
                      showFps={false}
                      selectedIndex={null}
                      gridLayoutMode="factor-fit"
                      waveRippleEnabled
                      getSoldMinuteIndices={undefined}
                      onSquareHalfStep={undefined}
                      onCanvasClick={undefined}
                      onGridCellClick={undefined}
                      canvasCursor={undefined}
                      overlayReferenceHands
                    />
                  </div>
                </div>
              </div>
             
            </Col>
            <Col md={2} />
          </Row>


          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title">Links</h3>
            </Col>
            <Col md={9} className="content-main-copy">
              <p>
              Contract address: <a href="https://etherscan.io/address/0x0000000000000000000000000000000000000000" target="_blank">0x0000000000000000000000000000000000000000</a>
              <br />
              <a href="https://jonathanchomko.com" target="_blank">jonathanchomko.com</a>
               </p>
              
            </Col>
            <Col md={2} />
          </Row>
        </Container>
      </section>
    </main>
  )
}
