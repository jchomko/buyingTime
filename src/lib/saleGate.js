/** When minting is allowed (build-time env + optional clock for auto-open). */

function parseOpensAt(raw) {
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

function formatOpensLabel(opensAtMs) {
  const d = new Date(opensAtMs)
  return d.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

/**
 * @param {Date} [now]  Defaults to `Date.now()`; pass live clock for auto-open without refresh.
 */
export function getMintSaleState(now = new Date()) {
  const enabledFlag = (import.meta.env.VITE_MINT_ENABLED || '').trim().toLowerCase()
  if (enabledFlag === 'false' || enabledFlag === '0') {
    return {
      mintEnabled: false,
      opensAtMs: null,
      opensLabel: null,
      closedMessage: 'Minting is not open yet.'
    }
  }
  if (enabledFlag === 'true' || enabledFlag === '1') {
    return { mintEnabled: true, opensAtMs: null, opensLabel: null, closedMessage: null }
  }

  const opensAtMs = parseOpensAt((import.meta.env.VITE_SALE_OPENS_AT || '').trim())
  if (opensAtMs == null) {
    return { mintEnabled: true, opensAtMs: null, opensLabel: null, closedMessage: null }
  }

  const nowMs = now.getTime()
  if (nowMs >= opensAtMs) {
    return { mintEnabled: true, opensAtMs, opensLabel: formatOpensLabel(opensAtMs), closedMessage: null }
  }

  const opensLabel = formatOpensLabel(opensAtMs)
  return {
    mintEnabled: false,
    opensAtMs,
    opensLabel,
    closedMessage: `Sale opens ${opensLabel}.`
  }
}
