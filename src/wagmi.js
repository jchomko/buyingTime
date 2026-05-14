import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets'
import { http } from 'viem'
import { hardhat, mainnet, sepolia } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo'
const appName = 'Buying Time'
// MetaMask will refuse to connect if the wallet's current chain isn't in this list.
// Include Sepolia when using VITE_CHAIN_ID=11155111 against a testnet deployment.
const chains = [mainnet, sepolia, hardhat]

const rpcUrl = (import.meta.env.VITE_RPC_URL || '').trim()
const sepoliaRpcOverride = (import.meta.env.VITE_SEPOLIA_RPC_URL || '').trim()
const mainnetRpcOverride = (import.meta.env.VITE_MAINNET_RPC_URL || '').trim()
const expectedChainId = Number.parseInt(
  (import.meta.env.VITE_CHAIN_ID || '31337').trim(),
  10
)

/** viem's built-in Sepolia default is thirdweb's public RPC (tight limits, flaky CORS under 429). */
const SEPOLIA_HTTP_FALLBACK = 'https://rpc.sepolia.org'

const sepoliaHttp =
  sepoliaRpcOverride ||
  (expectedChainId === sepolia.id && rpcUrl ? rpcUrl : '') ||
  SEPOLIA_HTTP_FALLBACK

const hardhatHttp =
  expectedChainId === hardhat.id && rpcUrl ? rpcUrl : 'http://127.0.0.1:8545'

export const wagmiConfig = getDefaultConfig({
  appName,
  projectId,
  chains,
  wallets: [
    {
      groupName: 'Ethereum',
      wallets: [
        metaMaskWallet,
        walletConnectWallet
      ]
    }
  ],
  transports: {
    [mainnet.id]: http(mainnetRpcOverride || undefined),
    [sepolia.id]: http(sepoliaHttp),
    [hardhat.id]: http(hardhatHttp)
  },
  ssr: false
})
