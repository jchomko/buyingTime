import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { minify } from "html-minifier-terser"
import { build } from "esbuild"
import { minify as minifyJs } from "terser"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const inputPath = path.join(root, "public", "unified-clock-shell.html")
const outDir = path.join(root, "public", "generated")
const minHtmlPath = path.join(outDir, "unified-clock-shell.inline.min.html")

const html = await readFile(inputPath, "utf8")
const moduleScriptMatch = html.match(/<script\s+type=["']module["']>([\s\S]*?)<\/script>/i)
if (!moduleScriptMatch) {
  throw new Error("Could not find <script type='module'> block in unified-clock-shell.html")
}

const normalizedImports = moduleScriptMatch[1].replaceAll("from '/src/", "from './src/")
const bundleResult = await build({
  stdin: {
    contents: normalizedImports,
    resolveDir: root,
    sourcefile: "unified-clock-shell.entry.js",
    loader: "js"
  },
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"]
})
let bundledJs = bundleResult.outputFiles[0].text
const terserResult = await minifyJs(bundledJs, {
  compress: { ecma: 2020, passes: 2 },
  ecma: 2020,
  format: { comments: false }
})
if (terserResult.error) {
  throw terserResult.error
}
if (!terserResult.code) {
  throw new Error("Terser returned empty output")
}
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

await mkdir(outDir, { recursive: true })
await writeFile(minHtmlPath, `${minified}\n`, "utf8")

const bytes = Buffer.byteLength(minified, "utf8")
console.log("Unified clock shell bundled (esbuild + terser + html minify).")
console.log(`- Output: ${path.relative(root, minHtmlPath)}`)
console.log(`- Total size: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KiB)`)
