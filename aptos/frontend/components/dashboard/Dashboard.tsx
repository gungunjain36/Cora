import { useState, useEffect } from 'react';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import Link from 'next/link';
import { ClaimsTab } from './ClaimsTab';
import { PoliciesTab } from './PoliciesTab';
import { Toaster } from 'react-hot-toast';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('policies');
  const { account, connected } = useWallet();
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    // If connected, use the wallet address as the user ID
    if (connected && account?.address) {
      setUserId(account.address.toString());
    }
  }, [connected, account]);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'policies':
        return <PoliciesTab userId={userId} />;
      case 'claims':
        return <ClaimsTab userId={userId} />;
      default:
        return <PoliciesTab userId={userId} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-[#11021E] text-white pb-20">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="py-6 px-8 border-b border-white/10 backdrop-blur-md bg-black/30 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <img src="/logo.svg" alt="Cora Insurance" className="h-8 w-8 mr-3" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cora-primary to-purple-600 bg-clip-text text-transparent">Cora Insurance</h1>
          </Link>
          
          <div className="flex items-center gap-4">
            <WalletSelector />
          </div>
        </div>
      </header>
      
      {/* Dashboard Content */}
      <div className="container mx-auto px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Insurance Dashboard</h1>
            <p className="text-gray-400">Manage your policies and claims on the Aptos blockchain</p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mb-10 border-b border-white/10">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('policies')}
              className={`pb-4 relative ${
                activeTab === 'policies'
                  ? 'text-cora-primary font-medium'
                  : 'text-gray-400 hover:text-white transition-colors'
              }`}
            >
              Policies
              {activeTab === 'policies' && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cora-primary to-purple-600"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`pb-4 relative ${
                activeTab === 'claims'
                  ? 'text-cora-primary font-medium'
                  : 'text-gray-400 hover:text-white transition-colors'
              }`}
            >
              Claims
              {activeTab === 'claims' && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cora-primary to-purple-600"></span>
              )}
            </button>
          </div>
        </div>
        
        {/* Active Tab Content */}
        {renderActiveTab()}
      </div>
    </div>
  );
} 