import React, { ReactNode } from 'react';
import { PrivyProvider as PrivyAuthProvider } from '@privy-io/react-auth';

// Privy App ID from environment variables
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;

interface PrivyProviderProps {
  children: ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  // Configuration for Privy
  const config = {
    appearance: {
      theme: 'dark',
      accentColor: '#3CB371', // Cora's primary color
      logo: '/assets/cora-logo.png', // Path to Cora logo
    },
    embeddedWallets: {
      createOnLogin: true, // Create an embedded wallet for users when they log in
    },
    loginMethods: ['wallet', 'email', 'google'],
  };

  return (
    <PrivyAuthProvider
      appId={PRIVY_APP_ID}
      config={config}
      onSuccess={() => console.log('Privy initialization successful')}
    >
      {children}
    </PrivyAuthProvider>
  );
} 