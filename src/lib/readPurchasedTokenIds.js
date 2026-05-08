/**
 * Read minted / purchased token IDs from an ERC-721-style contract via HTTP RPC.
 * Uses a dynamic ethers import so Vite and static HTML pages can share this
 * without bundling ethers into the main chunk when unused.
 */
export async function readPurchasedTokenIds({
  rpcUrl,
  contractAddress,
  strategy = 'auto',
  maxEnumerable = 1440
}) {
  const { ethers } = await import('https://esm.sh/ethers@6')
  const provider = new ethers.JsonRpcProvider(rpcUrl)

  const abi = [
    'function getSoldTokenOwners() view returns (uint256[] tokenIds, address[] owners)',
    'function totalSupply() view returns (uint256)',
    'function tokenByIndex(uint256) view returns (uint256)'
  ]
  const c = new ethers.Contract(contractAddress, abi, provider)

  async function trySoldTokenOwners() {
    try {
      const out = await c.getSoldTokenOwners()
      const tokenIds = out?.[0] || out?.tokenIds || []
      return tokenIds.map((v) => Number(v))
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
    const list = await trySoldTokenOwners()
    if (!list) throw new Error('No list-returning token method found')
    return list
  }

  if (strategy === 'enumerable-only') {
    return await tryEnumerable()
  }

  const list = await trySoldTokenOwners()
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

/**
 * Resolve owner display label for a token:
 * - "Not minted" when ownerOf reverts
 * - "<name>.eth" when ENS exists
 * - raw address otherwise
 */
export async function readTokenOwnerDisplay({
  rpcUrl,
  contractAddress,
  tokenId,
  ensRpcUrl = 'https://cloudflare-eth.com'
}) {
  const address = await readTokenOwner({ rpcUrl, contractAddress, tokenId })
  if (!address) return 'Not minted'

  try {
    const { ethers } = await import('https://esm.sh/ethers@6')
    const ensProvider = new ethers.JsonRpcProvider(ensRpcUrl)
    const name = await ensProvider.lookupAddress(address)
    if (name && typeof name === 'string') return name
  } catch {
    // Ignore ENS lookup failures and fall back to address.
  }

  return address
}

/** Submit mintInvite(tokenId) using the currently connected wallet. */
export async function mintInvite({ contractAddress, tokenId }) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('Wallet provider not found. Install MetaMask (or compatible wallet).')
  }

  const { ethers } = await import('https://esm.sh/ethers@6')
  const injected = window.ethereum
  const providers = Array.isArray(injected?.providers) ? injected.providers : []
  const selectedProvider =
    providers.find(
      (p) =>
        p?.isMetaMask &&
        !p?.isTemple &&
        !p?.isCoinbaseWallet &&
        !p?.isRabby &&
        !p?.isFrame &&
        !p?.isTrust
    ) ||
    providers.find((p) => p?.isMetaMask) ||
    injected
  const provider = new ethers.BrowserProvider(selectedProvider)
  const signer = await provider.getSigner()
  const contract = new ethers.Contract(
    contractAddress,
    [
      'function pricePerPiece() view returns (uint256)',
      'function mintInvite(uint256 tokenId) payable returns (uint256)'
    ],
    signer
  )

  const value = await contract.pricePerPiece()
  const tx = await contract.mintInvite(tokenId, { value })
  await tx.wait()
  return tx.hash
}
