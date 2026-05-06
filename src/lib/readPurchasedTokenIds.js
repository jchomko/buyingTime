/**
 * Read minted / purchased token IDs from an ERC-721-style contract via HTTP RPC.
 * Uses a dynamic ethers import so Vite and static HTML pages can share this
 * without bundling ethers into the main chunk when unused.
 */
export async function readPurchasedTokenIds({
  rpcUrl,
  contractAddress,
  strategy = 'auto',
  maxEnumerable = 5000
}) {
  const { ethers } = await import('https://esm.sh/ethers@6')
  const provider = new ethers.JsonRpcProvider(rpcUrl)

  const abi = [
    'function getPurchasedTokenIds() view returns (uint256[])',
    'function purchasedTokenIds() view returns (uint256[])',
    'function mintedTokenIds() view returns (uint256[])',
    'function totalSupply() view returns (uint256)',
    'function tokenByIndex(uint256) view returns (uint256)'
  ]
  const c = new ethers.Contract(contractAddress, abi, provider)

  async function tryListMethod(name) {
    try {
      const out = await c[name]()
      return (out || []).map((v) => Number(v))
    } catch {
      return null
    }
  }

  async function tryEnumerable() {
    const supply = Number(await c.totalSupply())
    const lim = Math.min(supply, maxEnumerable)
    const ids = []
    for (let i = 0; i < lim; i++) {
      ids.push(Number(await c.tokenByIndex(i)))
    }
    return ids
  }

  if (strategy === 'list-only') {
    const list =
      (await tryListMethod('getPurchasedTokenIds')) ??
      (await tryListMethod('purchasedTokenIds')) ??
      (await tryListMethod('mintedTokenIds'))
    if (!list) throw new Error('No list-returning purchased-token method found')
    return list
  }

  if (strategy === 'enumerable-only') {
    return await tryEnumerable()
  }

  const list =
    (await tryListMethod('getPurchasedTokenIds')) ??
    (await tryListMethod('purchasedTokenIds')) ??
    (await tryListMethod('mintedTokenIds'))
  if (list) return list
  return await tryEnumerable()
}

/** ERC-721 `ownerOf`. Returns `null` if the call reverts (e.g. not minted). */
export async function readTokenOwner({ rpcUrl, contractAddress, tokenId }) {
  const { ethers } = await import('https://esm.sh/ethers@6')
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const c = new ethers.Contract(
    contractAddress,
    ['function ownerOf(uint256 tokenId) view returns (address)'],
    provider
  )
  try {
    const a = await c.ownerOf(tokenId)
    return typeof a === 'string' ? a : String(a)
  } catch {
    return null
  }
}
