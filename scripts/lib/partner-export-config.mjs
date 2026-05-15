import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatWorkTime, normalizeMinuteIndex } from '../../src/timeGrid.js'
import { loadMintEnv } from './load-mint-env.mjs'

loadMintEnv()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const MINT_SITE_ROOT = path.resolve(__dirname, '../..')

export const TOTAL_TOKENS = 1440

export function parseTokenRange(env = process.env) {
  const start = Number(env.PARTNER_TOKEN_START ?? 0)
  const end = Number(env.PARTNER_TOKEN_END ?? TOTAL_TOKENS - 1)
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error('PARTNER_TOKEN_START and PARTNER_TOKEN_END must be numbers')
  }
  if (start < 0 || end < start || end >= TOTAL_TOKENS) {
    throw new Error(`Token range must satisfy 0 <= start <= end < ${TOTAL_TOKENS}`)
  }
  return { start, end }
}

export function partnerOutputDir(env = process.env) {
  const raw = env.PARTNER_OUTPUT_DIR
  return raw
    ? path.resolve(raw)
    : path.join(MINT_SITE_ROOT, 'out', 'partner-export')
}

export function partnerImagesDir(env = process.env) {
  return path.join(partnerOutputDir(env), 'images')
}

/** PNGs from partner-svg-thumbnail.html (BuyingTime.sol thumbnail SVG parity). */
export function partnerContractSvgImagesDir(env = process.env) {
  return path.join(partnerOutputDir(env), 'images-contract-svg')
}

export function partnerCsvPath(env = process.env) {
  const raw = env.PARTNER_CSV_PATH
  return raw ? path.resolve(raw) : path.join(partnerOutputDir(env), 'partner-import.csv')
}

export function captureSize(env = process.env) {
  const n = Number(env.PARTNER_CAPTURE_SIZE ?? 1200)
  return Number.isFinite(n) && n >= 64 ? Math.floor(n) : 1200
}

export function pngFilename(tokenId) {
  return `BuyingTime${tokenId}.png`
}

export function customTitle(tokenId) {
  const minute = normalizeMinuteIndex(Number(tokenId))
  return `Buying Time ${formatWorkTime(minute)}`
}

/** Normalize Arweave tx id (strip gateway prefix if pasted as a full URL). */
export function normalizeArweaveTxId(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const m = s.match(/arweave\.net\/([A-Za-z0-9_-]{43})/)
  if (m) return m[1]
  return s.replace(/^\/+/, '')
}

/** Full Arweave gateway URL for the uploaded HTML, without query string. */
export function arweaveAnimationPageUrl(env = process.env) {
  const txId = normalizeArweaveTxId(env.PARTNER_ARWEAVE_TX_ID)
  if (!txId) return null
  return `https://arweave.net/${txId}`
}

/**
 * Full per-token animation_url for partner CSV.
 * Prefer PARTNER_ARWEAVE_TX_ID after upload; overrides template/base when set.
 */
export function animationUrlForToken(tokenId, env = process.env) {
  const pageUrl = arweaveAnimationPageUrl(env)
  if (pageUrl) {
    return `${pageUrl}?tokenId=${tokenId}`
  }

  const template = env.PARTNER_ANIMATION_URL_TEMPLATE?.trim()
  if (template) {
    const txForTemplate = normalizeArweaveTxId(env.PARTNER_ARWEAVE_TX_ID)
    let url = template.replaceAll('{tokenId}', String(tokenId))
    if (template.includes('{txId}')) {
      if (!txForTemplate) {
        throw new Error(
          'PARTNER_ANIMATION_URL_TEMPLATE contains {txId}: set PARTNER_ARWEAVE_TX_ID to your upload transaction id'
        )
      }
      url = url.replaceAll('{txId}', txForTemplate)
    }
    return url
  }

  const base = env.PARTNER_ANIMATION_BASE_URL
  if (base) {
    const b = base.replace(/\/$/, '')
    if (b.includes('{tokenId}')) return b.replaceAll('{tokenId}', String(tokenId))
    if (/[?&]tokenId=$/.test(b) || b.endsWith('tokenId=')) return `${b}${tokenId}`
    const sep = b.includes('?') ? '&' : '?'
    return `${b}${sep}tokenId=${tokenId}`
  }

  throw new Error(
    'Set PARTNER_ARWEAVE_TX_ID (after uploading out/partner-export/arweave-animation.html), ' +
      'PARTNER_ANIMATION_URL_TEMPLATE, or PARTNER_ANIMATION_BASE_URL'
  )
}

export function capturePageUrl(tokenId, env = process.env) {
  const base = (env.PARTNER_CAPTURE_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
  const size = captureSize(env)
  return `${base}/partner-thumbnail.html?tokenId=${tokenId}&size=${size}`
}

/** Seconds on the SVG document timeline (`SVGSVGElement#setCurrentTime`). */
export function contractSvgDocTime(env = process.env) {
  const n = Number(env.PARTNER_SVG_DOCUMENT_TIME_SEC ?? 0)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function captureContractSvgThumbnailPageUrl(tokenId, env = process.env) {
  const base = (env.PARTNER_CAPTURE_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
  const size = captureSize(env)
  const t = contractSvgDocTime(env)
  return `${base}/partner-svg-thumbnail.html?tokenId=${tokenId}&size=${size}&t=${encodeURIComponent(String(t))}`
}
