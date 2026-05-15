#!/usr/bin/env node
/**
 * Full partner bundle: PNG thumbnails + import CSV.
 *
 * Usage:
 *   PARTNER_ANIMATION_BASE_URL='https://arweave.net/…?tokenId=' npm run export:partner
 *
 * Skips capture when PARTNER_CSV_ONLY=1; skips CSV when PARTNER_THUMBNAILS_ONLY=1.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function runNode(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      stdio: 'inherit',
      env: process.env
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${scriptName} exited with code ${code}`))
    })
  })
}

const csvOnly = process.env.PARTNER_CSV_ONLY === '1'
const thumbsOnly = process.env.PARTNER_THUMBNAILS_ONLY === '1'
const buildArweave = process.env.PARTNER_SKIP_ARWEAVE_BUILD !== '1'

if (buildArweave && !process.env.PARTNER_ARWEAVE_ALREADY_BUILT) {
  await runNode('bundle-arweave-animation.mjs')
}

if (!csvOnly) {
  await runNode('capture-partner-thumbnails.mjs')
}
if (!thumbsOnly) {
  await runNode('generate-partner-csv.mjs')
}

console.log('Partner export complete.')
