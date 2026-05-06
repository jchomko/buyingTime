import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..")

const inputPath = path.join(root, "public", "generated", "embed-preview.inline.min.html")
const outDir = path.join(root, "public", "generated")
const outPath = path.join(outDir, "embed-preview.sol-chunks.txt")

const html = await readFile(inputPath, "utf8")
if (!html.includes("__TOKEN_ID__")) {
  throw new Error("Token placeholder insertion failed. Expected __TOKEN_ID__ marker.")
}

const normalizedQuotes = html.replace(/"/g, "'")
const [before, after] = normalizedQuotes.split("__TOKEN_ID__")

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

const output = `// Paste into your contract body and adjust indentation if desired.
function buildAnimationHTML(uint256 tokenId) public pure returns (string memory) {
    return string(
        abi.encodePacked(
${quotedLines(before)}
                toString(tokenId),
${quotedLines(after)}
        )
    );
}
`

await mkdir(outDir, { recursive: true })
await writeFile(outPath, output, "utf8")

console.log("Generated Solidity chunks for embed HTML.")
console.log(`- ${path.relative(root, outPath)}`)
