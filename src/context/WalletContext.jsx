import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect, useWatchContractEvent } from 'wagmi'
import { readPurchasedTokenIds } from '../lib/readPurchasedTokenIds.js'
import { TOTAL_SQUARES } from '../timeGrid.js'
import { WalletContext } from './WalletContextValue.js'

/** Matches `BuyingTime.sol`: `event Mint(address buyer, uint256 price, uint256 tokenId)` */
const BUYING_TIME_MINT_EVENT_ABI = [
  {
    type: 'event',
    name: 'Mint',
    inputs: [
      { name: 'buyer', type: 'address', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'tokenId', type: 'uint256', indexed: false }
    ]
  }
]

export function WalletProvider({ children }) {
  const { address, isConnected, isConnecting, status } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  const walletAccount = isConnected && address ? address : null
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletError, setWalletError] = useState(null)
  const soldMinuteIndicesRef = useRef(new Set())
  const rpcUrl = (import.meta.env.VITE_RPC_URL || '').trim()
  const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS || '').trim()
  const expectedChainId = useMemo(() => {
    const raw = (import.meta.env.VITE_CHAIN_ID || '31337').trim()
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? n : 31337
  }, [])

  const fetchSoldIntoRef = useCallback(async () => {
    if (!rpcUrl || !contractAddress) {
      throw new Error('Add VITE_RPC_URL and VITE_CONTRACT_ADDRESS to .env for on-chain sold state')
    }
    const raw = await readPurchasedTokenIds({ rpcUrl, contractAddress })
    const next = new Set()
    for (const id of raw) {
      if (!Number.isFinite(id)) continue
      next.add(((id % TOTAL_SQUARES) + TOTAL_SQUARES) % TOTAL_SQUARES)
    }
    soldMinuteIndicesRef.current = next
  }, [rpcUrl, contractAddress])

  const refetchSoldSilent = useCallback(() => {
    fetchSoldIntoRef().catch(() => {})
  }, [fetchSoldIntoRef])

  const getSoldMinuteIndices = useCallback(() => {
    return soldMinuteIndicesRef.current
  }, [])

  const disconnectWallet = useCallback(() => {
    disconnect()
    setWalletError(null)
  }, [disconnect])

  const connectWallet = useCallback(async () => {
    setWalletError(null)
    if (walletAccount) return
    if (!openConnectModal) {
      setWalletError('Connect modal unavailable. Please refresh and try again.')
      return
    }
    openConnectModal()
  }, [walletAccount, openConnectModal])

  const refreshSold = useCallback(async () => {
    setWalletError(null)
    setWalletBusy(true)
    try {
      await fetchSoldIntoRef()
    } catch (e) {
      setWalletError(e?.message || String(e))
    } finally {
      setWalletBusy(false)
    }
  }, [fetchSoldIntoRef])

  useEffect(() => {
    if (rpcUrl && contractAddress) {
      setWalletBusy(true)
      fetchSoldIntoRef()
        .catch((e) => setWalletError(e?.message || String(e)))
        .finally(() => setWalletBusy(false))
    } else {
      setWalletError('Set VITE_RPC_URL and VITE_CONTRACT_ADDRESS to load sold pieces.')
    }
  }, [rpcUrl, contractAddress, fetchSoldIntoRef])

  useWatchContractEvent({
    address: contractAddress || undefined,
    abi: BUYING_TIME_MINT_EVENT_ABI,
    eventName: 'Mint',
    chainId: expectedChainId,
    enabled: Boolean(contractAddress && rpcUrl),
    onLogs: refetchSoldSilent
  })

  /** Keep gallery sale dots in sync without toggling walletBusy or overwriting errors. */
  useEffect(() => {
    if (!rpcUrl || !contractAddress) return

    const silentRefetch = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      refetchSoldSilent()
    }

    const intervalMs = 15000
    const id = window.setInterval(silentRefetch, intervalMs)

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') silentRefetch()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', silentRefetch)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', silentRefetch)
    }
  }, [rpcUrl, contractAddress, refetchSoldSilent])

  const isWagmiBusy = isConnecting || status === 'reconnecting'

  const value = useMemo(
    () => ({
      walletAccount,
      walletBusy: walletBusy || isWagmiBusy,
      walletError,
      rpcUrl,
      contractAddress,
      connectWallet,
      disconnectWallet,
      refreshSold,
      getSoldMinuteIndices
    }),
    [
      walletAccount,
      walletBusy,
      isWagmiBusy,
      walletError,
      rpcUrl,
      contractAddress,
      connectWallet,
      disconnectWallet,
      refreshSold,
      getSoldMinuteIndices
    ]
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
