import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MINT_SITE_ROOT = path.resolve(__dirname, '../..')

let didLoad = false

/**
 * Load mint-site/.env and .env.local into process.env (Node scripts do not use Vite's env loading).
 * Does not override variables already set in the environment.
 */
export function loadMintEnv() {
  if (didLoad) return
  didLoad = true
  for (const file of ['.env', '.env.local']) {
    const abs = path.join(MINT_SITE_ROOT, file)
    if (!existsSync(abs)) continue
    let text
    try {
      text = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    for (let line of text.split(/\r?\n/)) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue
      if (line.toLowerCase().startsWith('export ')) line = line.slice(7).trim()
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      if (!key) continue
      let val = line.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
        (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}
