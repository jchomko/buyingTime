import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { anvil, localhost, mainnet } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo'

export const wagmiConfig = getDefaultConfig({
  appName: 'Buying Time',
  projectId,
  // Support both mainnet and common local RPC setups (MetaMask will refuse to connect
  // if the current chain isn't included in Wagmi's allowed list).
  chains: [mainnet, localhost, anvil],
  ssr: false
})
