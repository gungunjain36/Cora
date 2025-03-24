import React, { ReactNode, createContext, useState, useEffect } from 'react';
import { WalletProvider } from '@/components/WalletProvider';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

// Create context to store the auth state
export const AptosAuthContext = createContext<{
  authenticated: boolean;
  walletAddress: string | null;
  userId: string | null;
}>({
  authenticated: false,
  walletAddress: null,
  userId: null,
});

interface AptosAuthProviderProps {
  children: ReactNode;
}

export function AptosAuthProvider({ children }: AptosAuthProviderProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Wrap children with the necessary providers
  return (
    <WalletProvider>
      <AptosAuthConsumer>
        {(authProps) => (
          <AptosAuthContext.Provider value={authProps}>
            {children}
          </AptosAuthContext.Provider>
        )}
      </AptosAuthConsumer>
    </WalletProvider>
  );
}

// This consumer gets the wallet state and prepares auth context values
function AptosAuthConsumer({ children }: { children: (props: any) => ReactNode }) {
  const { account, connected } = useWallet();
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  useEffect(() => {
    // When wallet is connected, set authenticated to true
    if (connected && account) {
      setAuthenticated(true);
      // Use the wallet address as the user ID
      setUserId(account.address.toString());
    } else {
      setAuthenticated(false);
      setUserId(null);
    }
  }, [connected, account]);
  
  // Auth props to pass to the context
  const authProps = {
    authenticated,
    walletAddress: account?.address?.toString() || null,
    userId,
  };
  
  return <>{children(authProps)}</>;
} 