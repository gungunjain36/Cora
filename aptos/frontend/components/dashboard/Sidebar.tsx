import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

type SidebarProps = {
  activeTab: "chat" | "policies" | "claims";
  setActiveTab: (tab: "chat" | "policies" | "claims") => void;
  sessionIds?: string[];
  currentSessionId?: string | null;
  onSessionChange?: (sessionId: string) => void;
  onSessionCreate?: (sessionId: string) => void;
  isCreatingSession?: boolean;
  userId?: string;
};

export function Sidebar({ 
  activeTab, 
  setActiveTab,
  sessionIds = [],
  currentSessionId = null,
  onSessionChange = () => {},
  onSessionCreate = () => {},
  isCreatingSession = false,
  userId = ""
}: SidebarProps) {
  const { account } = useWallet();
  const [showResources, setShowResources] = useState(false);
  const [showSessions, setShowSessions] = useState(true);

  // Helper function to format address safely
  const formatAddress = (address: any): string => {
    if (!address) return 'Not Connected';
    
    console.log("Formatting address:", address, "type:", typeof address);
    
    // Handle string address format (most common format from the wallet adapter)
    if (typeof address === 'string') {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    
    // Handle address object format with toString() method
    if (address.toString && typeof address.toString === 'function') {
      const addressStr = address.toString();
      console.log("Converted address using toString():", addressStr);
      return `${addressStr.slice(0, 6)}...${addressStr.slice(-4)}`;
    }
    
    // Handle raw bytes array format
    if (address.data && Array.isArray(address.data)) {
      const hexString = Array.from(address.data)
        .map(b => (typeof b === 'number' ? b.toString(16).padStart(2, '0') : ''))
        .join('');
      return `0x${hexString.slice(0, 6)}...${hexString.slice(-4)}`;
    }
    
    return 'Unknown';
  };

  // Format session ID to be more user-friendly
  const formatSessionId = (sessionId: string): string => {
    return sessionId.substring(0, 8);
  };

  return (
    <div className="h-full backdrop-blur-xl bg-black/40 rounded-2xl border border-white/15 shadow-2xl overflow-hidden transition-all duration-300 hover:border-white/20">
      <div className="h-full flex flex-col p-4 overflow-y-auto">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cora-primary via-cora-secondary to-cora-light flex items-center justify-center shadow-lg">
            <span className="text-cora-dark font-bold text-xl">C</span>
          </div>
          <div>
            <h2 className="font-bold text-xl text-cora-light tracking-tight">Cora</h2>
            <p className="text-cora-gray text-xs">Your AI Insurance Partner</p>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-cora-light font-semibold text-sm">Your Wallet</h3>
            <span className="px-2 py-0.5 bg-green-900/40 text-green-300 text-xs rounded-full font-medium border border-green-800/50 shadow-inner">Active</span>
          </div>
          <div className="bg-black/50 rounded-xl p-3 border border-white/10 shadow-inner transition-all duration-300 hover:border-white/15">
            <p className="text-cora-gray text-xs mb-1 font-medium">Connected Address</p>
            <p className="text-cora-light font-mono text-xs truncate bg-black/30 p-2 rounded-lg border border-white/5">
              {formatAddress(account?.address)}
            </p>
          </div>
        </div>
        
        {activeTab === "chat" && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-cora-light font-semibold text-sm">Chat Sessions</h3>
              <div className="flex items-center">
                <button 
                  onClick={() => setShowSessions(!showSessions)}
                  className="text-cora-gray hover:text-cora-primary text-xs flex items-center mr-2"
                  aria-label={showSessions ? "Hide sessions" : "Show sessions"}
                  title={showSessions ? "Hide sessions" : "Show sessions"}
                >
                  {showSessions ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => onSessionCreate(userId)}
                  disabled={isCreatingSession}
                  className="text-xs text-cora-primary hover:text-cora-light bg-cora-primary/10 hover:bg-cora-primary/30 px-2 py-0.5 rounded transition-colors"
                  title="Create new chat session"
                  aria-label="Create new chat session"
                >
                  {isCreatingSession ? 'Creating...' : 'New'}
                </button>
              </div>
            </div>
            
            {showSessions && (
              <div className="space-y-1 max-h-36 overflow-y-auto bg-black/30 rounded-xl p-2 border border-white/5 text-xs animate-fadeIn">
                {sessionIds.map((sessionId) => (
                  <button
                    key={sessionId}
                    onClick={() => onSessionChange(sessionId)}
                    className={`w-full text-left p-2 rounded-md transition-colors ${
                      sessionId === currentSessionId
                        ? 'bg-cora-primary/20 text-white'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{formatSessionId(sessionId)}</span>
                      {sessionId === currentSessionId && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-cora-primary text-cora-light">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                
                {sessionIds.length === 0 && (
                  <div className="text-center text-xs text-gray-400 py-2">
                    No sessions found
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-2 mb-6">
          <h3 className="text-cora-light font-semibold text-sm mb-2">Navigation</h3>
          <button 
            onClick={() => setActiveTab("chat")}
            className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-300 ${
              activeTab === "chat" 
                ? "bg-cora-primary text-cora-light shadow-lg shadow-cora-primary/20" 
                : "hover:bg-white/10 text-cora-gray hover:translate-x-1"
            }`}
            aria-label="Chat with Cora"
            title="Chat with Cora"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-sm">Chat with Cora</span>
          </button>
          <button 
            onClick={() => setActiveTab("policies")}
            className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-300 ${
              activeTab === "policies" 
                ? "bg-cora-primary text-cora-light shadow-lg shadow-cora-primary/20" 
                : "hover:bg-white/10 text-cora-gray hover:translate-x-1"
            }`}
            aria-label="My Policies"
            title="My Policies"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
              <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <span className="font-medium text-sm">My Policies</span>
          </button>
          <button 
            onClick={() => setActiveTab("claims")}
            className={`w-full flex items-center space-x-3 p-3 rounded-xl transition-all duration-300 ${
              activeTab === "claims" 
                ? "bg-cora-primary text-cora-light shadow-lg shadow-cora-primary/20" 
                : "hover:bg-white/10 text-cora-gray hover:translate-x-1"
            }`}
            aria-label="File a Claim"
            title="File a Claim"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            <span className="font-medium text-sm">File a Claim</span>
          </button>
        </div>
        
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-cora-light font-semibold text-sm">Resources</h3>
            <button 
              onClick={() => setShowResources(!showResources)}
              className="text-cora-gray hover:text-cora-primary text-xs flex items-center"
              aria-label={showResources ? "Hide resources" : "Show resources"}
              title={showResources ? "Hide resources" : "Show resources"}
            >
              {showResources ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          </div>
          
          {showResources && (
            <div className="space-y-1 bg-black/30 rounded-xl p-2 border border-white/5 text-xs animate-fadeIn">
              <a href="#" className="block text-cora-gray hover:text-cora-primary transition-all duration-200 py-2 px-3 rounded-lg hover:bg-black/30">
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  Insurance FAQ
                </span>
              </a>
              <a href="#" className="block text-cora-gray hover:text-cora-primary transition-all duration-200 py-2 px-3 rounded-lg hover:bg-black/30">
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  Policy Terms
                </span>
              </a>
              <a href="#" className="block text-cora-gray hover:text-cora-primary transition-all duration-200 py-2 px-3 rounded-lg hover:bg-black/30">
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  Contact Support
                </span>
              </a>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-white/5 text-center">
            <p className="text-cora-gray text-xs">Powered by</p>
            <div className="flex justify-center space-x-2 mt-1">
              <span className="text-xs text-cora-primary">Aptos Blockchain</span>
           
          
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 