#!/usr/bin/env node
/**
 * Bundle a self-contained HTML file for Arweave upload.
 * Runtime reads ?tokenId=N from the page URL (no Solidity placeholder).
 *
 * Output:
 *   public/generated/arweave-animation.inline.min.html
 *   out/partner-export/arweave-animation.html  (upload this file)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { minify } from 'html-minifier-terser'
import { build } from 'esbuild'
import { minify as minifyJs } from 'terser'
import { MINT_SITE_ROOT, partnerOutputDir } from './lib/partner-export-config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = MINT_SITE_ROOT

const inputPath = path.join(root, 'public', 'arweave-animation.html')
const generatedPath = path.join(root, 'public', 'generated', 'arweave-animation.inline.min.html')
const uploadPath = path.join(partnerOutputDir(), 'arweave-animation.html')

const html = await readFile(inputPath, 'utf8')
const moduleScriptMatch = html.match(/<script\s+type=["']module["']>([\s\S]*?)<\/script>/i)
if (!moduleScriptMatch) {
  throw new Error('Could not find <script type="module"> block in arweave-animation.html')
}

const normalizedImports = moduleScriptMatch[1].replaceAll("from '/src/", "from './src/")
const bundleResult = await build({
  stdin: {
    contents: normalizedImports,
    resolveDir: root,
    sourcefile: 'arweave-animation.entry.js',
    loader: 'js'
  },
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020']
})

let bundledJs = bundleResult.outputFiles[0].text
const terserResult = await minifyJs(bundledJs, {
  compress: { ecma: 2020, passes: 2 },
  mangle: true,
  ecma: 2020,
  format: { comments: false }
})
if (terserResult.error) throw terserResult.error
if (!terserResult.code) throw new Error('Terser returned empty output')
bundledJs = terserResult.code

const htmlWithInlineScript = html.replace(moduleScriptMatch[0], `<script>${bundledJs}</script>`)
const minified = await minify(htmlWithInlineScript, {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: false,
  sortAttributes: true,
  sortClassName: true
})

await mkdir(path.dirname(generatedPath), { recursive: true })
await mkdir(partnerOutputDir(), { recursive: true })
await writeFile(generatedPath, `${minified}\n`, 'utf8')
await writeFile(uploadPath, `${minified}\n`, 'utf8')

const bytes = Buffer.byteLength(minified, 'utf8')
console.log('Arweave animation HTML bundled (esbuild + terser + html minify).')
console.log(`- Generated: ${path.relative(root, generatedPath)}`)
console.log(`- Upload:    ${path.relative(root, uploadPath)}`)
console.log(`- Size:      ${bytes} bytes (${(bytes / 1024).toFixed(1)} KiB)`)
console.log('')
console.log('Upload the file above to Arweave, then:')
console.log('  PARTNER_ARWEAVE_TX_ID=<txid> npm run export:partner:csv')
console.log('Each CSV animation_url will be https://arweave.net/<txid>?tokenId=<n>')
