import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi'
import { ViewerBrand } from '../components/ViewerBrand.jsx'
import {
  readTokenOwner,
  readTokenOwnerDisplay
} from '../lib/readPurchasedTokenIds.js'
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

function isAlreadyMintedContractError(err) {
  const s = `${err?.shortMessage || ''} ${err?.message || ''} ${err?.cause?.message || ''}`.toLowerCase()
  return s.includes('already minted')
}

const BUYING_TIME_WRITE_ABI = [
  {
    type: 'function',
    name: 'pricePerPiece',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'mintInvite',
    stateMutability: 'payable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
]

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
  const expectedChainId = useMemo(() => {
    const raw = (import.meta.env.VITE_CHAIN_ID || '31337').trim()
    const id = Number.parseInt(raw, 10)
    return Number.isFinite(id) ? id : 31337
  }, [])
  const navigate = useNavigate()
  const [selectedIndex, setSelectedIndex] = useState(readStoredPieceMinute)
  const now = useNow(1000)
  const displayMinuteIndex = useMemo(() => {
    const live = getMinuteIndexFromDate(now, TOTAL_SQUARES)
    return selectedIndex != null ? selectedIndex : live
  }, [now, selectedIndex])

  const [showFps, setShowFps] = useState(false)
  const [gridLayoutMode, setGridLayoutMode] = useState('factor-fit')
  const [chromeHidden, setChromeHidden] = useState(true)
  const [waveRippleEnabled, setWaveRippleEnabled] = useState(true)

  const ownerByTokenRef = useRef(new Map())
  const [workOwnerLine, setWorkOwnerLine] = useState('')
  const [mintTxHash, setMintTxHash] = useState(null)
  const [mintError, setMintError] = useState('')
  const alreadyMintedDialogRef = useRef(null)
  const {
    walletAccount,
    walletBusy,
    walletError,
    rpcUrl,
    contractAddress,
    connectWallet,
    disconnectWallet,
    refreshSold
  } = useWallet()

  useEffect(() => {
    try {
      if (selectedIndex == null) sessionStorage.removeItem(PIECE_MINUTE_KEY)
      else sessionStorage.setItem(PIECE_MINUTE_KEY, String(selectedIndex))
    } catch {
      /* ignore */
    }
  }, [selectedIndex])

  const resolveOwnerDisplay = useCallback(async (idx) => {
    if (!rpcUrl || !contractAddress) return ''
    const ensRpcUrl = (import.meta.env.VITE_ENS_RPC_URL || '').trim() || undefined
    return readTokenOwnerDisplay({
      rpcUrl,
      contractAddress,
      tokenId: idx,
      ensRpcUrl
    })
  }, [rpcUrl, contractAddress])

  const { data: pricePerPiece } = useReadContract({
    address: contractAddress || undefined,
    abi: BUYING_TIME_WRITE_ABI,
    functionName: 'pricePerPiece',
    chainId: expectedChainId,
    query: {
      enabled: !!contractAddress
    }
  })

  const { writeContractAsync, isPending: isMintSubmitting } = useWriteContract()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({
    hash: mintTxHash
  })

  useEffect(() => {
    if (!isMintConfirmed) return
    const idx = normalizeMinuteIndex(displayMinuteIndex)
    refreshSold()
      .then(() => resolveOwnerDisplay(idx))
      .then((ownerLabel) => {
        ownerByTokenRef.current.set(idx, ownerLabel)
        setWorkOwnerLine(formatOwnerDisplay(ownerLabel))
        setMintError('')
      })
      .catch((err) => {
        setMintError(err?.shortMessage || err?.message || String(err))
      })
      .finally(() => setMintTxHash(null))
  }, [isMintConfirmed, displayMinuteIndex, refreshSold, resolveOwnerDisplay])

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
    resolveOwnerDisplay(idx)
      .then((value) => {
        if (cancelled) return
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
  }, [displayMinuteIndex, rpcUrl, contractAddress, resolveOwnerDisplay])

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

  const handleConnectClick = useCallback(async () => {
    setMintError('')
    await connectWallet()
  }, [connectWallet])

  const syncOwnerAndSoldAfterMintedSlot = useCallback(
    (idx) => {
      return refreshSold()
        .then(() => resolveOwnerDisplay(idx))
        .then((ownerLabel) => {
          ownerByTokenRef.current.set(idx, ownerLabel)
          setWorkOwnerLine(formatOwnerDisplay(ownerLabel))
        })
    },
    [refreshSold, resolveOwnerDisplay]
  )

  const handleMintClick = useCallback(async () => {
    setMintError('')
    if (!walletAccount) {
      setMintError('Connect wallet first.')
      return
    }
    if (!contractAddress) {
      setMintError('Set VITE_CONTRACT_ADDRESS before minting.')
      return
    }
    const idx = normalizeMinuteIndex(displayMinuteIndex)
    try {
      if (chainId !== expectedChainId) {
        await switchChainAsync({ chainId: expectedChainId })
      }
      if (rpcUrl && contractAddress) {
        const ownerAddr = await readTokenOwner({
          rpcUrl,
          contractAddress,
          tokenId: idx
        })
        if (ownerAddr) {
          syncOwnerAndSoldAfterMintedSlot(idx).catch(() => {})
          alreadyMintedDialogRef.current?.showModal()
          return
        }
      }
      const tokenId = BigInt(idx)
      const txHash = await writeContractAsync({
        address: contractAddress,
        abi: BUYING_TIME_WRITE_ABI,
        functionName: 'mintInvite',
        args: [tokenId],
        value: pricePerPiece ?? 0n,
        chainId: expectedChainId
      })
      setMintTxHash(txHash)
    } catch (err) {
      if (isAlreadyMintedContractError(err)) {
        syncOwnerAndSoldAfterMintedSlot(idx).catch(() => {})
        alreadyMintedDialogRef.current?.showModal()
        return
      }
      setMintError(err?.shortMessage || err?.message || String(err))
    }
  }, [
    walletAccount,
    contractAddress,
    rpcUrl,
    chainId,
    expectedChainId,
    switchChainAsync,
    writeContractAsync,
    pricePerPiece,
    displayMinuteIndex,
    syncOwnerAndSoldAfterMintedSlot
  ])

  const ownerDisplay =
    !rpcUrl || !contractAddress
      ? ''
      : workOwnerLine === '…'
        ? '…'
        : workOwnerLine || ''

  const isMinted =
    Boolean(ownerDisplay) &&
    ownerDisplay !== '…' &&
    ownerDisplay !== 'Not minted'

  const mintSlotOwnerTitle = (() => {
    const idx = normalizeMinuteIndex(displayMinuteIndex)
    const raw = ownerByTokenRef.current.get(idx)
    return typeof raw === 'string' && raw !== 'Not minted' ? raw : ''
  })()

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

  const triedMinuteLabel = formatWorkTime(normalizeMinuteIndex(displayMinuteIndex))

  return (
    <main className="site-shell site-shell--fullscreen">
      <dialog ref={alreadyMintedDialogRef} className="mint-blocked-dialog">
        <h2 className="mint-blocked-dialog__title mono">Already minted</h2>
        <p className="mint-blocked-dialog__body">
          <span className="mono">{triedMinuteLabel}</span>
          {' '}
          is not available. Another wallet may have minted it first, or your sold list was out of date.
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
              ) : (
                <button
                  type="button"
                  className="toggle-button"
                  disabled={walletBusy}
                  onClick={() => {
                    setMintError('')
                    connectWallet()
                  }}
                >
                  Connect
                </button>
              )}
            </div>
            {walletError && <div className="wallet-banner">{walletError}</div>}
            {mintError && <div className="wallet-banner">{mintError}</div>}
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
                {!walletAccount ? (
                  <button
                    type="button"
                    className="work-meta-mint-button mono"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleConnectClick()
                    }}
                    disabled={walletBusy}
                    title="Open wallet connect modal"
                  >
                    {walletBusy ? '…' : 'Connect'}
                  </button>
                ) : isMinted ? (
                  <span
                    className="work-meta-mint-button mono work-meta-owner-inline"
                    title={mintSlotOwnerTitle || undefined}
                  >
                    {ownerDisplay}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="work-meta-mint-button mono"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMintClick()
                    }}
                    disabled={walletBusy || isMintSubmitting || isMintConfirming}
                    title="Mint this minute"
                  >
                    {walletBusy || isMintSubmitting || isMintConfirming ? '…' : 'Mint'}
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
