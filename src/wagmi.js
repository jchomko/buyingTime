import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets'
import { hardhat, mainnet, sepolia } from 'wagmi/chains'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo'
const appName = 'Buying Time'
// MetaMask will refuse to connect if the wallet's current chain isn't in this list.
// Include Sepolia when using VITE_CHAIN_ID=11155111 against a testnet deployment.
const chains = [mainnet, sepolia, hardhat]

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
  ssr: false
})
