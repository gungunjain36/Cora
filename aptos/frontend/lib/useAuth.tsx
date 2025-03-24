import { useContext, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { AptosAuthContext } from './AptosAuthProvider';
import { getUserData } from '../utils/api';

interface User {
  uuid?: string;
  walletAddress?: string;
  name?: string;
  email?: string;
  hasCompletedOnboarding?: boolean;
}

export function useAuth() {
  const { authenticated, walletAddress, userId } = useContext(AptosAuthContext);
  const { account, connect, disconnect, wallets, connected } = useWallet();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Update user data when wallet connection changes
  useEffect(() => {
    const fetchUserDetails = async (id: string) => {
      try {
        // Try to get user data from backend
        const userData = await getUserData(id);
        
        // If user data exists, they've completed onboarding
        return {
          uuid: id,
          walletAddress: walletAddress,
          name: userData.name || walletAddress || undefined,
          email: userData.email || undefined,
          hasCompletedOnboarding: true // User exists in backend, so they've completed onboarding
        };
      } catch (error) {
        // User data not found, they haven't completed onboarding
        return {
          uuid: id, 
          walletAddress: walletAddress,
          name: walletAddress?.slice(0, 6) + '...' + walletAddress?.slice(-4) || undefined,
          email: undefined,
          hasCompletedOnboarding: false
        };
      }
    };
    
    if (authenticated && userId) {
      // Fetch user details from backend
      setLoading(true);
      fetchUserDetails(userId)
        .then(userData => {
          setCurrentUser(userData);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching user details:", err);
          setCurrentUser({
            uuid: userId,
            walletAddress: walletAddress || undefined,
            name: walletAddress?.slice(0, 6) + '...' + walletAddress?.slice(-4) || undefined,
            hasCompletedOnboarding: false
          });
          setLoading(false);
        });
    } else {
      setCurrentUser(null);
      setLoading(false);
    }
  }, [authenticated, userId, walletAddress]);

  // Handle login by connecting wallet
  const handleLogin = useCallback(async () => {
    if (wallets.length > 0) {
      try {
        await connect(wallets[0].name);
        return true;
      } catch (error) {
        console.error("Error connecting wallet:", error);
        return false;
      }
    }
    return false;
  }, [connect, wallets]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    if (connected) {
      await disconnect();
    }
    navigate('/');
  }, [disconnect, navigate, connected]);

  // Navigate based on auth state
  const navigateByAuthState = useCallback(() => {
    if (!authenticated) {
      return navigate('/');
    }
    
    if (currentUser?.hasCompletedOnboarding) {
      return navigate('/dashboard');
    } else {
      return navigate('/onboarding');
    }
  }, [authenticated, currentUser, navigate]);

  return {
    login: handleLogin,
    logout: handleLogout,
    navigateByAuthState,
    authenticated,
    user: currentUser,
    loading,
    connectWallet: handleLogin,
    isOnboarded: currentUser?.hasCompletedOnboarding || false
  };
} 