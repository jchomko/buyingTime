import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets'
import { hardhat, mainnet } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo'
const appName = 'Buying Time'
const chains = [mainnet, hardhat]

export const wagmiConfig = getDefaultConfig({
  appName,
  projectId,
  // Support both mainnet and common local RPC setups (MetaMask will refuse to connect
  // if the current chain isn't included in Wagmi's allowed list).
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
  ssr: false
})
