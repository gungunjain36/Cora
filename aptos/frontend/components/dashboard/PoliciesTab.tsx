import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { PolicyCard } from "./types";
import { blockchainService } from '../../utils/blockchainService';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';

type PoliciesTabProps = {
  userId: string;
};

type NewPolicyFormData = {
  policy_type: string;
  coverage_amount: number;
  term_length: number;
};

export function PoliciesTab({ userId }: PoliciesTabProps) {
  const { account, connect, wallets } = useWallet();
  const [policies, setPolicies] = useState<PolicyCard[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [processingPayment, setProcessingPayment] = useState(false);
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

  // Fetch policies from blockchain when wallet address changes
  useEffect(() => {
    if (account?.address) {
      fetchPolicies(account.address.toString());
    }
  }, [account?.address]);

  const fetchPolicies = async (walletAddress: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Fetching policies for wallet: ${walletAddress}`);
      
      // Clear any existing policies before fetching new ones
      setPolicies([]);
      
      // Make sure we have a valid wallet address
      if (!walletAddress || walletAddress.trim() === '') {
        console.error('Invalid wallet address provided to fetchPolicies');
        setError('Please connect your wallet to view policies');
        setLoading(false);
        return;
      }
      
      console.log(`Calling blockchain service with wallet address: ${walletAddress}`);
      const result = await blockchainService.getUserPolicies(walletAddress);
      console.log('API response:', result);
      
      if (result.success && result.data?.policies && Array.isArray(result.data.policies)) {
        console.log("Received policies:", result.data.policies);
        
        if (result.data.policies.length === 0) {
          console.log("No policies found for this wallet");
          setPolicies([]);
          setLoading(false);
          return;
        }
        
        // Transform blockchain policies to PolicyCard format with payment info
        const formattedPolicies = result.data.policies.map((policy: any) => {
          console.log("Processing policy:", policy);
          
          // Calculate if payment is due
          const startDate = new Date(policy.start_date || Date.now());
          const now = new Date();
          const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Policy is pending or annual payment is due
          const paymentDue = policy.status === 'Pending' || (daysSinceStart > 0 && daysSinceStart % 365 === 0);
          
          // Create next payment date (1 year after start date)
          const paymentDate = new Date(startDate);
          paymentDate.setFullYear(paymentDate.getFullYear() + 1);
          
          // For debugging
          console.log(`Policy ${policy.policy_id} payment due: ${paymentDue}, payment date: ${paymentDate.toISOString().split('T')[0]}`);
          
          return {
            id: policy.policy_id,
            name: policy.policy_type || 'Life Insurance Policy',
            coverage: `$${(policy.coverage_amount || 0).toLocaleString()}`,
            premium: `$${(policy.premium || 0).toLocaleString()} / year`,
            status: policy.status || 'Active',
            premiumAmount: policy.premium || 0,
            txHash: policy.transaction_hash,
            policyCreationDate: policy.start_date,
            paymentDue: paymentDue,
            paymentDueDate: paymentDate.toISOString().split('T')[0],
            nextPaymentAmount: policy.premium || policy.premium_amount || 0,
            details: [
              { label: 'Policy Type', value: policy.policy_type || 'N/A' },
              { label: 'Term Length', value: `${policy.term_length || 'N/A'} years` },
              { label: 'Start Date', value: policy.start_date || 'N/A' },
              { label: 'End Date', value: policy.end_date || 'N/A' },
              { label: 'Policy ID', value: policy.policy_id || 'N/A' }, 
            ]
          };
        });
        
        console.log("Formatted policies:", formattedPolicies);
        setPolicies(formattedPolicies);
      } else {
        console.error("Failed to fetch policies:", result.message);
        setError(result.message || 'Failed to fetch your policies. Please try again later.');
        setPolicies([]);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      setError('An unexpected error occurred while fetching your policies.');
      setPolicies([]);
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
      
      if (result.success) {
        // Store policy ID for payment
        const policyId = result.data?.policy_id;
        
        if (!policyId) {
          setError('Policy created but no policy ID returned. Please check My Policies to confirm.');
          setTimeout(() => {
            setShowNewPolicyModal(false);
            fetchPolicies(walletAddress);
          }, 2000);
          setProcessing(false);
          return;
        }
        
        // Set the newly created policy
        setCreatedPolicy({
          policyId: policyId,
          premium: annualPremium,
          coverage: newPolicy.coverage_amount,
          policyType: newPolicy.policy_type,
          termLength: newPolicy.term_length
        });

        // Show payment prompt
        setShowPaymentPrompt(true);
        setSuccess('Policy created successfully! Please pay the first premium to activate.');
      } else {
        setError(result.message || 'Failed to create policy. Please try again.');
      }
    } catch (error) {
      console.error('Error creating policy:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setProcessing(false);
      setTransactionStatus('');
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
      
      setProcessingPayment(true);
      setTransactionStatus(`Preparing payment transaction for policy ${policyId}...`);
      setError(null);
      
      // First, get policy details to confirm payment amount
      setTransactionStatus(`Verifying policy details...`);
      const policyDetails = await blockchainService.getPolicyDetails(policyId);
      if (!policyDetails.success) {
        setError(`Could not verify policy details: ${policyDetails.message}`);
        setProcessingPayment(false);
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
            fetchPolicies(walletAddress);
          }, 3000);
        } else {
          setSuccess('Payment processed successfully! Your policy has been renewed.');
          
          // Update policy list after payment
          setTimeout(() => {
            fetchPolicies(walletAddress);
          }, 2000);
        }
      } else {
        setError(`Payment failed: ${paymentResult.message}`);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('An unexpected error occurred during payment.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePayPremium = async (policyId: string, amount: number) => {
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
      
      setProcessingPayment(true);
      setTransactionStatus(`Processing payment for policy ${policyId}...`);
      
      const paymentResult = await blockchainService.processPayment(
        walletAddress,
        policyId,
        amount
      );
      
      if (paymentResult.success) {
        setSuccess('Payment successful! Your policy has been activated.');
        setTransactionHash(paymentResult.data?.txHash || '');
        setPolicyActivated(true);
        
        // Update policy list after payment
        setTimeout(() => {
          fetchPolicies(walletAddress);
          setShowPaymentPrompt(false);
          setShowNewPolicyModal(false);
        }, 2000);
      } else {
        setError(`Payment failed: ${paymentResult.message}`);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('An unexpected error occurred during payment.');
    } finally {
      setProcessingPayment(false);
      setTransactionStatus('');
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

  return (
    <div className="backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Your Policies</h2>
          <p className="text-gray-400 text-sm mt-1">Manage your insurance coverage on the blockchain</p>
        </div>
        <button 
          onClick={() => setShowNewPolicyModal(true)}
          className="mt-4 md:mt-0 px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center justify-center md:justify-start transform hover:scale-105"
          aria-label="Create new policy"
          title="Create new policy"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Policy
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-full">
            <Loader2 className="w-12 h-12 text-cora-primary animate-spin mb-4" />
            <p className="text-cora-gray animate-pulse">Loading your policies...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {policies.map((policy) => (
              <div 
                key={policy.id} 
                className={`group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-cora-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-cora-primary/10 ${activeCard === policy.id ? 'ring-2 ring-cora-primary scale-[1.02]' : ''}`}
                onMouseEnter={() => setActiveCard(policy.id)}
                onMouseLeave={() => setActiveCard(null)}
              >
                <div className="p-4 md:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium text-xl text-white group-hover:text-cora-light transition-colors">{policy.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      policy.status === "Active" ? "bg-green-900/30 text-green-400 border border-green-500/20" :
                      policy.status === "Pending" ? "bg-yellow-900/30 text-yellow-400 border border-yellow-500/20" :
                      "bg-red-900/30 text-red-400 border border-red-500/20"
                    }`}>
                      {policy.status}
                    </span>
                  </div>
                  
                  {policy.paymentDue && (
                    <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm">
                      <div className="flex justify-between items-center">
                        <span>Payment Due: {policy.paymentDueDate}</span>
                        <span className="font-bold">${policy.nextPaymentAmount?.toLocaleString()}</span>
                      </div>
                      
                      {processingPayment && policy.id === activePayingPolicy ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-center space-x-2 py-2 bg-black/30 rounded-lg">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-sm">{transactionStatus || 'Processing payment...'}</span>
                          </div>
                          
                          {transactionHash && (
                            <div className="mt-2 pt-2 border-t border-yellow-500/20 text-xs">
                              <p className="break-all">
                                <span className="font-semibold">Transaction:</span> {transactionHash}
                              </p>
                              <a 
                                href={`https://explorer.aptoslabs.com/txn/${transactionHash}?network=testnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-400 underline mt-1 inline-block"
                              >
                                View on Aptos Explorer
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setActivePayingPolicy(policy.id);
                            handleExistingPolicyPayment(policy.id, policy.nextPaymentAmount || 0);
                          }}
                          disabled={processingPayment}
                          className="w-full mt-2 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:opacity-90 transition-all text-sm font-medium flex items-center justify-center"
                        >
                          {processingPayment ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>Pay Premium Now</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 rounded-xl p-4 group-hover:bg-white/10 transition-colors">
                      <p className="text-gray-400 text-sm mb-1">Coverage</p>
                      <p className="font-medium text-white text-lg group-hover:text-cora-light transition-colors">{policy.coverage}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 group-hover:bg-white/10 transition-colors">
                      <p className="text-gray-400 text-sm mb-1">Premium</p>
                      <p className="font-medium text-white text-lg group-hover:text-cora-light transition-colors">{policy.premium}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    {policy.details.map((detail, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-400 text-sm">{detail.label}</span>
                        <span className="text-white text-sm font-medium">{detail.value}</span>
                      </div>
                    ))}
                    
                    {policy.txHash && (
                      <div className="pt-2 mt-2 border-t border-white/10">
                        <button 
                          onClick={() => setViewingTransaction(policy.txHash || null)}
                          className="text-cora-primary text-xs flex items-center hover:underline"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                          </svg>
                          View Blockchain Transaction
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    <button 
                      className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-all flex items-center justify-center group-hover:text-white"
                      aria-label={`View details for ${policy.name}`}
                      title={`View details for ${policy.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Details
                    </button>
                    <button 
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center justify-center transform group-hover:scale-105"
                      aria-label={`File claim for ${policy.name}`}
                      title={`File claim for ${policy.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                      </svg>
                      File Claim
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && policies.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cora-primary/20 to-purple-600/20 flex items-center justify-center mb-6 border border-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cora-primary" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Policies Found</h3>
            <p className="text-gray-400 mb-8 text-center max-w-md">You don't have any insurance policies yet. Let's find the perfect coverage for your needs.</p>
            <button 
              onClick={() => setShowNewPolicyModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-300 flex items-center transform hover:scale-105"
              aria-label="Create your first policy"
              title="Create your first policy"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Get Your First Policy
            </button>
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
            <button
              onClick={() => handlePayPremium(createdPolicy.policyId, createdPolicy.premium)}
              disabled={processingPayment}
              className="w-full mt-4 py-3 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 flex items-center justify-center"
            >
              {processingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  Pay Premium Now
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
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
    </div>
  );
} 