import { useCallback, useMemo } from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { NavLink, useNavigate } from 'react-router-dom'
import { CanvasView } from '../viewer/CanvasView.jsx'

const INFO_THEME_KEY = 'pieceInfoTheme'

const FAQ_ITEMS = [
  {
    question: 'How do I mint?',
    answer: (
      <>
        Pick a minute in the <a href="/gallery" target="_blank" rel="noreferrer">gallery view</a>, sign in with Verse, and click Mint to purchase through your Verse account or wallet.
      </>
    ),
  },
  {
    question: 'What is the inner shape based on?',
    answer: (
      <>
        The form comes from extending the hour, minute, and second hands of an analog clock towards the frame edges. The hand nearest the edge is
        the second hand, the second nearest the minute, and the third nearest the hour. For a reference overlay, open the{' '}
        <a href="/clock" target="_blank" rel="noreferrer">
          clock overlay
        </a>
        .
      </>
    ),
  },
  {
    question: 'How many pieces are in the series?',
    answer: <>There are 1440 minutes in a day, and the series includes one work for each of those minutes.</>,
  },
  {
    question: 'What is there a jump in the loop?',
    answer: <>Each minute cycle is based on the hands of a clock, so the minute and hour hands are at a different positions at the start and end of the minute. To see the piece with no loop, click the time to select the current time playback.</>,
  },
  {
    question: 'Is the work on-chain?',
    answer: <>The html/js code for the work is embedded on the Ethereum blockchain and served directly from the tokenURI. The thumbnails are stored on Arweave.</>,
  },
  {
    question: 'What views are available in the token?',
      answer: <>Minted tokens have three views that can be selected: the 1 minute loop, the 1 minute grid view loop, and a 24 hour time-synced view. These viewes can by cycled by clicking the minted work, or by using the keys 'd' for the 24 hour view, 'g' for the 1 minute grid view, and 't' for the 1 minute loop.</>,
    },

  
]

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
          {/* <Row className="g-0">
            <Col md={4} className="content-side-title">
             
            </Col>
            <Col md={8} className="content-main-copy" />
            
            <Col md={2} />
          </Row> */}

          <Row className="g-0 ">
            <Col md={2} className="content-side-title">
            <NavLink to="/" className="viewer-title viewer-title--link">
                Buying Time
              </NavLink>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
                <br></br>
              Artists focus effort over time to create works that show subjects in new light. 
              Artists sell these creations to support their practice and enable the production of new work.
              Collectors select and collect works, supporting the continuation of artistic production. 
              </p>
              <br></br>
              <p>
              Buying Time is a series of 1440 works, each an abstraction of an analog clock moving through one minute of the day.
              The work can be viewed head-on as a 24 hour<a href="/day" target="_blank"> abstract clock</a>, or in <a href="/gallery" target="_blank">parallel as a grid</a>, where a pattern emerges from the individual works. 
            
              </p>
            </Col>
            <Col md={2} />
          </Row>

          {/* <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title"></h3>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
              </p> 
             
            </Col>
            <Col md={2} />
          </Row> */}

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title"></h3>
            </Col>
            <Col md={8} className="content-main-copy">
              <p>
              Buying Time continues a series of works that explore <a href="https://proofofwork.jonathanchomko.com" target="_blank">market valuation</a>, <a href="https://constant.jonathanchomko.com" target="_blank">collective production</a> and <a href="https://aestheticconstant.jonathanchomko.com/" target="_blank">visual abstraction</a>. My aim with this piece was to create a series that offered multiple perspectives on the same dataset, the individual elements contributing to a larger collective composition. 
              </p>
              
              
            </Col>
            <Col md={2} />
          </Row>

         

          <Row className="g-0 pt-4">
            <Col md={2} className="content-side-title">
              <h3 className="viewer-title">FAQ</h3>
            </Col>
            <Col md={8} className="content-main-copy">
              <div className="info-faq">
                {FAQ_ITEMS.map(({ question, answer }) => (
                  <details key={question} className="info-faq__item">
                    <summary className="info-faq__summary">{question}</summary>
                    <div className="info-faq__answer">{answer}</div>
                  </details>
                ))}
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
              {/* Contract: <a href="https://etherscan.io/address/0x0000000000000000000000000000000000000000" target="_blank">0x0000000000000000000000000000000000000000</a> */}
              {/* <br /> */}
              Website:  < a href="https://jonathanchomko.com" target="_blank">jonathanchomko.com</a>
               </p>
              
            </Col>
            <Col md={2} />
          </Row>
        </Container>
      </section>
    </main>
  )
}
