#!/usr/bin/env node
/**
 * Capture first-frame PNGs (second 0) for each Buying Time token.
 *
 * Prereqs:
 *   npm install
 *   npx playwright install chromium
 *
 * Start Vite (or set PARTNER_CAPTURE_BASE_URL to a running dev/preview server):
 *   npm run dev
 *
 * Then:
 *   node ./scripts/capture-partner-thumbnails.mjs
 *
 * Env: PARTNER_OUTPUT_DIR, PARTNER_CAPTURE_SIZE, PARTNER_CAPTURE_BASE_URL,
 *      PARTNER_TOKEN_START, PARTNER_TOKEN_END, PARTNER_SKIP_EXISTING=1,
 *      PARTNER_CONCURRENCY (default 4)
 */
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import {
  capturePageUrl,
  captureSize,
  parseTokenRange,
  partnerImagesDir,
  pngFilename
} from './lib/partner-export-config.mjs'

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function waitForServer(baseUrl, timeoutMs = 90_000) {
  const probe = `${baseUrl.replace(/\/$/, '')}/partner-thumbnail.html?tokenId=0&size=64`
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(probe)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(
    `Capture server not reachable at ${baseUrl}. Run "npm run dev" in mint-site or set PARTNER_CAPTURE_BASE_URL.`
  )
}

const { start, end } = parseTokenRange()
const imagesDir = partnerImagesDir()
const size = captureSize()
const baseUrl = process.env.PARTNER_CAPTURE_BASE_URL || 'http://127.0.0.1:5173'
const skipExisting = process.env.PARTNER_SKIP_EXISTING === '1'
const concurrency = Math.max(1, Number(process.env.PARTNER_CONCURRENCY || 4) | 0)

await mkdir(imagesDir, { recursive: true })
await waitForServer(baseUrl)

const tokenIds = []
for (let tokenId = start; tokenId <= end; tokenId++) {
  const outPath = path.join(imagesDir, pngFilename(tokenId))
  if (skipExisting && (await fileExists(outPath))) continue
  tokenIds.push(tokenId)
}

if (tokenIds.length === 0) {
  console.log('All thumbnails already exist; nothing to capture.')
  process.exit(0)
}

console.log(
  `Capturing ${tokenIds.length} PNGs (${size}×${size}) → ${imagesDir} (concurrency ${concurrency})`
)

const browser = await chromium.launch({ headless: true })
let nextIndex = 0
let done = 0
let failed = 0

async function worker() {
  const context = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1
  })
  const page = await context.newPage()

  while (true) {
    const i = nextIndex++
    if (i >= tokenIds.length) break
    const tokenId = tokenIds[i]
    const outPath = path.join(imagesDir, pngFilename(tokenId))
    const url = capturePageUrl(tokenId)

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 60_000 })
      await page.waitForFunction(() => window.__CAPTURE_READY__ === true, null, {
        timeout: 60_000
      })
      await page.locator('#preview-canvas').screenshot({ path: outPath, type: 'png' })
      done++
      if (done % 50 === 0 || done === tokenIds.length) {
        console.log(`  ${done}/${tokenIds.length} (${pngFilename(tokenId)})`)
      }
    } catch (err) {
      failed++
      console.error(`  failed token ${tokenId}: ${err.message}`)
    }
  }

  await context.close()
}

const workers = Array.from({ length: Math.min(concurrency, tokenIds.length) }, () => worker())
await Promise.all(workers)
await browser.close()

console.log(`Done. ${done} saved, ${failed} failed.`)
if (failed > 0) process.exit(1)
