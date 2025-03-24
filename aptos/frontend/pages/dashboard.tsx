import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { WalletProvider, NetworkName } from '@aptos-labs/wallet-adapter-react';
import { PetraWallet } from 'petra-plugin-wallet-adapter';
import { MartianWallet } from '@martianwallet/aptos-wallet-adapter';
import { PontemWallet } from '@pontem/wallet-adapter-plugin';
import { RiseWallet } from '@rise-wallet/wallet-adapter';
import { Dashboard } from '../components/dashboard/Dashboard';

const wallets = [
  new PetraWallet(),
  new MartianWallet(),
  new PontemWallet(),
  new RiseWallet()
];

export default function DashboardPage() {
  const router = useRouter();
  
  return (
    <WalletProvider
      wallets={wallets}
      autoConnect={true}
      network={NetworkName.TESTNET}
    >
      <Dashboard />
    </WalletProvider>
  );
} 