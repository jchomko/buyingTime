import { normalizeMinuteIndex } from '../../timeGrid.js'

/** Parse minute index from Verse project item metadata (partner CSV uses token id 0–1439). */
export function minuteIndexFromProjectItem(item, fallbackIndex) {
  const raw = item?.featuresJson
  if (raw != null && raw !== '') {
    try {
      const f = typeof raw === 'string' ? JSON.parse(raw) : raw
      const candidates = [
        f.tokenId,
        f.token_id,
        f.minuteIndex,
        f.minute,
        f.$custom_token_id,
        f.custom_token_id
      ]
      for (const c of candidates) {
        if (c == null || c === '') continue
        const n = Number(c)
        if (Number.isFinite(n)) return normalizeMinuteIndex(n)
      }
    } catch {
      /* ignore malformed featuresJson */
    }
  }
  return normalizeMinuteIndex(fallbackIndex)
}

/**
 * Build lookup tables for artist-curated user-selection projects.
 * Items are matched to minutes via featuresJson when present, else stable list order.
 */
export function buildProjectItemIndex(items) {
  const list = Array.isArray(items) ? items : []
  const itemByMinute = new Map()
  const minuteByItemId = new Map()
  const soldMinutes = new Set()

  list.forEach((item, listIndex) => {
    if (!item?.id) return
    const minute = minuteIndexFromProjectItem(item, listIndex)
    itemByMinute.set(minute, item)
    minuteByItemId.set(item.id, minute)
    if (item.isAvailable === false) soldMinutes.add(minute)
  })

  const mintableMinutes = [...itemByMinute.keys()].sort((a, b) => a - b)
  const mintableMin = mintableMinutes.length > 0 ? mintableMinutes[0] : null
  const mintableMax =
    mintableMinutes.length > 0 ? mintableMinutes[mintableMinutes.length - 1] : null

  return {
    itemByMinute,
    minuteByItemId,
    soldMinutes,
    mintableMinutes,
    mintableMin,
    mintableMax,
    itemCount: list.length
  }
}
