import React, { useState, useEffect } from 'react';
import { usePolicyManagement } from '../hooks/usePolicyManagement';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { Policy } from '../view-functions/policyService';
import { Toaster } from 'react-hot-toast';
import { formatAddress, formatCurrency } from '../utils/helpers';

export default function CreatePolicyDemo() {
  // Get wallet and wallet functions
  const { account, connect, wallets, signAndSubmitTransaction } = useWallet();
  
  const { 
    policies, 
    loading, 
    fetchPolicies, 
    createPolicy, 
    payPremium,
    fileClaim,
    transactionInProgress 
  } = usePolicyManagement();

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
  }, [account?.address, fetchPolicies]);

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

  // Form submit handlers
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      alert('Please connect your wallet');
      return;
    }

    try {
      // Call the policy service to create a policy
      const result = await createPolicy({
        coverageAmount: formData.coverageAmount,
        premiumAmount: formData.premiumAmount,
        durationDays: formData.termLength * 365
      });
      
      // Refresh policies after a delay to allow blockchain confirmation
      setTimeout(() => {
        fetchPolicies();
      }, 2000);
    } catch (error) {
      console.error("Error in policy creation:", error);
      alert(`Failed to create policy: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handlePayPremium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      alert('Please connect your wallet');
      return;
    }

    await payPremium({
      policyId: paymentData.policyId,
      amount: paymentData.amount
    });
  };

  const handleFileClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) {
      alert('Please connect your wallet');
      return;
    }

    await fileClaim({
      policyId: claimData.policyId,
      claimAmount: claimData.amount,
      claimReason: claimData.reason
    });
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
      
      <h1 className="text-3xl font-bold mb-8">Insurance Policy Management</h1>
      
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
          <h2 className="text-xl font-semibold mb-4">File a Claim</h2>
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
                    Policy {policy.policy_id} - {formatCurrency(policy.coverage_amount)}
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
              <label className="block text-black mb-2">Reason</label>
              <textarea
                name="reason"
                value={claimData.reason}
                onChange={handleClaimInputChange}
                className="w-full p-2 border rounded"
                required
              ></textarea>
            </div>
            
            <button
              type="submit"
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
              disabled={transactionInProgress || !account || !claimData.policyId}
            >
              {transactionInProgress ? 'Submitting...' : 'File Claim'}
            </button>
          </form>
        </div>
        
        {/* Policy List */}
        <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-semibold">My Policies</h2>
            <button
              onClick={fetchPolicies}
              className="bg-gray-200 px-4 py-1 rounded hover:bg-gray-300"
              disabled={loading || !account}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {loading ? (
            <p className="text-center py-4">Loading policies...</p>
          ) : policies.length === 0 ? (
            <p className="text-center py-4 text-black">No policies found. Create your first policy!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Coverage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Premium</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {policies.map((policy) => (
                    <tr key={policy.policy_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-black">{policy.policy_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{formatCurrency(policy.coverage_amount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">{formatCurrency(policy.premium_amount)}/year</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${policy.status === 'Active' ? 'bg-green-100 text-green-800' : 
                            policy.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'}`}>
                          {policy.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                        <button 
                          onClick={() => selectPolicyForPayment(policy)}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          Pay
                        </button>
                        <button 
                          onClick={() => selectPolicyForClaim(policy)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          Claim
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 