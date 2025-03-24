import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { PolicyCard } from "./types";
import { blockchainService } from '../../utils/blockchainService';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from "react-hot-toast";
import { TransactionButton } from '../ui/TransactionButton';
import { getUserPolicies, getPremiumPaymentStatus, Policy } from '../../view-functions/policyService';
import { formatAddress, formatCurrency } from '../../utils/helpers';

type PoliciesTabProps = {
  userId: string;
};

type NewPolicyFormData = {
  policy_type: string;
  coverage_amount: number;
  term_length: number;
};

export function PoliciesTab({ userId }: PoliciesTabProps) {
  const { account, connect, wallets, signAndSubmitTransaction } = useWallet();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPolicyModal, setShowNewPolicyModal] = useState(false);
  const [newPolicy, setNewPolicy] = useState<NewPolicyFormData>({
    policy_type: 'Term Life',
    coverage_amount: 1000000,
    term_length: 20,
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState('');
  const [transactionStatus, setTransactionStatus] = useState('');
  const [policyActivated, setPolicyActivated] = useState(false);
  const [createdPolicy, setCreatedPolicy] = useState<{
    policyId: string;
    premium: number;
    coverage: number;
    policyType: string;
    termLength: number;
  } | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<string | null>(null);
  const [activePayingPolicy, setActivePayingPolicy] = useState<string | null>(null);
  const [processingClaim, setProcessingClaim] = useState<string | null>(null);
  const [claimReason, setClaimReason] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [showClaimForm, setShowClaimForm] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalPolicies: 0,
    totalCoverage: 0,
    totalPremium: 0,
    activePolicies: 0,
  });

  useEffect(() => {
    if (account?.address) {
      fetchPolicies();
    } else {
      setLoading(false);
    }
  }, [account?.address]);

  const fetchPolicies = async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      console.log(`Fetching policies for wallet address: ${account.address.toString()}`);
      const fetchedPolicies = await getUserPolicies(account.address.toString());
      console.log(`Successfully fetched ${fetchedPolicies.length} policies from chain:`, fetchedPolicies);
      
      // For each policy, check premium payment status
      if (fetchedPolicies.length > 0) {
        const policiesWithPaymentStatus = await Promise.all(
          fetchedPolicies.map(async (policy) => {
            const isPremiumPaid = await getPremiumPaymentStatus(policy.policy_id);
            return {
              ...policy,
              isPremiumPaid
            };
          })
        );
        
        setPolicies(policiesWithPaymentStatus);
        
        // Calculate statistics
        const statsData = {
          totalPolicies: policiesWithPaymentStatus.length,
          totalCoverage: policiesWithPaymentStatus.reduce((sum, p) => sum + p.coverage_amount, 0),
          totalPremium: policiesWithPaymentStatus.reduce((sum, p) => sum + p.premium_amount, 0),
          activePolicies: policiesWithPaymentStatus.filter(p => p.status === 'ACTIVE').length,
        };
        
        setStats(statsData);
      } else {
        setPolicies([]);
        setStats({
          totalPolicies: 0,
          totalCoverage: 0,
          totalPremium: 0,
          activePolicies: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAptosWallet = async () => {
    try {
      if (wallets.length > 0) {
        // Connect to the first available wallet
        await connect(wallets[0].name);
        console.log(`Connected to ${wallets[0].name}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error connecting Aptos wallet:', error);
      setError('Failed to connect wallet. Please try again.');
      return false;
    }
  };

  const handleCreatePolicy = async () => {
    try {
      // Reset error and success states
      setProcessing(true);
      setError(null);
      setSuccess(null);

      // Check if wallet is connected
      if (!account) {
        setError('Please connect your Aptos wallet to create a policy.');
        if (wallets.length > 0) {
          await connect(wallets[0].name);
        } else {
          setError('No Aptos wallets detected. Please install an Aptos wallet extension.');
        }
        setProcessing(false);
        return;
      }

      // Validate form
      if (newPolicy.coverage_amount <= 0) {
        setError('Coverage amount must be greater than zero.');
        setProcessing(false);
        return;
      }

      if (newPolicy.term_length <= 0) {
        setError('Term length must be greater than zero.');
        setProcessing(false);
        return;
      }
      
      // Ensure wallet address is available
      if (!account.address) {
        setError('Wallet address is not available. Please reconnect your wallet.');
        setProcessing(false);
        return;
      }

      const walletAddress = account.address.toString();
      console.log("Creating policy with wallet address:", walletAddress);

      // First make sure the user's wallet is mapped to their account
      const mappingResult = await blockchainService.verifyWalletMapping(walletAddress);
      
      if (!mappingResult.success || !mappingResult.data?.isMapped) {
        // If verification fails, try to create a mapping
        console.log("Wallet mapping not found, attempting to create a new mapping...");
        const createMappingResult = await blockchainService.createWalletMapping(userId, walletAddress);
        if (!createMappingResult.success) {
          setError('Failed to map wallet to user account. Please try again.');
          setProcessing(false);
          return;
        }
        console.log("Created new wallet mapping successfully");
      }

      // Calculate premium amount based on policy details
      const monthlyPremium = calculateMonthlyPremium();
      const annualPremium = monthlyPremium * 12;

      // Create policy data with premium information
      const policyData = {
        policy_type: newPolicy.policy_type,
        coverage_amount: newPolicy.coverage_amount,
        term_length: newPolicy.term_length,
        premium_amount: annualPremium,
        payment_frequency: 'annually',
        start_date: new Date().toISOString().split('T')[0], // Today as YYYY-MM-DD
        end_date: new Date(Date.now() + newPolicy.term_length * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // term_length years from now
      };

      // Log policy data for debugging
      console.log("Creating policy with data:", policyData);

      // Create the policy on-chain
      setTransactionStatus('Creating policy on blockchain...');
      const result = await blockchainService.createPolicy(walletAddress, policyData);
      
      console.log("Policy creation result:", result);
      
      if (result.success) {
        // Successfully created policy
        const policyId = result.data?.policy_id || result.data?.policy?.policy_id;
        const txHash = result.data?.txHash || result.data?.policy?.transaction_hash;
        
        if (!policyId) {
          setError('Policy created but no policy ID returned. Please check My Policies to confirm.');
          setTimeout(() => fetchPolicies(), 2000);
          setProcessing(false);
          return;
        }

        // Store policy details for payment prompt
        setCreatedPolicy({
          policyId: policyId,
          premium: annualPremium,
          coverage: newPolicy.coverage_amount,
          policyType: newPolicy.policy_type,
          termLength: newPolicy.term_length
        });

        // Update status
        setTransactionStatus('');
        setTransactionHash(txHash || '');
        setSuccess('Policy created successfully! You can now pay the premium to activate it.');
        setShowPaymentPrompt(true);
        
        // Refresh policy list
        setTimeout(() => fetchPolicies(), 2000);
      } else {
        // Policy creation failed
        setTransactionStatus('');
        setError(result.message || 'Failed to create policy. Please try again.');
      }
    } catch (error) {
      console.error('Error creating policy:', error);
      setError('An unexpected error occurred. Please try again later.');
      setTransactionStatus('');
    } finally {
      setProcessing(false);
    }
  };

  const handleExistingPolicyPayment = async (policyId: string, amount: number) => {
    try {
      // Check if wallet is connected
      if (!account || !account.address) {
        setError('Please connect your wallet to make a payment.');
        if (wallets.length > 0) {
          await connect(wallets[0].name);
        }
        return;
      }
      
      const walletAddress = account.address.toString();
      
      setProcessingPayment(policyId);
      setTransactionStatus(`Preparing payment transaction for policy ${policyId}...`);
      setError(null);
      
      // First, get policy details to confirm payment amount
      setTransactionStatus(`Verifying policy details...`);
      const policyDetails = await blockchainService.getPolicyDetails(policyId);
      if (!policyDetails.success) {
        setError(`Could not verify policy details: ${policyDetails.message}`);
        setProcessingPayment(null);
        return;
      }
      
      // Start the payment process
      setTransactionStatus(`Requesting wallet approval for payment of $${amount}...`);
      
      const paymentResult = await blockchainService.processPayment(
        walletAddress,
        policyId,
        amount
      );
      
      if (paymentResult.success) {
        // Transaction submitted successfully
        if (paymentResult.data?.txHash) {
          setTransactionHash(paymentResult.data.txHash);
          setTransactionStatus(`Transaction submitted to blockchain. Waiting for confirmation...`);
          
          // Set a timeout to check transaction status
          setTimeout(async () => {
            try {
              const txStatus = await blockchainService.getTransactionStatus(paymentResult.data.txHash);
              if (txStatus.success) {
                setTransactionStatus(`Transaction confirmed on blockchain!`);
                setSuccess('Payment successful! Your policy has been renewed.');
              } else {
                setTransactionStatus(`Transaction is pending. You can check status on explorer.`);
              }
            } catch (error) {
              console.error('Error checking transaction status:', error);
            }
            
            // Update policy list regardless of confirmation status
            fetchPolicies();
          }, 3000);
        } else {
          setSuccess('Payment processed successfully! Your policy has been renewed.');
          
          // Update policy list after payment
          setTimeout(() => {
            fetchPolicies();
          }, 2000);
        }
      } else {
        setError(`Payment failed: ${paymentResult.message}`);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('An unexpected error occurred during payment.');
    } finally {
      setProcessingPayment(null);
    }
  };

  const handlePayPremium = async (policyId: string, amount: number) => {
    if (!account?.address) {
      toast.error("Please connect your wallet to pay premium");
      return { success: false, message: "Wallet not connected" };
    }
    
    try {
      const result = await blockchainService.processPayment(
        account.address.toString(),
        policyId,
        amount
      );
      
      if (result.success) {
        console.log("Payment transaction:", result.data?.transaction_hash);
        
        // Refresh policies after successful payment
        await fetchPolicies();
        return { success: true };
      } else {
        return { success: false, message: result.message || "Failed to process payment" };
      }
    } catch (error) {
      console.error("Error paying premium:", error);
      return { success: false, message: "An error occurred while processing payment" };
    }
  };

  const handleFileClaim = async (policyId: string) => {
    if (!account?.address) {
      toast.error("Please connect your wallet to file a claim");
      return;
    }
    
    if (!claimReason || !claimAmount) {
      toast.error("Please provide claim reason and amount");
      return;
    }
    
    try {
      setProcessingClaim(policyId);
      
      const result = await blockchainService.submitClaim(
        account.address.toString(),
        policyId,
        {
          amount: parseFloat(claimAmount),
          reason: claimReason,
          details: `Claim filed on ${new Date().toLocaleString()}`,
          submitted_date: new Date().toISOString()
        }
      );
      
      if (result.success) {
        toast.success("Claim submitted successfully!");
        console.log("Claim transaction:", result.data?.txHash);
        setShowClaimForm(null);
        setClaimReason("");
        setClaimAmount("");
      } else {
        toast.error(result.message || "Failed to submit claim");
      }
    } catch (error) {
      console.error("Error filing claim:", error);
      toast.error("Failed to submit claim");
    } finally {
      setProcessingClaim(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setError(null); // Clear error when user makes changes
    setNewPolicy(prev => ({
      ...prev,
      [name]: name === 'coverage_amount' || name === 'term_length' 
        ? Number(value) 
        : value
    }));
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate estimated premium based on coverage and term
  const calculateMonthlyPremium = (): number => {
    const baseRate = 0.0005; // Base rate per dollar of coverage
    const termFactor = 1 + (newPolicy.term_length * 0.01); // Longer terms cost more
    
    let policyFactor = 1.0;
    if (newPolicy.policy_type === 'Whole Life') policyFactor = 1.5;
    if (newPolicy.policy_type === 'Universal Life') policyFactor = 1.3;
    
    return (newPolicy.coverage_amount * baseRate * termFactor * policyFactor) / 12;
  };

  // Add a function to format premium display
  const formatPremium = (): string => {
    return formatCurrency(calculateMonthlyPremium());
  };

  if (!account) {
    return (
      <div className="rounded-xl backdrop-blur-xl bg-black/40 border border-white/15 shadow-2xl p-6">
        <div className="text-center py-10">
          <h3 className="text-xl font-medium mb-4">Connect Your Wallet</h3>
          <p className="text-gray-400 mb-6">Connect your wallet to view your insurance policies on the Aptos blockchain.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl backdrop-blur-xl bg-black/40 border border-white/15 shadow-2xl p-4">
          <div className="text-cora-gray text-sm mb-1">Total Policies</div>
          <div className="text-2xl font-bold">{stats.totalPolicies}</div>
        </div>
        
        <div className="rounded-xl backdrop-blur-xl bg-black/40 border border-white/15 shadow-2xl p-4">
          <div className="text-cora-gray text-sm mb-1">Active Policies</div>
          <div className="text-2xl font-bold">{stats.activePolicies}</div>
        </div>
        
        <div className="rounded-xl backdrop-blur-xl bg-black/40 border border-white/15 shadow-2xl p-4">
          <div className="text-cora-gray text-sm mb-1">Total Coverage</div>
          <div className="text-2xl font-bold">${stats.totalCoverage.toLocaleString()}</div>
        </div>
        
        <div className="rounded-xl backdrop-blur-xl bg-black/40 border border-white/15 shadow-2xl p-4">
          <div className="text-cora-gray text-sm mb-1">Annual Premium</div>
          <div className="text-2xl font-bold">${stats.totalPremium.toLocaleString()}</div>
        </div>
      </div>
      
      {/* Policies List */}
      <div className="rounded-xl backdrop-blur-xl bg-black/40 border border-white/15 shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium">Your Policies</h2>
          <button 
            onClick={fetchPolicies}
            className="text-sm bg-black/30 hover:bg-black/50 text-white px-3 py-1 rounded-full transition-colors"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {loading ? (
          <div className="py-10 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cora-primary"></div>
            <p className="mt-3 text-gray-400">Loading your policies...</p>
          </div>
        ) : policies.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-gray-400 mb-2">You don't have any policies yet.</p>
            <p className="text-sm text-gray-500">Chat with Cora to get recommendations and create your first policy.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <div key={policy.policy_id} className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors">
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Policy #{policy.policy_id}</span>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      policy.status === 'ACTIVE' 
                        ? 'bg-green-900/30 text-green-400 border border-green-700/50' 
                        : 'bg-red-900/30 text-red-400 border border-red-700/50'
                    }`}>
                      {policy.status}
                    </span>
                    
                    {policy.isPremiumPaid !== undefined && (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        policy.isPremiumPaid 
                          ? 'bg-blue-900/30 text-blue-400 border border-blue-700/50' 
                          : 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50'
                      }`}>
                        {policy.isPremiumPaid ? 'Premium Paid' : 'Premium Due'}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <div className="text-gray-400">Coverage:</div>
                      <div>${policy.coverage_amount.toLocaleString()}</div>
                      
                      <div className="text-gray-400">Premium:</div>
                      <div>${policy.premium_amount.toLocaleString()}/year</div>
                      
                      <div className="text-gray-400">Term Length:</div>
                      <div>{policy.term_length} days</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <div className="text-gray-400">Created:</div>
                      <div>{new Date(policy.created_at * 1000).toLocaleDateString()}</div>
                      
                      {policy.next_payment_due && (
                        <>
                          <div className="text-gray-400">Next Payment:</div>
                          <div>{new Date(policy.next_payment_due * 1000).toLocaleDateString()}</div>
                        </>
                      )}
                      
                      <div className="text-gray-400">Policyholder:</div>
                      <div className="truncate">{formatAddress(policy.policyholder)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Policy Modal */}
      <Dialog open={showNewPolicyModal} onOpenChange={setShowNewPolicyModal}>
        <DialogContent className="bg-[#161b22] border border-white/10 max-w-md mx-auto">
          <DialogTitle className="text-white text-xl">Create New Policy</DialogTitle>
          <DialogDescription className="text-gray-400">
            Set up a new insurance policy to be created on the blockchain.
          </DialogDescription>
          
          {!account?.address && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 my-4 text-red-400 flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Please connect your wallet to create a policy.</span>
            </div>
          )}
          
          {success && (
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4 my-4 text-green-400 flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{success}</span>
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 my-4 text-red-400 flex items-start">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-4 my-4">
            <div>
              <label htmlFor="policy-type" className="block text-sm font-medium text-gray-300 mb-1">Policy Type</label>
              <select
                id="policy-type"
                name="policy_type"
                value={newPolicy.policy_type}
                onChange={handleInputChange}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary transition-all"
                aria-label="Select policy type"
              >
                <option value="Term Life">Term Life</option>
                <option value="Whole Life">Whole Life</option>
                <option value="Universal Life">Universal Life</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="coverage-amount" className="block text-sm font-medium text-gray-300 mb-1">Coverage Amount</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">$</span>
                </div>
                <input
                  id="coverage-amount"
                  name="coverage_amount"
                  type="number"
                  min="100000"
                  step="100000"
                  value={newPolicy.coverage_amount}
                  onChange={handleInputChange}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-md py-2 pl-8 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary transition-all"
                  aria-label="Enter coverage amount"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum coverage: $100,000</p>
            </div>
            
            <div>
              <label htmlFor="term-length" className="block text-sm font-medium text-gray-300 mb-1">Term Length (years)</label>
              <input
                id="term-length"
                name="term_length"
                type="number"
                min="1"
                max="30"
                value={newPolicy.term_length}
                onChange={handleInputChange}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary transition-all"
                aria-label="Enter term length in years"
              />
              <p className="text-xs text-gray-500 mt-1">1-30 years</p>
            </div>
            
            <div className="bg-gradient-to-r from-cora-primary/20 to-purple-600/20 rounded-lg p-4 border border-cora-primary/30">
              <p className="text-sm text-gray-300 mb-2">Estimated Monthly Premium</p>
              <p className="text-xl font-bold text-white">{formatPremium()}<span className="text-sm font-normal text-gray-400 ml-1">/month</span></p>
              <p className="text-xs text-gray-400 mt-1">Annual payment: {formatCurrency(calculateMonthlyPremium() * 12)}</p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-4">
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
                Cancel
              </Button>
            </DialogClose>
            
            {!account?.address ? (
              <Button 
                onClick={handleConnectAptosWallet}
                className="bg-gradient-to-r from-cora-primary to-purple-600 text-white hover:opacity-90 transition-colors"
              >
                Connect Aptos Wallet
              </Button>
            ) : (
              <Button 
                onClick={handleCreatePolicy} 
                className="bg-gradient-to-r from-cora-primary to-purple-600 text-white hover:opacity-90 transition-colors"
                disabled={processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Create Policy'
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showPaymentPrompt && createdPolicy && (
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-cora-primary/10 to-purple-600/10 border border-cora-primary/30">
          <h3 className="text-lg font-semibold text-white mb-2">Complete Your Policy Activation</h3>
          
          <div className="space-y-3 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-300">Policy Type:</span>
              <span className="text-white font-medium">{createdPolicy.policyType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Coverage Amount:</span>
              <span className="text-white font-medium">${createdPolicy.coverage.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Term Length:</span>
              <span className="text-white font-medium">{createdPolicy.termLength} years</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Annual Premium:</span>
              <span className="text-white font-medium">${createdPolicy.premium.toLocaleString()}</span>
            </div>
          </div>
          
          {transactionStatus && (
            <div className="flex items-center justify-center space-x-2 my-3 bg-black/30 p-3 rounded-lg">
              <Loader2 className="h-4 w-4 text-cora-primary animate-spin" />
              <span className="text-sm text-cora-light">{transactionStatus}</span>
            </div>
          )}
          
          {transactionHash && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400 break-all">
                <span className="font-semibold">Transaction Hash:</span><br/>
                {transactionHash}
              </p>
              <a 
                href={`https://explorer.aptoslabs.com/txn/${transactionHash}?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cora-primary underline mt-2 inline-block"
              >
                View on Aptos Explorer
              </a>
            </div>
          )}
          
          {!policyActivated && (
            <TransactionButton
              onClick={() => handlePayPremium(createdPolicy.policyId, createdPolicy.premium)}
              loadingText="Processing Payment..."
              successText="Payment successful! Your policy is now active."
              errorText="Payment failed. Please try again."
              className="w-full mt-4 py-3 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center justify-center"
            >
              Pay Premium Now
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </TransactionButton>
          )}
        </div>
      )}

      {/* Transaction Details Dialog */}
      <Dialog open={!!viewingTransaction} onOpenChange={(open) => !open && setViewingTransaction(null)}>
        <DialogContent className="bg-[#161b22] border border-white/10 max-w-md mx-auto">
          <DialogTitle className="text-white text-xl">Blockchain Transaction</DialogTitle>
          <DialogDescription className="text-gray-400">
            Details of the on-chain transaction for this policy.
          </DialogDescription>
          
          <div className="my-4 p-4 bg-black/30 rounded-lg border border-gray-700/50">
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">Transaction Hash</p>
              <p className="text-sm text-white break-all font-mono">{viewingTransaction}</p>
            </div>
            
            <div className="pt-2 mt-2 border-t border-white/10">
              <a 
                href={`https://explorer.aptoslabs.com/txn/${viewingTransaction}?network=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cora-primary text-sm flex items-center hover:underline mt-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5z" />
                </svg>
                View on Aptos Explorer
              </a>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 text-white hover:bg-white/5">
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {showClaimForm && (
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-cora-primary/10 to-purple-600/10 border border-cora-primary/30">
          <h3 className="text-lg font-semibold text-white mb-2">File a Claim</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Claim Reason</label>
              <input
                type="text"
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                placeholder="Reason for claim"
                className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cora-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Claim Amount</label>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                placeholder="Amount"
                className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-cora-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleFileClaim(showClaimForm)}
                disabled={processingClaim === showClaimForm}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-cora-primary to-cora-secondary text-white rounded-lg hover:opacity-90 transition-all shadow-lg shadow-cora-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingClaim === showClaimForm ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </div>
                ) : (
                  "Submit Claim"
                )}
              </button>
              <button
                onClick={() => setShowClaimForm(null)}
                className="px-4 py-2 bg-black/40 border border-white/20 text-white rounded-lg hover:opacity-90 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 