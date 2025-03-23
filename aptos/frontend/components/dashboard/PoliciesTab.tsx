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
  const { account } = useWallet();
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

  // Fetch policies from blockchain when wallet address changes
  useEffect(() => {
    if (account?.address) {
      fetchPolicies(account.address);
    }
  }, [account?.address]);

  const fetchPolicies = async (walletAddress: string) => {
    try {
      setLoading(true);
      const result = await blockchainService.getUserPolicies(walletAddress);
      
      if (result.success && result.data?.policies) {
        // Transform blockchain policies to PolicyCard format
        const formattedPolicies = result.data.policies.map((policy: any) => ({
          id: policy.policy_id,
          name: policy.policy_type || 'Life Insurance Policy',
          coverage: `$${(policy.coverage_amount || 0).toLocaleString()}`,
          premium: `$${(policy.premium || 0).toLocaleString()} / month`,
          status: policy.status || 'Active',
          details: [
            { label: 'Policy Type', value: policy.policy_type || 'N/A' },
            { label: 'Term Length', value: `${policy.term_length || 'N/A'} years` },
            { label: 'Start Date', value: policy.start_date || 'N/A' },
            { label: 'End Date', value: policy.end_date || 'N/A' },
          ]
        }));
        
        setPolicies(formattedPolicies);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePolicy = async () => {
    if (!account?.address) {
      setError('Please connect your wallet to create a policy.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      // First make sure the user's wallet is mapped to their account
      const mappingResult = await blockchainService.verifyWallet(userId, account.address);
      
      if (!mappingResult.success) {
        // If verification fails, try to create a mapping
        const createMappingResult = await blockchainService.createWalletMapping(userId, account.address);
        if (!createMappingResult.success) {
          setError('Failed to map wallet to user account. Please try again.');
          return;
        }
      }

      // Create the policy
      const result = await blockchainService.createPolicy(account.address, newPolicy);
      
      if (result.success) {
        // Refresh policies
        await fetchPolicies(account.address);
        setShowNewPolicyModal(false);
        
        // Reset form
        setNewPolicy({
          policy_type: 'Term Life',
          coverage_amount: 1000000,
          term_length: 20,
        });
      } else {
        setError(result.message || 'Failed to create policy. Please try again.');
      }
    } catch (error) {
      console.error('Error creating policy:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewPolicy(prev => ({
      ...prev,
      [name]: name === 'coverage_amount' || name === 'term_length' 
        ? Number(value) 
        : value
    }));
  };

  return (
    <div className="backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Your Policies</h2>
        <button 
          onClick={() => setShowNewPolicyModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center"
          aria-label="Create new policy"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Policy
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-10 h-10 text-cora-primary animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {policies.map((policy) => (
              <div key={policy.id} className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-cora-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-cora-primary/10">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium text-xl text-white">{policy.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      policy.status === "Active" ? "bg-green-900/30 text-green-400" :
                      policy.status === "Pending" ? "bg-yellow-900/30 text-yellow-400" :
                      "bg-red-900/30 text-red-400"
                    }`}>
                      {policy.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-gray-400 text-sm mb-1">Coverage</p>
                      <p className="font-medium text-white text-lg">{policy.coverage}</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <p className="text-gray-400 text-sm mb-1">Premium</p>
                      <p className="font-medium text-white text-lg">{policy.premium}</p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors flex items-center justify-center"
                      aria-label={`View details for ${policy.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Details
                    </button>
                    <button 
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center justify-center"
                      aria-label={`File claim for ${policy.name}`}
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
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-6 text-center max-w-md">You don't have any insurance policies yet. Let's find the perfect coverage for your needs.</p>
            <button 
              onClick={() => setShowNewPolicyModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-cora-primary to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-cora-primary/20 transition-all duration-200 flex items-center"
              aria-label="Create your first policy"
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
        <DialogContent className="bg-gray-900 border border-white/10">
          <DialogTitle className="text-white">Create New Policy</DialogTitle>
          <DialogDescription className="text-gray-400">
            Set up a new insurance policy to be created on the blockchain.
          </DialogDescription>
          
          <div className="space-y-4 my-4">
            <div>
              <label htmlFor="policy-type" className="block text-sm font-medium text-gray-300 mb-1">Policy Type</label>
              <select
                id="policy-type"
                name="policy_type"
                value={newPolicy.policy_type}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary"
                aria-label="Select policy type"
              >
                <option value="Term Life">Term Life</option>
                <option value="Whole Life">Whole Life</option>
                <option value="Universal Life">Universal Life</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="coverage-amount" className="block text-sm font-medium text-gray-300 mb-1">Coverage Amount</label>
              <input
                id="coverage-amount"
                type="number"
                name="coverage_amount"
                value={newPolicy.coverage_amount}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary"
                placeholder="Enter coverage amount"
                aria-label="Coverage amount"
              />
            </div>
            
            <div>
              <label htmlFor="term-length" className="block text-sm font-medium text-gray-300 mb-1">Term Length (years)</label>
              <input
                id="term-length"
                type="number"
                name="term_length"
                value={newPolicy.term_length}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cora-primary"
                placeholder="Enter term length in years"
                aria-label="Term length in years"
              />
            </div>
            
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-400 px-4 py-3 rounded-md">
                {error}
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <DialogClose asChild>
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleCreatePolicy}
              disabled={processing}
              className="bg-gradient-to-r from-cora-primary to-purple-600 text-white"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                'Create Policy'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 