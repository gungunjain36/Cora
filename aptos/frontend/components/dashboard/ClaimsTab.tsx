import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { blockchainService } from '../../utils/blockchainService';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';

type Claim = {
  id: string;
  policy_id: string;
  policy_name: string;
  amount: string;
  date: string;
  status: 'Pending' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected';
  txHash?: string; // Add transaction hash for blockchain tracking
};

type ClaimsTabProps = {
  userId: string;
};

type NewClaimFormData = {
  policy_id: string;
  claim_amount: number;
  claim_reason: string;
  additional_details: string;
};

export function ClaimsTab({ userId }: ClaimsTabProps) {
  const { account } = useWallet();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [newClaim, setNewClaim] = useState<NewClaimFormData>({
    policy_id: '',
    claim_amount: 0,
    claim_reason: '',
    additional_details: ''
  });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [viewingTransaction, setViewingTransaction] = useState<string | null>(null);

  // Fetch claims when wallet address changes
  useEffect(() => {
    if (account?.address) {
      fetchUserPolicies(account.address);
      fetchUserClaims(account.address);
    }
  }, [account?.address]);

  const fetchUserPolicies = async (walletAddress: string) => {
    try {
      setLoading(true);
      const result = await blockchainService.getUserPolicies(walletAddress);
      
      if (result.success && result.data?.policies) {
        setPolicies(result.data.policies);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mock function to fetch user claims - in a real app, this would interact with the blockchain
  const fetchUserClaims = async (walletAddress: string) => {
    try {
      setLoading(true);
      // For demo purposes, we'll use sample data
      // In a real implementation, this would call a blockchain service
      setTimeout(() => {
        setClaims([
          {
            id: 'CLM-123456',
            policy_id: 'POL-1001',
            policy_name: 'Term Life Insurance',
            amount: '$15,000',
            date: '2024-03-15',
            status: 'Approved',
            txHash: '0xa1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef'
          },
          {
            id: 'CLM-789012',
            policy_id: 'POL-1002',
            policy_name: 'Health Insurance',
            amount: '$5,000',
            date: '2024-03-01',
            status: 'Pending',
            txHash: '0xf0e1d2c3b4a5968778695a4b3c2d1e0f1e2d3c4b5a6978869504a3b2c1d0e9f'
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching claims:', error);
      setLoading(false);
    }
  };

  const handleCreateClaim = async () => {
    if (!account?.address) {
      setError('Please connect your wallet to create a claim.');
      return;
    }

    if (!newClaim.policy_id) {
      setError('Please select a policy for your claim.');
      return;
    }

    if (newClaim.claim_amount <= 0) {
      setError('Please enter a valid claim amount.');
      return;
    }

    if (!newClaim.claim_reason.trim()) {
      setError('Please provide a reason for your claim.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      setTransactionStatus('Validating wallet and preparing transaction...');

      // First make sure the user's wallet is mapped to their account
      const mappingResult = await blockchainService.verifyWalletMapping(account.address.toString());
      
      if (!mappingResult.success) {
        setError('Failed to verify wallet ownership. Please try again.');
        return;
      }

      setTransactionStatus('Submitting claim to blockchain...');

      // Submit the claim
      const claimData = {
        amount: newClaim.claim_amount,
        reason: newClaim.claim_reason,
        details: newClaim.additional_details,
        submitted_date: new Date().toISOString()
      };

      const result = await blockchainService.submitClaim(
        account.address.toString(),
        newClaim.policy_id,
        claimData
      );
      
      if (result.success) {
        // Update transaction status
        setTransactionStatus('Claim submitted successfully!');
        setTransactionHash(result.data?.txHash || null);
        setSuccess('Your claim has been submitted successfully and is pending review.');
        
        // Add the new claim to the list
        const selectedPolicy = policies.find(p => p.policy_id === newClaim.policy_id);
        const policyName = selectedPolicy?.policy_type || 'Insurance Policy';
        
        setClaims(prev => [
          {
            id: result.data.claim_id,
            policy_id: newClaim.policy_id,
            policy_name: policyName,
            amount: `$${newClaim.claim_amount.toLocaleString()}`,
            date: new Date().toISOString().split('T')[0],
            status: 'Pending',
            txHash: result.data.txHash
          },
          ...prev
        ]);
        
        setTimeout(() => {
          setShowNewClaimModal(false);
          setTransactionHash(null);
          setTransactionStatus('');
          setSuccess(null);
        
          // Reset form
          setNewClaim({
            policy_id: '',
            claim_amount: 0,
            claim_reason: '',
            additional_details: ''
          });
        }, 3000);
      } else {
        setError(result.message || 'Failed to submit claim. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setProcessing(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setNewClaim(prev => ({
      ...prev,
      [name]: name === 'claim_amount' ? Number(value) : value
    }));
  };

  return (
    <div className="backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Claims History</h2>
        <button 
          onClick={() => setShowNewClaimModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center"
          aria-label="Submit new claim"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Claim
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-10 h-10 text-cora-primary animate-spin" />
          </div>
        ) : (
          <>
            {claims.length > 0 ? (
              <div className="space-y-4">
                {claims.map((claim) => (
                  <div key={claim.id} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-cora-primary/50 transition-all duration-300">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-gray-400 text-xs">Claim ID</p>
                          <p className="text-white font-medium">{claim.id}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          claim.status === "Approved" ? "bg-green-900/30 text-green-400 border border-green-500/20" :
                          claim.status === "Paid" ? "bg-blue-900/30 text-blue-400 border border-blue-500/20" :
                          claim.status === "Pending" ? "bg-yellow-900/30 text-yellow-400 border border-yellow-500/20" :
                          claim.status === "Under Review" ? "bg-orange-900/30 text-orange-400 border border-orange-500/20" :
                          "bg-red-900/30 text-red-400 border border-red-500/20"
                        }`}>
                          {claim.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-gray-400 text-xs">Policy</p>
                          <p className="text-white">{claim.policy_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Amount</p>
                          <p className="text-white">{claim.amount}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs">Submission Date</p>
                          <p className="text-white">{claim.date}</p>
                        </div>
                      </div>

                      {claim.txHash && (
                        <div className="pt-2 mb-4 border-t border-white/10">
                          <button 
                            onClick={() => setViewingTransaction(claim.txHash || null)}
                            className="text-cora-primary text-xs flex items-center hover:underline mt-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.415 1.415l.707-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z" clipRule="evenodd" />
                            </svg>
                            View Blockchain Transaction
                          </button>
                        </div>
                      )}
                      
                      <div className="flex space-x-3">
                        <button 
                          className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors flex items-center justify-center"
                          aria-label={`View details for claim ${claim.id}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          View Details
                        </button>
                        
                        {claim.status === "Pending" && (
                          <button 
                            className="flex-1 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl transition-colors flex items-center justify-center border border-red-500/20"
                            aria-label={`Cancel claim ${claim.id}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Cancel Claim
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-400 mb-6 text-center max-w-md">You haven't filed any claims yet. If you need to make a claim on your insurance policy, you can start the process here.</p>
                <button 
                  onClick={() => setShowNewClaimModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center"
                  aria-label="File your first claim"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  File Your First Claim
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* New Claim Modal */}
      <Dialog open={showNewClaimModal} onOpenChange={setShowNewClaimModal}>
        <DialogContent className="bg-[#161b22] border border-white/10">
          <DialogTitle className="text-white">Submit New Claim</DialogTitle>
          <DialogDescription className="text-gray-400">
            Please provide the details of your claim for processing.
          </DialogDescription>
          
          <div className="space-y-4 my-4">
            <div>
              <label htmlFor="policy-select" className="block text-sm font-medium text-gray-300 mb-1">Select Policy</label>
              <select
                id="policy-select"
                name="policy_id"
                value={newClaim.policy_id}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary"
                aria-label="Select policy"
              >
                <option value="">-- Select a policy --</option>
                {policies.map((policy) => (
                  <option key={policy.policy_id} value={policy.policy_id}>
                    {policy.policy_type} - ${policy.coverage_amount?.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="claim-amount" className="block text-sm font-medium text-gray-300 mb-1">Claim Amount</label>
              <input
                id="claim-amount"
                type="number"
                name="claim_amount"
                value={newClaim.claim_amount}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary"
                placeholder="Enter claim amount"
                aria-label="Claim amount"
              />
            </div>
            
            <div>
              <label htmlFor="claim-reason" className="block text-sm font-medium text-gray-300 mb-1">Reason for Claim</label>
              <input
                id="claim-reason"
                type="text"
                name="claim_reason"
                value={newClaim.claim_reason}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary"
                placeholder="Brief reason for the claim"
                aria-label="Reason for claim"
              />
            </div>
            
            <div>
              <label htmlFor="claim-details" className="block text-sm font-medium text-gray-300 mb-1">Additional Details</label>
              <textarea
                id="claim-details"
                name="additional_details"
                value={newClaim.additional_details}
                onChange={handleInputChange}
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary"
                placeholder="Provide any additional details about your claim"
                aria-label="Additional claim details"
              />
            </div>
            
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-400 px-4 py-3 rounded-md">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-900/30 border border-green-700/50 text-green-400 px-4 py-3 rounded-md">
                {success}
              </div>
            )}
            
            {transactionStatus && (
              <div className="bg-blue-900/30 border border-blue-700/50 text-blue-400 px-4 py-3 rounded-md flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {transactionStatus}
              </div>
            )}
            
            {transactionHash && (
              <div className="bg-gray-800 p-3 rounded-md border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Transaction Hash</p>
                <p className="text-sm text-white break-all font-mono">{transactionHash}</p>
                <a 
                  href={`https://explorer.aptoslabs.com/txn/${transactionHash}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cora-primary text-xs flex items-center hover:underline mt-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                  </svg>
                  View on Aptos Explorer
                </a>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <DialogClose asChild>
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleCreateClaim}
              disabled={processing || !!success}
              className="bg-gradient-to-r from-cora-primary to-purple-600 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : success ? (
                'Claim Submitted'
              ) : (
                'Submit Claim'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Transaction Details Dialog */}
      <Dialog open={!!viewingTransaction} onOpenChange={(open) => !open && setViewingTransaction(null)}>
        <DialogContent className="bg-[#161b22] border border-white/10 max-w-md mx-auto">
          <DialogTitle className="text-white text-xl">Blockchain Transaction</DialogTitle>
          <DialogDescription className="text-gray-400">
            Details of the on-chain transaction for this claim.
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
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
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