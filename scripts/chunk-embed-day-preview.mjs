import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const inputPath = path.join(root, "public", "generated", "embed-day-preview.inline.min.html")
const outDir = path.join(root, "public", "generated")
const outPath = path.join(outDir, "embed-day-preview.sol-chunks.txt")

const html = await readFile(inputPath, "utf8")

const chunkSize = 900
const toChunks = (text) => {
  const chunks = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

const escapeSol = (s) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n")

const quotedLines = (text) =>
  toChunks(text)
    .map((c) => `                "${escapeSol(c)}",`)
    .join("\n")

const normalizedQuotes = html.replace(/"/g, "'")

const output = `// Paste into your contract body and adjust indentation if desired.
// Live local clock: single hull, no labels (canvas only).
function buildDayAnimationHTML() public pure returns (string memory) {
    return string(
        abi.encodePacked(
${quotedLines(normalizedQuotes)}
        )
    );
}
`

await mkdir(outDir, { recursive: true })
await writeFile(outPath, output, "utf8")

console.log("Generated Solidity chunks for day embed HTML.")
console.log(`- ${path.relative(root, outPath)}`)
