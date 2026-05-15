/**
 * Mirrors BuyingTime.sol thumbnail SVG (buildImageSVG + helpers).
 * Keep in sync with contracts/contracts/BuyingTime.sol.
 */

export const THUMB_MAX_MINUTE = 1439
export const THUMB_STAGGER_CENTISEC = 7

function twoDigit(value) {
  const n = Number(value)
  return n < 10 ? `0${n}` : String(n)
}

/** @param {number | bigint | string} tokenId Solidity-style uint token id */
function tokenIdBn(tokenId) {
  if (typeof tokenId === 'bigint') return tokenId >= 0n ? tokenId : 0n
  const s = String(tokenId ?? 0).trim()
  if (/^\d+$/.test(s)) {
    try {
      return BigInt(s)
    } catch {
      return 0n
    }
  }
  const n = Math.floor(Number(tokenId))
  return BigInt(Number.isFinite(n) && n >= 0 ? n : 0)
}

export function thumbnailAnimateBegin(tokenId) {
  const m = tokenIdBn(tokenId) % 1440n
  const centi = (BigInt(THUMB_MAX_MINUTE) - m) * BigInt(THUMB_STAGGER_CENTISEC)
  const whole = centi / 100n
  const frac = centi % 100n
  return `-${whole.toString()}.${twoDigit(Number(frac))}s`
}

export function tokenIdTo24HourTime(tokenId) {
  const minutesInDay = Number(tokenIdBn(tokenId) % 1440n)
  const hour = Math.floor(minutesInDay / 60)
  const minute = minutesInDay % 60
  return `${twoDigit(hour)}:${twoDigit(minute)}`
}

export function buildContractThumbnailSvg(tokenId) {
  const timeLabel = tokenIdTo24HourTime(tokenId)
  const begin = thumbnailAnimateBegin(tokenId)
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'>` +
    `<rect width='1000' height='1000' fill='#000000'>` +
    `<animate attributeName='fill' begin='${begin}' dur='18s' values='#000000;#ffffff;#000000' repeatCount='indefinite'/>` +
    `</rect>` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#ffffff' font-size='130' font-family='serif'>` +
    timeLabel +
    `<animate attributeName='fill' begin='${begin}' dur='18s' values='#ffffff;#000000;#ffffff' repeatCount='indefinite'/>` +
    `</text>` +
    `</svg>`
  )
}
