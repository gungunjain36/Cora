import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { blockchainService } from '../../utils/blockchainService';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '../ui/dialog';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { TransactionButton } from "../ui/TransactionButton";
import { toast } from "react-hot-toast";

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
  const [loading, setLoading] = useState(true);
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
  const [isAdmin, setIsAdmin] = useState(false);
  const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0xd290fb8c741c327618b21904475cfda58f566471e43f44495f4525295553c1ae";

  useEffect(() => {
    const checkAdmin = async () => {
      if (!account?.address) return false;
      
      // Check if the connected wallet is the admin account
      const isContractOwner = account.address.toString() === CONTRACT_ADDRESS;
      setIsAdmin(isContractOwner);
      
      return isContractOwner;
    };
    
    const fetchClaims = async () => {
      if (!account?.address) return;
      
      try {
        setLoading(true);
        
        // Mock data for now - in a real implementation, 
        // this would fetch claims from your blockchain through a service
        const mockClaims: Claim[] = [
          {
            id: "0",
            policy_id: "1", 
            policy_name: "Term Life Insurance",
            amount: "5000",
            date: new Date().toISOString(),
            status: 'Pending',
          }
        ];
        
        setClaims(mockClaims);
      } catch (error) {
        console.error("Error fetching claims:", error);
        toast.error("Failed to load claims");
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
    fetchClaims();
  }, [account?.address, CONTRACT_ADDRESS]);

  const handleVerifyClaim = async (claimId: string) => {
    if (!account?.address || !isAdmin) {
      toast.error("Only the admin can verify claims");
      return { success: false };
    }
    
    try {
      // Create verification hash - in a real-world scenario, 
      // this might involve off-chain processing and evidence verification
      const verificationHash = `0x${Date.now().toString(16)}`;
      
      // Submit transaction to update claim status
      const result = await window.aptos?.signAndSubmitTransaction({
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::claim_processor::update_claim_status`,
        type_arguments: [],
        arguments: [
          claimId,  // claim_id
          "1",      // new_status: VERIFIED = 1
          verificationHash
        ]
      });
      
      if (result) {
        // Update the local list of claims
        setClaims(claims.map(claim => 
          claim.id === claimId 
            ? {...claim, status: 'VERIFIED', verificationHash} 
            : claim
        ));
        
        return { success: true, txHash: result.hash };
      }
      
      return { success: false, message: "Transaction failed" };
    } catch (error) {
      console.error("Error verifying claim:", error);
      return { success: false, error };
    }
  };

  const handleProcessClaim = async (claimId: string) => {
    if (!account?.address || !isAdmin) {
      toast.error("Only the admin can process claims");
      return { success: false };
    }
    
    try {
      // Submit transaction to process claim payment
      const result = await window.aptos?.signAndSubmitTransaction({
        type: "entry_function_payload",
        function: `${CONTRACT_ADDRESS}::claim_processor::process_claim_payment`,
        type_arguments: [],
        arguments: [
          claimId  // claim_id
        ]
      });
      
      if (result) {
        // Update the local list of claims
        setClaims(claims.map(claim => 
          claim.id === claimId 
            ? {...claim, status: 'PAID'} 
            : claim
        ));
        
        return { success: true, txHash: result.hash };
      }
      
      return { success: false, message: "Transaction failed" };
    } catch (error) {
      console.error("Error processing claim payment:", error);
      return { success: false, error };
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cora-primary"></div>
      </div>
    );
  }

  if (!account?.address) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold mb-4">Connect Your Wallet</h2>
        <p className="mb-6 text-cora-gray">Please connect your wallet to view and manage your claims.</p>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold mb-4">No Claims Found</h2>
        <p className="mb-6 text-cora-gray">You don't have any insurance claims yet.</p>
        <p className="text-cora-gray">To file a claim, go to the Policies tab and select "File Claim" on your policy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">
          {isAdmin ? "Claims Management" : "My Claims"}
        </h2>
      </div>
      
      <div className="space-y-6">
        {claims.map((claim) => (
          <div key={claim.id} className="backdrop-blur-xl bg-black/40 rounded-2xl border border-white/10 p-5 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div>
                <div className="text-sm text-cora-gray">Claim #{claim.id}</div>
                <h3 className="text-xl font-medium">
                  {claim.policy_name || `Policy #${claim.policy_id}`}
                </h3>
                <div className="flex items-center mt-1">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    claim.status === 'PAID' ? 'bg-green-900/50 text-green-400' :
                    claim.status === 'VERIFIED' ? 'bg-blue-900/50 text-blue-400' :
                    claim.status === 'REJECTED' ? 'bg-red-900/50 text-red-400' :
                    'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {claim.status}
                  </span>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end">
                <div className="text-cora-gray text-sm">Claim Amount</div>
                <div className="text-xl font-semibold text-cora-primary">${claim.amount}</div>
                <div className="text-cora-gray text-sm mt-1">
                  {new Date(claim.date).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div className="bg-white/5 p-4 rounded-lg mb-6">
              <div className="text-cora-gray text-xs mb-1">Reason for Claim</div>
              <div className="font-medium">{claim.reason}</div>
            </div>
            
            {claim.verificationHash && (
              <div className="bg-white/5 p-4 rounded-lg mb-6">
                <div className="text-cora-gray text-xs mb-1">Verification Hash</div>
                <div className="font-medium text-sm break-all">{claim.verificationHash}</div>
              </div>
            )}
            
            {isAdmin && (
              <div className="flex flex-col md:flex-row gap-3 mt-6">
                {claim.status === 'Pending' && (
                  <TransactionButton
                    onClick={() => handleVerifyClaim(claim.id)}
                    loadingText="Verifying..."
                    successText="Claim verified successfully!"
                    errorText="Failed to verify claim"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-lg hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
                  >
                    Verify Claim
                  </TransactionButton>
                )}
                
                {claim.status === 'VERIFIED' && (
                  <TransactionButton
                    onClick={() => handleProcessClaim(claim.id)}
                    loadingText="Processing payout..."
                    successText="Claim paid successfully!"
                    errorText="Failed to process payment"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-400 text-white rounded-lg hover:opacity-90 transition-all shadow-lg shadow-green-500/20"
                  >
                    Process Payout
                  </TransactionButton>
                )}
                
                {claim.status === 'Pending' && (
                  <TransactionButton
                    onClick={async () => {
                      // Transaction to reject claim
                      return { success: true };
                    }}
                    loadingText="Rejecting..."
                    successText="Claim rejected"
                    errorText="Failed to reject claim"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-400 text-white rounded-lg hover:opacity-90 transition-all shadow-lg shadow-red-500/20"
                  >
                    Reject Claim
                  </TransactionButton>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 