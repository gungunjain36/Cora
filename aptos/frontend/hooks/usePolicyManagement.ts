import { useCallback, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { 
  createPolicy, 
  payPremium, 
  fileClaim, 
  getUserPolicies, 
  getPremiumPaymentStatus,
  Policy
} from "@/view-functions/policyService";
import { toast } from "react-hot-toast";

export function usePolicyManagement() {
  const { account } = useWallet();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactionInProgress, setTransactionInProgress] = useState(false);

  // Fetch user policies
  const fetchPolicies = useCallback(async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      const fetchedPolicies = await getUserPolicies(account.address);
      setPolicies(fetchedPolicies);
    } catch (error) {
      console.error("Error fetching policies:", error);
      toast.error("Failed to fetch policies");
    } finally {
      setLoading(false);
    }
  }, [account?.address]);

  // Create new policy
  const handleCreatePolicy = useCallback(async ({
    coverageAmount,
    premiumAmount,
    documentHash,
    durationDays
  }: {
    coverageAmount: number;
    premiumAmount: number;
    documentHash?: string;
    durationDays?: number;
  }) => {
    if (!account?.address) {
      toast.error("Wallet not connected");
      return null;
    }

    setTransactionInProgress(true);
    try {
      const result = await createPolicy({
        walletAddress: account.address,
        coverageAmount,
        premiumAmount,
        documentHash,
        durationDays
      });
      
      toast.success("Policy created successfully!");
      
      // Refresh policies after creation
      setTimeout(() => {
        fetchPolicies();
      }, 2000); // Wait for blockchain confirmation
      
      return result;
    } catch (error) {
      console.error("Error creating policy:", error);
      toast.error("Failed to create policy");
      return null;
    } finally {
      setTransactionInProgress(false);
    }
  }, [account?.address, fetchPolicies]);

  // Pay premium
  const handlePayPremium = useCallback(async ({
    policyId,
    amount
  }: {
    policyId: string | number;
    amount: number;
  }) => {
    if (!account?.address) {
      toast.error("Wallet not connected");
      return null;
    }

    setTransactionInProgress(true);
    try {
      const result = await payPremium({
        policyId,
        amount
      });
      
      toast.success("Premium paid successfully!");
      
      // Refresh policies after payment
      setTimeout(() => {
        fetchPolicies();
      }, 2000); // Wait for blockchain confirmation
      
      return result;
    } catch (error) {
      console.error("Error paying premium:", error);
      toast.error("Failed to pay premium");
      return null;
    } finally {
      setTransactionInProgress(false);
    }
  }, [account?.address, fetchPolicies]);

  // File claim
  const handleFileClaim = useCallback(async ({
    policyId,
    claimAmount,
    claimReason
  }: {
    policyId: string | number;
    claimAmount: number;
    claimReason: string;
  }) => {
    if (!account?.address) {
      toast.error("Wallet not connected");
      return null;
    }

    setTransactionInProgress(true);
    try {
      const result = await fileClaim({
        policyId,
        claimantAddress: account.address,
        claimAmount,
        claimReason
      });
      
      toast.success("Claim filed successfully!");
      
      // Refresh policies after filing claim
      setTimeout(() => {
        fetchPolicies();
      }, 2000); // Wait for blockchain confirmation
      
      return result;
    } catch (error) {
      console.error("Error filing claim:", error);
      toast.error("Failed to file claim");
      return null;
    } finally {
      setTransactionInProgress(false);
    }
  }, [account?.address, fetchPolicies]);

  // Check premium payment status
  const checkPaymentStatus = useCallback(async (policyId: string | number) => {
    try {
      return await getPremiumPaymentStatus(policyId);
    } catch (error) {
      console.error("Error checking payment status:", error);
      return false;
    }
  }, []);

  return {
    policies,
    loading,
    transactionInProgress,
    fetchPolicies,
    createPolicy: handleCreatePolicy,
    payPremium: handlePayPremium,
    fileClaim: handleFileClaim,
    checkPaymentStatus
  };
} 