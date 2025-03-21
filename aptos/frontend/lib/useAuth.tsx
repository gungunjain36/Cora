import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserData } from '../utils/api';

interface User {
  uuid?: string;
  walletAddress?: string;
  name?: string;
  email?: string;
  hasCompletedOnboarding?: boolean;
}

export function useAuth() {
  const { 
    ready,
    authenticated, 
    user, 
    login, 
    logout, 
    connectWallet 
  } = usePrivy();
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Update user data when Privy user changes
  useEffect(() => {
    const fetchUserDetails = async (userId: string) => {
      try {
        // Try to get user data from backend
        const userData = await getUserData(userId);
        
        // If user data exists, they've completed onboarding
        return {
          uuid: userId,
          walletAddress: user?.wallet?.address,
          name: userData.name || user?.wallet?.address || undefined,
          email: userData.email || user?.email?.address || undefined,
          hasCompletedOnboarding: true // User exists in backend, so they've completed onboarding
        };
      } catch (error) {
        // User data not found, they haven't completed onboarding
        return {
          uuid: userId, 
          walletAddress: user?.wallet?.address,
          name: user?.wallet?.address || undefined,
          email: user?.email?.address || undefined,
          hasCompletedOnboarding: false
        };
      }
    };
    
    if (ready) {
      if (authenticated && user) {
        // Extract user ID from Privy but don't trim it - keep the full ID
        // This ensures compatibility with the session IDs from the backend
        const userId = user.id.replace('did:privy:', '');
        
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
              walletAddress: user?.wallet?.address,
              name: user?.wallet?.address || undefined,
              email: user?.email?.address || undefined,
              hasCompletedOnboarding: false
            });
            setLoading(false);
          });
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    }
  }, [ready, authenticated, user]);

  // Handle login and redirect
  const handleLogin = useCallback(async () => {
    await login();
  }, [login]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

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
    connectWallet,
    isOnboarded: currentUser?.hasCompletedOnboarding || false
  };
} 