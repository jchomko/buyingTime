#!/usr/bin/env node
/**
 * Write partner-import.csv for third-party front-end upload.
 *
 * Required: PARTNER_ARWEAVE_TX_ID and/or PARTNER_ANIMATION_BASE_URL / PARTNER_ANIMATION_URL_TEMPLATE
 * (put these in mint-site/.env — Node loads it via partner-export-config, unlike Vite-only vars)
 * Optional: PARTNER_OUTPUT_DIR, PARTNER_CSV_PATH, PARTNER_TOKEN_START, PARTNER_TOKEN_END
 */
import { mkdir, writeFile } from 'node:fs/promises'
import {
  animationUrlForToken,
  customTitle,
  parseTokenRange,
  partnerCsvPath,
  partnerOutputDir,
  pngFilename
} from './lib/partner-export-config.mjs'

function csvEscape(value) {
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function csvRow(cells) {
  return cells.map(csvEscape).join(',')
}

const { start, end } = parseTokenRange()
const outDir = partnerOutputDir()
const csvPath = partnerCsvPath()

await mkdir(outDir, { recursive: true })

const lines = [
  csvRow(['filename', '$custom_title', '$custom_token_id', 'animation_url'])
]

for (let tokenId = start; tokenId <= end; tokenId++) {
  lines.push(
    csvRow([
      pngFilename(tokenId),
      customTitle(tokenId),
      tokenId,
      animationUrlForToken(tokenId)
    ])
  )
}

await writeFile(csvPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`Wrote ${lines.length - 1} rows to ${csvPath}`)
