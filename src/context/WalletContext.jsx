import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect } from 'wagmi'
import { readPurchasedTokenIds } from '../lib/readPurchasedTokenIds.js'
import { TOTAL_SQUARES } from '../timeGrid.js'
import { WalletContext } from './WalletContextValue.js'

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

  const fetchSoldIntoRef = useCallback(async () => {
    if (!rpcUrl || !contractAddress) {
      throw new Error('Add VITE_RPC_URL and VITE_CONTRACT_ADDRESS to .env for on-chain sold state')
    }
    const raw = await readPurchasedTokenIds({
      rpcUrl,
      contractAddress,
      strategy: 'auto'
    })
    const next = new Set()
    for (const id of raw) {
      if (!Number.isFinite(id)) continue
      next.add(((id % TOTAL_SQUARES) + TOTAL_SQUARES) % TOTAL_SQUARES)
    }
    soldMinuteIndicesRef.current = next
  }, [rpcUrl, contractAddress])

  const getSoldMinuteIndices = useCallback(() => {
    if (!walletAccount) return null
    return soldMinuteIndicesRef.current
  }, [walletAccount])

  const disconnectWallet = useCallback(() => {
    disconnect()
    setWalletError(null)
    soldMinuteIndicesRef.current = new Set()
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
    if (!walletAccount) return
    setWalletError(null)
    setWalletBusy(true)
    try {
      await fetchSoldIntoRef()
    } catch (e) {
      setWalletError(e?.message || String(e))
    } finally {
      setWalletBusy(false)
    }
  }, [walletAccount, fetchSoldIntoRef])

  useEffect(() => {
    if (!walletAccount) {
      soldMinuteIndicesRef.current = new Set()
      return
    }
    if (rpcUrl && contractAddress) {
      setWalletBusy(true)
      fetchSoldIntoRef()
        .catch((e) => setWalletError(e?.message || String(e)))
        .finally(() => setWalletBusy(false))
    } else {
      setWalletError('Connected — set VITE_RPC_URL and VITE_CONTRACT_ADDRESS to load sold pieces.')
    }
  }, [walletAccount, rpcUrl, contractAddress, fetchSoldIntoRef])

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
