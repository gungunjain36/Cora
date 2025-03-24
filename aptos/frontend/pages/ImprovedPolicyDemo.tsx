import React, { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { 
  createPolicy, 
  payPremium, 
  fileClaim, 
  getUserPolicies, 
  getPremiumPaymentStatus,
  Policy 
} from '../view-functions/policyService';
import { Toaster, toast } from 'react-hot-toast';
import { formatAddress, formatCurrency } from '../utils/helpers';

export default function ImprovedPolicyDemo() {
  // Get wallet and wallet functions
  const { account, connect, wallets, signAndSubmitTransaction } = useWallet();
  
  // State
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactionInProgress, setTransactionInProgress] = useState(false);

  const [formData, setFormData] = useState({
    coverageAmount: 10000,
    premiumAmount: 100,
    termLength: 1, // in years
  });

  const [paymentData, setPaymentData] = useState({
    policyId: '',
    amount: 0,
  });

  const [claimData, setClaimData] = useState({
    policyId: '',
    amount: 0,
    reason: 'Medical expenses',
  });

  // Fetch policies when wallet connects
  useEffect(() => {
    if (account?.address) {
      fetchPolicies();
    }
  }, [account?.address]);

  // Fetch user policies
  const fetchPolicies = async () => {
    if (!account?.address) return;
    
    setLoading(true);
    try {
      console.log(`Fetching policies for wallet address: ${account.address.toString()}`);
      const fetchedPolicies = await getUserPolicies(account.address.toString());
      console.log(`Successfully fetched ${fetchedPolicies.length} policies from chain:`, fetchedPolicies);
      setPolicies(fetchedPolicies);
      
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
        
        console.log("Policies with payment status:", policiesWithPaymentStatus);
        setPolicies(policiesWithPaymentStatus);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
      toast.error("Failed to fetch policies");
    } finally {
      setLoading(false);
    }
  };

  // Connect wallet handler
  const handleConnectWallet = async () => {
    if (wallets.length > 0) {
      await connect(wallets[0].name);
    }
  };

  // Form change handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value ? Number(value) : 0
    }));
  };

  const handlePaymentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: name === 'amount' ? (value ? Number(value) : 0) : value
    }));
  };

  const handleClaimInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setClaimData(prev => ({
      ...prev,
      [name]: name === 'amount' ? (value ? Number(value) : 0) : value
    }));
  };

  // Form submit handlers - Direct Wallet Integration
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    setTransactionInProgress(true);
    try {
      console.log("Starting policy creation process with form data:", formData);
      
      // Get transaction payload from the service
      console.log("Calling createPolicy service with params:", {
        walletAddress: account.address.toString(),
        coverageAmount: formData.coverageAmount,
        premiumAmount: formData.premiumAmount,
        durationDays: formData.termLength * 365
      });
      
      const result = await createPolicy({
        walletAddress: account.address.toString(),
        coverageAmount: formData.coverageAmount,
        premiumAmount: formData.premiumAmount,
        durationDays: formData.termLength * 365
      });
      
      console.log("Received result from createPolicy service:", result);
      
      // Check if result and hash exist before parsing
      if (!result || !result.hash) {
        console.error("Invalid response structure:", result);
        throw new Error("Invalid response from createPolicy service");
      }
      
      console.log("Raw hash value:", result.hash);
      
      // Parse the JSON payload directly with error handling
      let payload;
      try {
        payload = JSON.parse(result.hash);
        console.log("Successfully parsed payload:", payload);
      } catch (parseError) {
        console.error("Failed to parse transaction payload:", parseError);
        console.error("Raw payload that failed to parse:", result.hash);
        throw new Error("Invalid transaction payload format");
      }
      
      // Validate payload structure with more robust checking
      if (!payload || typeof payload !== 'object') {
        console.error("Payload is not a valid object:", payload);
        throw new Error("Transaction payload is not a valid object");
      }
      
      console.log("Payload keys:", Object.keys(payload));
      
      if (!payload.function || !payload.arguments) {
        console.error("Missing required fields in payload:", payload);
        throw new Error("Transaction payload missing required fields");
      }

      // Submit transaction via wallet adapter
      console.log("Submitting transaction with payload:", JSON.stringify(payload, null, 2));
      
      // FIX: Use the correct format expected by newer Aptos wallet adapter versions
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: payload.function,
          functionArguments: payload.arguments,
          typeArguments: payload.type_arguments || []
        }
      });
      
      console.log("Transaction response received:", response);
      toast.success("Policy created successfully!");
      console.log("Transaction successful:", response);
      
      // Refresh policies after a delay to allow blockchain confirmation
      console.log("Scheduling policy refresh in 2 seconds");
      setTimeout(() => {
        console.log("Refreshing policies after successful transaction");
        fetchPolicies();
      }, 2000);
    } catch (txError) {
      console.error("Transaction submission error:", txError);
      console.error("Error details:", JSON.stringify(txError, Object.getOwnPropertyNames(txError)));
      toast.error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handlePayPremium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    setTransactionInProgress(true);
    try {
      console.log("Starting premium payment process");
      
      // Get transaction payload from the service
      const result = await payPremium({
        policyId: paymentData.policyId,
        amount: paymentData.amount
      });
      
      // Parse the JSON payload directly with error handling
      let payload;
      try {
        payload = JSON.parse(result.hash);
        console.log("Successfully parsed payment payload:", payload);
      } catch (parseError) {
        console.error("Failed to parse transaction payload:", parseError);
        console.error("Raw payload that failed to parse:", result.hash);
        throw new Error("Invalid transaction payload format");
      }
      
      // Submit transaction via wallet adapter
      console.log("Submitting payment transaction with payload:", JSON.stringify(payload, null, 2));
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: payload.function,
          functionArguments: payload.arguments,
          typeArguments: payload.type_arguments || []
        }
      });
      
      toast.success("Premium paid successfully!");
      console.log("Transaction successful:", response);
      
      // Refresh policies after a delay to allow blockchain confirmation
      setTimeout(() => {
        fetchPolicies();
      }, 2000);
    } catch (txError) {
      console.error("Transaction submission error:", txError);
      toast.error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    setTransactionInProgress(true);
    try {
      console.log("Starting claim filing process");
      
      // Get transaction payload from the service
      const result = await fileClaim({
        policyId: claimData.policyId,
        claimantAddress: account.address.toString(),
        claimAmount: claimData.amount,
        claimReason: claimData.reason
      });
      
      // Parse the JSON payload directly with error handling
      let payload;
      try {
        payload = JSON.parse(result.hash);
        console.log("Successfully parsed claim payload:", payload);
      } catch (parseError) {
        console.error("Failed to parse transaction payload:", parseError);
        console.error("Raw payload that failed to parse:", result.hash);
        throw new Error("Invalid transaction payload format");
      }
      
      // Submit transaction via wallet adapter
      console.log("Submitting claim transaction with payload:", JSON.stringify(payload, null, 2));
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: payload.function,
          functionArguments: payload.arguments,
          typeArguments: payload.type_arguments || []
        }
      });
      
      toast.success("Claim filed successfully!");
      console.log("Transaction successful:", response);
      
      // Refresh policies after a delay to allow blockchain confirmation
      setTimeout(() => {
        fetchPolicies();
      }, 2000);
    } catch (txError) {
      console.error("Transaction submission error:", txError);
      toast.error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  // Set payment details from policy
  const selectPolicyForPayment = (policy: Policy) => {
    setPaymentData({
      policyId: policy.policy_id,
      amount: policy.premium_amount,
    });
  };

  // Set claim details from policy
  const selectPolicyForClaim = (policy: Policy) => {
    setClaimData({
      policyId: policy.policy_id,
      amount: Math.round(policy.coverage_amount * 0.1), // Default to 10% of coverage
      reason: 'Medical expenses',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 text-black">
      <Toaster position="top-center" />
      
      <h1 className="text-3xl font-bold mb-8">
        Improved Insurance Policy Management 
        <span className="text-sm text-blue-600 ml-2">(Direct SDK Integration)</span>
      </h1>
      
      {!account ? (
        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
          <button 
            onClick={handleConnectWallet}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-2">Connected Wallet</h2>
          <p className="text-black">{formatAddress(account.address.toString())}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Policy Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Create New Policy</h2>
          <form onSubmit={handleCreatePolicy}>
            <div className="mb-4">
              <label className="block text-black mb-2">Coverage Amount</label>
              <input
                type="number"
                name="coverageAmount"
                value={formData.coverageAmount}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                min="1000"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-black mb-2">Premium Amount</label>
              <input
                type="number"
                name="premiumAmount"
                value={formData.premiumAmount}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                min="10"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-black mb-2">Term Length (years)</label>
              <input
                type="number"
                name="termLength"
                value={formData.termLength}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                min="1"
                max="30"
                required
              />
            </div>
            
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
              disabled={transactionInProgress || !account}
            >
              {transactionInProgress ? 'Creating...' : 'Create Policy'}
            </button>
          </form>
        </div>
        
        {/* Pay Premium Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Pay Premium</h2>
          <form onSubmit={handlePayPremium}>
            <div className="mb-4">
              <label className="block text-black mb-2">Policy ID</label>
              <select
                name="policyId"
                value={paymentData.policyId}
                onChange={handlePaymentInputChange}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select a policy</option>
                {policies.map((policy) => (
                  <option key={policy.policy_id} value={policy.policy_id}>
                    Policy {policy.policy_id} - {formatCurrency(policy.premium_amount)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-black mb-2">Amount</label>
              <input
                type="number"
                name="amount"
                value={paymentData.amount}
                onChange={handlePaymentInputChange}
                className="w-full p-2 border rounded"
                min="1"
                required
              />
            </div>
            
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={transactionInProgress || !account || !paymentData.policyId}
            >
              {transactionInProgress ? 'Processing...' : 'Pay Premium'}
            </button>
          </form>
        </div>
        
        {/* File Claim Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">File Claim</h2>
          <form onSubmit={handleFileClaim}>
            <div className="mb-4">
              <label className="block text-black mb-2">Policy ID</label>
              <select
                name="policyId"
                value={claimData.policyId}
                onChange={handleClaimInputChange}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select a policy</option>
                {policies.map((policy) => (
                  <option key={policy.policy_id} value={policy.policy_id}>
                    Policy {policy.policy_id} - Coverage: {formatCurrency(policy.coverage_amount)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-black mb-2">Claim Amount</label>
              <input
                type="number"
                name="amount"
                value={claimData.amount}
                onChange={handleClaimInputChange}
                className="w-full p-2 border rounded"
                min="1"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-black mb-2">Reason for Claim</label>
              <textarea
                name="reason"
                value={claimData.reason}
                onChange={handleClaimInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            
            <button
              type="submit"
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 disabled:bg-gray-400"
              disabled={transactionInProgress || !account || !claimData.policyId}
            >
              {transactionInProgress ? 'Processing...' : 'File Claim'}
            </button>
          </form>
        </div>
        
        {/* Policy List */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Your Policies</h2>
          
          {loading ? (
            <p className="text-black italic">Loading policies...</p>
          ) : policies.length === 0 ? (
            <p className="text-black italic">No policies found. Create one to get started!</p>
          ) : (
            <div className="space-y-4">
              {policies.map((policy) => (
                <div key={policy.policy_id} className="border p-4 rounded">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Policy #{policy.policy_id}</span>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded text-sm ${
                        policy.status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {policy.status}
                      </span>
                      
                      {policy.isPremiumPaid !== undefined && (
                        <span className={`px-2 py-1 rounded text-sm ${
                          policy.isPremiumPaid 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {policy.isPremiumPaid ? 'Premium Paid' : 'Premium Due'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Coverage:</div>
                    <div className="font-medium">{formatCurrency(policy.coverage_amount)}</div>
                    
                    <div>Premium:</div>
                    <div className="font-medium">{formatCurrency(policy.premium_amount)}</div>
                    
                    <div>Term Length:</div>
                    <div className="font-medium">{policy.term_length} days</div>
                    
                    <div>Created:</div>
                    <div className="font-medium">{new Date(policy.created_at * 1000).toLocaleDateString()}</div>
                    
                    {policy.next_payment_due && (
                      <>
                        <div>Next Payment:</div>
                        <div className="font-medium">
                          {new Date(policy.next_payment_due * 1000).toLocaleDateString()}
                        </div>
                      </>
                    )}
                    
                    <div>Policyholder:</div>
                    <div className="font-medium text-xs truncate">{formatAddress(policy.policyholder)}</div>
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => selectPolicyForPayment(policy)}
                      className={`px-2 py-1 rounded text-sm ${
                        policy.isPremiumPaid 
                          ? 'bg-gray-100 text-gray-700 cursor-not-allowed' 
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                      disabled={policy.isPremiumPaid}
                    >
                      {policy.isPremiumPaid ? 'Premium Paid' : 'Pay Premium'}
                    </button>
                    <button
                      onClick={() => selectPolicyForClaim(policy)}
                      className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-sm hover:bg-amber-200"
                    >
                      File Claim
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={fetchPolicies}
            className="mt-4 bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
            disabled={loading || !account}
          >
            {loading ? 'Refreshing...' : 'Refresh Policies'}
          </button>
        </div>
      </div>
    </div>
  );
} 