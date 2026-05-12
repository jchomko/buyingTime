import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { minify } from "html-minifier-terser"
import { build } from "esbuild"
import { minify as minifyJs } from "terser"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const inputPath = path.join(root, "public", "embed-day-preview.html")
const outDir = path.join(root, "public", "generated")
const minHtmlPath = path.join(outDir, "embed-day-preview.inline.min.html")

const html = await readFile(inputPath, "utf8")
const moduleScriptMatch = html.match(/<script\s+type=["']module["']>([\s\S]*?)<\/script>/i)
if (!moduleScriptMatch) {
  throw new Error("Could not find <script type='module'> block in embed-day-preview.html")
}

const normalizedImports = moduleScriptMatch[1].replaceAll("from '/src/", "from './src/")
const bundleResult = await build({
  stdin: {
    contents: normalizedImports,
    resolveDir: root,
    sourcefile: "embed-day-preview.entry.js",
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
  mangle: true,
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

console.log("Embed day preview bundled + minified (esbuild + terser).")
console.log(`- HTML: ${path.relative(root, minHtmlPath)}`)
