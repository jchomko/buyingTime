import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { minify } from "html-minifier-terser"
import { build } from "esbuild"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const inputPath = path.join(root, "public", "embed-preview.html")
const outDir = path.join(root, "public", "generated")
const minHtmlPath = path.join(outDir, "embed-preview.inline.min.html")

const html = await readFile(inputPath, "utf8")
const moduleScriptMatch = html.match(/<script\s+type=["']module["']>([\s\S]*?)<\/script>/i)
if (!moduleScriptMatch) {
  throw new Error("Could not find <script type='module'> block in embed-preview.html")
}

const tokenBlockPattern =
  /const params =[\s\S]*?const selectedMinute = normalizeMinuteIndex\(tokenId % TOTAL_SQUARES\)\n/
const moduleSourceWithTokenPlaceholder = moduleScriptMatch[1].replace(
  tokenBlockPattern,
  `const tokenId = __TOKEN_ID__\nconst selectedMinute = normalizeMinuteIndex(tokenId % TOTAL_SQUARES)\n`
)
if (!moduleSourceWithTokenPlaceholder.includes("__TOKEN_ID__")) {
  throw new Error("Token placeholder insertion failed before bundling.")
}

const normalizedImports = moduleSourceWithTokenPlaceholder.replaceAll("from '/src/", "from './src/")
const bundleResult = await build({
  stdin: {
    contents: normalizedImports,
    resolveDir: root,
    sourcefile: "embed-preview.entry.js",
    loader: "js"
  },
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"]
})
const bundledJs = bundleResult.outputFiles[0].text
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

console.log("Embed preview bundled + minified.")
console.log(`- HTML: ${path.relative(root, minHtmlPath)}`)
