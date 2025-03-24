import { 
  POLICY_REGISTRY_ABI,
  PREMIUM_ESCROW_ABI,
  CLAIM_PROCESSOR_ABI
} from "@/utils/abi";
import { hexToBytes } from "@/utils/helpers";
import { aptosClient } from "@/utils/aptosClient";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { 
  AptosClient, 
  Types, 
  TxnBuilderTypes, 
  BCS,
  HexString
} from "aptos";
import { NETWORK, APTOS_API_KEY } from "@/constants";

// Types
export type Policy = {
  policy_id: string;
  policyholder: string;
  coverage_amount: number;
  premium_amount: number;
  term_length: number;
  status: string;
  created_at: number;
  next_payment_due?: number;
  isPremiumPaid?: boolean;
};

// Constants - Read from environment variables
const MODULE_ADDRESS = import.meta.env.VITE_MODULE_ADDRESS || "0xe53177a3c1354e7a47df7facaf2161297e688e21f5ef9e6a9db81b07337056cc";
const API_ENDPOINT = NETWORK === 'testnet' 
  ? 'https://fullnode.testnet.aptoslabs.com'
  : 'https://fullnode.mainnet.aptoslabs.com';

// ==========================================
// TRANSACTION PAYLOAD BUILDERS
// ==========================================

const buildCreatePolicyPayload = (
  coverageAmount: number,
  premiumAmount: number,
  documentHash: string = "01020304",
  durationDays: number = 365
): Types.EntryFunctionPayload => {
  return {
    function: `${MODULE_ADDRESS}::policy_registry::create_policy`,
    type_arguments: [],
    arguments: [
      MODULE_ADDRESS, // Policyholder address
      coverageAmount.toString(), // Convert to string for CLI compatibility
      premiumAmount.toString(),
      durationDays.toString(),
      hexToBytes(documentHash) // Keep hex conversion
    ]
  };
};

const buildPayPremiumPayload = (
  policyId: string | number
): Types.EntryFunctionPayload => {
  const policyIdInt = typeof policyId === 'string' ? parseInt(policyId) : policyId;
  return {
    function: `${MODULE_ADDRESS}::premium_escrow::pay_premium`,
    type_arguments: [],
    arguments: [policyIdInt]
  };
};

const buildFileClaimPayload = (
  policyId: string | number,
  claimAmount: number,
  claimReason: string
): Types.EntryFunctionPayload => {
  const policyIdInt = typeof policyId === 'string' ? parseInt(policyId) : policyId;
  return {
    function: `${MODULE_ADDRESS}::claim_processor::file_claim`,
    type_arguments: [],
    arguments: [
      policyIdInt,
      claimAmount,
      claimReason
    ]
  };
};

// Function to create a policy
export const createPolicy = async ({
  walletAddress,
  coverageAmount,
  premiumAmount,
  documentHash = "01020304",
  durationDays = 365
}: {
  walletAddress: string;
  coverageAmount: number;
  premiumAmount: number;
  documentHash?: string;
  durationDays?: number;
}): Promise<{ hash: string }> => {
  try {
    // Build payload in wallet-adapter expected format
    const payload = {
      type: "entry_function_payload",
      function: `${MODULE_ADDRESS}::policy_registry::create_policy`,
      type_arguments: [],
      arguments: [
        walletAddress, // Policyholder address
        coverageAmount.toString(),
        premiumAmount.toString(),
        durationDays.toString(),
        documentHash // Already in hex format
      ]
    };

    return {
      hash: JSON.stringify(payload)
    };
  } catch (error) {
    console.error("Error creating policy payload:", error);
    throw error;
  }
};

// Function to pay premium for a policy
export const payPremium = async ({
  policyId,
  amount
}: {
  policyId: string | number;
  amount: number;
}): Promise<{ hash: string }> => {
  try {
    const payload = {
      type: "entry_function_payload",
      function: `${MODULE_ADDRESS}::premium_escrow::pay_premium`,
      type_arguments: [],
      arguments: [
        policyId.toString(),
        amount.toString()
      ]
    };

    return {
      hash: JSON.stringify(payload)
    };
  } catch (error) {
    console.error("Error creating premium payment payload:", error);
    throw error;
  }
};

// Function to file a claim
export const fileClaim = async ({
  policyId,
  claimantAddress,
  claimAmount,
  claimReason
}: {
  policyId: string | number;
  claimantAddress: string;
  claimAmount: number;
  claimReason: string;
}): Promise<{ hash: string }> => {
  try {
    const payload = {
      type: "entry_function_payload",
      function: `${MODULE_ADDRESS}::claim_processor::file_claim`,
      type_arguments: [],
      arguments: [
        policyId.toString(),
        claimantAddress,
        claimAmount.toString(),
        claimReason
      ]
    };

    return {
      hash: JSON.stringify(payload)
    };
  } catch (error) {
    console.error("Error creating claim payload:", error);
    throw error;
  }
};

// Function to get user policies from the chain
export const getUserPolicies = async (
  accountAddress: string
): Promise<Policy[]> => {
  try {
    console.log(`Fetching policies for wallet: ${accountAddress}`);
    
    // Initialize Aptos client
    const client = new AptosClient(API_ENDPOINT);
    
    try {
      // First, try to get the policy store from the module address
      // Based on the transaction data, the policies are stored in a central store at MODULE_ADDRESS
      const resources = await client.getAccountResources(MODULE_ADDRESS);
      
      // Look for policy store resource
      const policyStoreType = `${MODULE_ADDRESS}::policy_registry::PolicyStore`;
      console.log(`Looking for resource type: ${policyStoreType}`);
      
      const policyResource = resources.find(r => r.type === policyStoreType);
      
      if (policyResource && policyResource.data) {
        // Process policy data from the store
        console.log("Found policy store resource:", policyResource.type);
        const data = policyResource.data as any;
        
        if (data.policies && Array.isArray(data.policies)) {
          console.log(`Found ${data.policies.length} policies in total`);
          
          // Filter policies that belong to the user
          const userPolicies = data.policies.filter((p: any) => 
            p.policyholder_address.toLowerCase() === accountAddress.toLowerCase()
          );
          
          console.log(`Found ${userPolicies.length} policies for user ${accountAddress}`);
          
          if (userPolicies.length > 0) {
            // Transform data structure to match our Policy type
            return userPolicies.map((p: any) => ({
              policy_id: p.id,
              policyholder: p.policyholder_address,
              coverage_amount: parseInt(p.coverage_amount),
              premium_amount: parseInt(p.premium_amount),
              term_length: Math.floor((parseInt(p.end_time) - parseInt(p.start_time)) / 86400), // Convert seconds to days
              status: p.active_status === 0 ? "ACTIVE" : "INACTIVE", // Map status based on active_status field
              created_at: parseInt(p.start_time),
              next_payment_due: parseInt(p.start_time) + 2592000 // Set to 30 days after creation as a placeholder
            }));
          }
        }
      }
      
      console.log("No policies found for user on chain");
      return []; // Return empty array if no policies found for this user
    } catch (e) {
      console.error("Error fetching from chain:", e);
      throw e; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("Error in getUserPolicies:", error);
    // Return empty array on error so UI doesn't break
    return [];
  }
};

// Function to check if premium is paid for a policy
export const getPremiumPaymentStatus = async (
  policyId: string | number
): Promise<boolean> => {
  try {
    // Initialize Aptos client
    const client = new AptosClient(API_ENDPOINT);
    
    // Get premium escrow resources
    const resources = await client.getAccountResources(MODULE_ADDRESS);
    
    // Look for premium escrow resource
    const premiumEscrowType = `${MODULE_ADDRESS}::premium_escrow::PremiumEscrow`;
    const premiumResource = resources.find(r => r.type === premiumEscrowType);
    
    if (premiumResource && premiumResource.data) {
      const data = premiumResource.data as any;
      
      // Check if payment status exists for this policy
      if (data.payments && typeof data.payments === 'object') {
        const policyIdStr = policyId.toString();
        return !!data.payments[policyIdStr]; // Return true if payment exists
      }
    }
    
    // Default to unpaid if not found
    return false;
  } catch (error) {
    console.error("Error checking premium payment status:", error);
    return false; // Default to unpaid on error
  }
}; 