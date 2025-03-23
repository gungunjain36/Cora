import { useAuth } from "@/lib/useAuth";
import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

interface ConnectWalletButtonProps {
  className?: string;
  variant?: "primary" | "secondary" | "outlined";
  fullWidth?: boolean;
}

export function ConnectWalletButton({ 
  className = "", 
  variant = "primary",
  fullWidth = false 
}: ConnectWalletButtonProps) {
  const { authenticated, login, user, connectWallet } = useAuth();
  const { account, connect, connected, wallets } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Debug output to console
  useEffect(() => {
    console.log("Auth state:", { authenticated, user });
    console.log("Wallet state:", { connected, account });
  }, [authenticated, user, connected, account]);
  
  useEffect(() => {
    // Hide tooltip after 2 seconds when displayed
    if (showTooltip) {
      const timer = setTimeout(() => {
        setShowTooltip(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showTooltip]);
  
  // Function to connect Aptos wallet
  const connectAptosWallet = async () => {
    try {
      // Check if we have any Aptos wallets available
      if (wallets.length > 0) {
        // Try to connect with the first available wallet
        await connect(wallets[0].name);
        console.log("Connected to Aptos wallet:", wallets[0].name);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error connecting to Aptos wallet:", error);
      return false;
    }
  };
  
  const handleConnect = async () => {
    try {
      setIsLoading(true);
      
      if (!authenticated) {
        // If not authenticated, trigger login flow
        await login();
      } else if (!user?.walletAddress && !connected) {
        // Try to connect Privy wallet first
        try {
          await connectWallet();
        } catch (privyError) {
          console.error("Error connecting Privy wallet, trying Aptos wallet:", privyError);
          // If Privy wallet connection fails, try Aptos wallet
          await connectAptosWallet();
        }
      } else if (!connected) {
        // If Privy is connected but not Aptos, connect Aptos
        await connectAptosWallet();
      } else {
        // If already connected, show address tooltip
        setShowTooltip(true);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Determine if any wallet is connected
  const hasWallet = user?.walletAddress || connected;
  
  // Determine button text based on auth state
  const buttonText = () => {
    if (isLoading) return "Connecting...";
    if (!authenticated) return "Connect Wallet";
    if (hasWallet) {
      // Use Aptos wallet address if available, otherwise use Privy wallet
      const address = account?.address?.toString() || user?.walletAddress || '';
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
    return "Connect Wallet";
  };
  
  // Apply styling based on variant
  const getButtonStyles = () => {
    const baseStyles = `relative flex items-center justify-center rounded-full font-medium transition-all duration-300 ${fullWidth ? 'w-full' : ''}`;
    
    switch (variant) {
      case "primary":
        return `${baseStyles} group overflow-hidden`;
      case "secondary":
        return `${baseStyles} group overflow-hidden`;
      case "outlined":
        return `${baseStyles} py-2 px-4 border ${hasWallet ? 'border-cora-primary bg-cora-primary/10' : 'border-white/20'} text-cora-light hover:border-cora-primary hover:text-cora-primary`;
      default:
        return baseStyles;
    }
  };

  // For primary and secondary variants
  const renderPrimaryButton = () => (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`${getButtonStyles()} ${className}`}
    >
      {variant === "primary" && (
        <>
          <span className={`absolute inset-0 ${hasWallet ? 'bg-gradient-to-r from-cora-primary via-cora-light-green to-cora-secondary' : 'bg-gradient-to-r from-cora-primary to-cora-secondary'}`}></span>
          <span className="absolute inset-0 bg-gradient-to-r from-cora-primary via-cora-light-green to-cora-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
        </>
      )}
      {variant === "secondary" && (
        <>
          <span className={`absolute inset-0 ${hasWallet ? 'bg-black/40 backdrop-blur-sm border-2 border-cora-primary rounded-full' : 'bg-black/40 backdrop-blur-sm border border-cora-primary/50 rounded-full'}`}></span>
          <span className="absolute inset-0 bg-cora-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></span>
        </>
      )}
      <span className={`relative flex items-center gap-2 px-4 py-2 z-10 ${variant === "primary" ? "text-cora-dark" : "text-cora-light"}`}>
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <>
            {hasWallet ? (
              <div className="h-4 w-4 rounded-full bg-green-500 flex-shrink-0 animate-pulse"></div>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M19 7H5C3.89543 7 3 7.89543 3 9V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="13" r="1" fill="currentColor" />
                <circle cx="12" cy="13" r="1" fill="currentColor" />
              </svg>
            )}
            <span className="whitespace-nowrap font-medium">{buttonText()}</span>
            {hasWallet && (
              <svg 
                className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'rotate-180' : ''}`} 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19 9L12 16L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </>
        )}
      </span>
      {showTooltip && hasWallet && (
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-cora-light rounded-lg px-3 py-2 text-xs whitespace-nowrap backdrop-blur-sm border border-white/10 z-50">
          {account?.address?.toString() || user?.walletAddress}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-8 border-transparent border-b-black/80"></div>
        </div>
      )}
    </button>
  );

  // For outlined variant
  const renderOutlinedButton = () => (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className={`${getButtonStyles()} ${className} relative`}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <div className="flex items-center gap-2">
          {hasWallet ? (
            <div className="h-3 w-3 rounded-full bg-green-500 flex-shrink-0 animate-pulse"></div>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M19 7H5C3.89543 7 3 7.89543 3 9V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="16" cy="13" r="1" fill="currentColor" />
              <circle cx="12" cy="13" r="1" fill="currentColor" />
            </svg>
          )}
          <span className="whitespace-nowrap font-medium">{buttonText()}</span>
          {hasWallet && (
            <svg 
              onClick={() => setShowTooltip(!showTooltip)}
              className="w-4 h-4 cursor-pointer" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19 9L12 16L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      )}
      {showTooltip && hasWallet && (
        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-black/80 text-cora-light rounded-lg px-3 py-2 text-xs whitespace-nowrap backdrop-blur-sm border border-white/10 z-50">
          {account?.address?.toString() || user?.walletAddress}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 border-8 border-transparent border-b-black/80"></div>
        </div>
      )}
    </button>
  );
  
  return variant === "outlined" ? renderOutlinedButton() : renderPrimaryButton();
} 