import { useWallet } from "@aptos-labs/wallet-adapter-react";

type SidebarProps = {
  activeTab: "chat" | "policies" | "claims";
  setActiveTab: (tab: "chat" | "policies" | "claims") => void;
};

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { account } = useWallet();

  // Helper function to format address safely
  const formatAddress = (address: any): string => {
    if (!address) return 'Not Connected';
    
    if (typeof address === 'string') {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    
    if (address.data && Array.isArray(address.data)) {
      const hexString = Array.from(address.data)
        .map(b => (typeof b === 'number' ? b.toString(16).padStart(2, '0') : ''))
        .join('');
      return `0x${hexString.slice(0, 6)}...${hexString.slice(-4)}`;
    }
    
    return 'Unknown';
  };

  return (
    <div className="backdrop-blur-xl bg-black/40 rounded-2xl border border-white/15 shadow-2xl overflow-hidden transition-all duration-300 hover:border-white/20">
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cora-primary via-cora-secondary to-cora-light flex items-center justify-center shadow-lg">
            <span className="text-cora-dark font-bold text-xl">C</span>
          </div>
          <div>
            <h2 className="font-bold text-2xl text-cora-light tracking-tight">Cora</h2>
            <p className="text-cora-gray text-sm">Your AI Insurance Partner</p>
          </div>
        </div>
        
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-cora-light font-semibold">Your Wallet</h3>
            <span className="px-3 py-1 bg-green-900/40 text-green-300 text-xs rounded-full font-medium border border-green-800/50 shadow-inner">Active</span>
          </div>
          <div className="bg-black/50 rounded-xl p-5 border border-white/10 shadow-inner transition-all duration-300 hover:border-white/15">
            <p className="text-cora-gray text-sm mb-2 font-medium">Connected Address</p>
            <p className="text-cora-light font-mono text-sm truncate bg-black/30 p-2 rounded-lg border border-white/5">
              {formatAddress(account?.address)}
            </p>
          </div>
        </div>
        
        <div className="space-y-3 mb-10">
          <h3 className="text-cora-light font-semibold mb-4">Navigation</h3>
          <button 
            onClick={() => setActiveTab("chat")}
            className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all duration-300 ${
              activeTab === "chat" 
                ? "bg-gradient-to-r from-cora-primary to-cora-secondary text-cora-light shadow-lg shadow-cora-primary/20" 
                : "hover:bg-white/10 text-cora-gray hover:translate-x-1"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Chat with Cora</span>
          </button>
          <button 
            onClick={() => setActiveTab("policies")}
            className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all duration-300 ${
              activeTab === "policies" 
                ? "bg-gradient-to-r from-cora-primary to-cora-secondary text-cora-light shadow-lg shadow-cora-primary/20" 
                : "hover:bg-white/10 text-cora-gray hover:translate-x-1"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
              <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <span className="font-medium">My Policies</span>
          </button>
          <button 
            onClick={() => setActiveTab("claims")}
            className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all duration-300 ${
              activeTab === "claims" 
                ? "bg-gradient-to-r from-cora-primary to-cora-secondary text-cora-light shadow-lg shadow-cora-primary/20" 
                : "hover:bg-white/10 text-cora-gray hover:translate-x-1"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">File a Claim</span>
          </button>
        </div>
        
        <div>
          <h3 className="text-cora-light font-semibold mb-4">Resources</h3>
          <div className="space-y-3 bg-black/30 rounded-xl p-3 border border-white/5">
            <a href="#" className="block text-cora-gray hover:text-cora-primary transition-all duration-200 text-sm py-2 px-3 rounded-lg hover:bg-black/30">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Insurance FAQ
              </span>
            </a>
            <a href="#" className="block text-cora-gray hover:text-cora-primary transition-all duration-200 text-sm py-2 px-3 rounded-lg hover:bg-black/30">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Policy Terms
              </span>
            </a>
            <a href="#" className="block text-cora-gray hover:text-cora-primary transition-all duration-200 text-sm py-2 px-3 rounded-lg hover:bg-black/30">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                Contact Support
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 