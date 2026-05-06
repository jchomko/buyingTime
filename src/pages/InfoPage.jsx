import { useMemo } from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { NavLink } from 'react-router-dom'

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
  const theme = useMemo(readInfoTheme, [])
  const style = theme ? { backgroundColor: theme.bg, color: theme.fg } : undefined

  return (
    <main className="site-shell info-shell" style={style}>
      <section className="content-section content-section--info">
        <Container fluid className="px-0">
          <Row className="g-0">
            <Col md={2} className="content-side-title">
              <NavLink to="/" className="viewer-title viewer-title--link">
                Buying Time
              </NavLink>
            </Col>
            <Col md={8} className="content-main-copy" />
            <Col md={2} />
          </Row>

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h2 className="viewer-title">About</h2>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
                Time is the animating force of computation.
                Artists focus effort over time to create works that show subjects in new light.
                Artists sell these representations of effort over time, to support their practice and
                enable the production of new work.
              </p>
              <p>
                Collectors buy these representations of effort over time, joining in the creative
                process through selection and contribution.
              </p>
            </Col>
            <Col md={2} />
          </Row>

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h2 className="viewer-title">Process</h2>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
                Buying Time is a series of 1440 works, each one minute of the day represented by an abstraction of an analog clock face. 
                The price for each work is determined through a preview sale, with prices starting at $0 and increasing by $1 each minute.
                After 24 hours of ascending prices, the mint will be publicly announced, and the price will be the median paid during the preview sale.
              </p> 
              <p>
                The public mint opens May 20th at 00:00 EDT. 
              </p>
            </Col>
            <Col md={2} />
          </Row>

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h2 className="viewer-title">Background</h2>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
              Buying Time continues a series of works that explore market valuation, collective production and minimal abstraction. My aim was to create a piece that had both an individual view, as well as a collective view - one element contributing to become part of a larger composition. 

The clock hands are extended on both sides of the central rotation point, and wrapped in a hull. Some legibility remains - the longest sides are the indicator sides. 

              </p>
            </Col>
            <Col md={2} />
          </Row>
        </Container>
      </section>
    </main>
  )
}
