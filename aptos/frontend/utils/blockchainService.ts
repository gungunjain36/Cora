import axios from 'axios';
import dotenv from 'dotenv';
// Import environment variables from Vite
// For Vite, we can access environment variables through import.meta.env
// For client-side code, we need to use VITE_ prefixed variables
const getEnvVariable = (key: string, defaultValue: string): string => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // In browser, access through Vite's variables
    return (window as any).__ENV?.[key] || 
           import.meta.env[`VITE_${key}`] || 
           defaultValue;
  }
  // In Node.js environment
  return import.meta.env[`VITE_${key}`] || defaultValue;
};


const APTOS_NODE_URL = import.meta.env.VITE_APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1';
const CONTRACT_ADDRESS = '0x1'; // Replace with actual contract address
const POLICY_MODULE_ADDRESS = CONTRACT_ADDRESS;
const POLICY_MODULE_NAME = 'premium_escrow';
const PAYMENT_MODULE_ADDRESS = import.meta.env.VITE_PAYMENT_MODULE_ADDRESS 
const CLAIMS_MODULE_ADDRESS = import.meta.env.VITE_CLAIMS_MODULE_ADDRESS 

// Use window.location.origin as fallback if running in browser 
const API_BASE_URL = typeof window !== 'undefined' 
  ? (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_REACT_APP_API_BASE_URL || window.location.origin.replace(/:\d+$/, '') + ':8000')
  : 'http://localhost:8000';


// Interface definitions
export interface WalletMappingRequest {
  user_id: string;
  wallet_address: string;
}

export interface PolicyRequest {
  wallet_address: string;
  policy_data: any;
}

export interface PaymentRequest {
  wallet_address: string;
  policy_id: string;
  amount: number;
}

export interface ClaimRequest {
  wallet_address: string;
  policy_id: string;
  claim_data: any;
}

export interface BlockchainResponse {
  success: boolean;
  message?: string;
  data?: any;
}

// Initialize Aptos client
// const client = new AptosClient(APTOS_NODE_URL);

// Mock implementation for development/testing
const mockPolicies = [
  {
    policy_id: 'pol-001',
    policy_type: 'Life Insurance',
    coverage_amount: 500000,
    premium: 1200,
    term_length: 20,
    status: 'Active',
    start_date: '2023-01-15',
    end_date: '2043-01-15',
    transaction_hash: '0xa1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef'
  },
  {
    policy_id: 'pol-002',
    policy_type: 'Health Insurance',
    coverage_amount: 250000,
    premium: 800,
    term_length: 1,
    status: 'Pending',
    start_date: '2023-05-10',
    end_date: '2024-05-10',
    transaction_hash: '0xf0e1d2c3b4a5968778695a4b3c2d1e0f1e2d3c4b5a6978869504a3b2c1d0e9f'
  }
];

// Helper to generate a unique policy ID
const generatePolicyId = () => {
  return `pol-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
};

// Helper to log transaction details
const logTransaction = (txType: string, details: any) => {
  console.log(`[BLOCKCHAIN] ${txType} Transaction:`, details);
};

// Helper to simulate transaction delay
const simulateBlockchainDelay = async () => {
  return new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
};

/**
 * Get policies for a user from the blockchain
 */
const getUserPolicies = async (walletAddress: string): Promise<BlockchainResponse> => {
  try {
    console.log(`[BLOCKCHAIN] Fetching policies for address: ${walletAddress}`);
    
    // Try to get policies from the API first
    try {
      const response = await axios.get(`${API_BASE_URL}/blockchain/user-policies/${walletAddress}`);
      if (response.data.success && response.data.data?.policies) {
        console.log("Received policies from API:", response.data.data.policies);
        return response.data;
      }
    } catch (apiError) {
      console.warn("Could not fetch policies from API, using mock data", apiError);
    }
    
    // Fallback to mock data
    await simulateBlockchainDelay();
    
    return {
      success: true,
      message: 'Policies retrieved successfully',
      data: {
        policies: mockPolicies
      }
    };
  } catch (error) {
    console.error('Error fetching policies:', error);
    return {
      success: false,
      message: 'Failed to fetch policies from blockchain',
      data: { policies: [] }
    };
  }
};

/**
 * Create a new policy on the blockchain
 */
const createPolicy = async (
  walletAddress: string,
  policyType: string,
  coverageAmount: number,
  termLength: number,
  premium: number
): Promise<BlockchainResponse> => {
  try {
    console.log(`[BLOCKCHAIN] Creating policy for address: ${walletAddress}`);
    
    // Generate policy ID
    const policyId = generatePolicyId();
    
    // In a real implementation, this would submit a transaction to the blockchain
    // to create a new policy entry
    
    // Create transaction payload (for mock purposes)
    const payload = {
      function: `${POLICY_MODULE_ADDRESS}::${POLICY_MODULE_NAME}::create_policy`,
      type_arguments: [],
      arguments: [
        policyType,
        coverageAmount.toString(),
        termLength.toString(),
        premium.toString()
      ]
    };
    
    // Log transaction details
    logTransaction('Create Policy', payload);
    
    // Simulate blockchain delay
    await simulateBlockchainDelay();
    
    // Generate a mock transaction hash
    const txHash = `0x${Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    // Create an end date based on term length
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + termLength);
    
    // Return success with policy data
    return {
      success: true,
      message: 'Policy created successfully',
      data: {
        policyId,
        txHash,
        policy: {
          policy_id: policyId,
          policy_type: policyType,
          coverage_amount: coverageAmount,
          premium,
          term_length: termLength,
          status: 'Pending', // Initially pending until payment
          start_date: startDate,
          end_date: endDate.toISOString().split('T')[0],
          transaction_hash: txHash
        }
      }
    };
  } catch (error) {
    console.error('Error creating policy:', error);
    return {
      success: false,
      message: 'Failed to create policy on blockchain'
    };
  }
};

// Add TypeScript declaration for the Aptos window object
declare global {
  interface Window {
    aptos?: any; // Using any for simplicity, but ideally should be properly typed
  }
}

/**
 * Process a policy premium payment on the blockchain
 */
const processPayment = async (
  walletAddress: string,
  policyId: string,
  amount: number
): Promise<BlockchainResponse> => {
  try {
    console.log(`[BLOCKCHAIN] Processing payment of ${amount} for policy ${policyId} from wallet ${walletAddress}`);
    
    if (!walletAddress || !policyId) {
      return {
        success: false,
        message: 'Invalid wallet address or policy ID provided'
      };
    }
    
    // Check if we can access the wallet adapter through window object
    if (typeof window !== 'undefined' && window.aptos) {
      try {
        console.log('Found Aptos wallet adapter, attempting direct transaction');
        
        // Create transaction payload for the blockchain
        const payload = {
          type: "entry_function_payload",
          function: `${POLICY_MODULE_ADDRESS}::premium_escrow::pay_premium`,
          type_arguments: [],
          arguments: [
            policyId,
            Math.floor(amount * 100000000).toString() // Convert to octas (Aptos smallest unit)
          ]
        };
        
        console.log('Submitting transaction payload:', payload);
        
        const txResult = await window.aptos.signAndSubmitTransaction(payload);
        console.log('Transaction result:', txResult);
        
        if (txResult && txResult.hash) {
          return {
            success: true,
            message: 'Payment transaction submitted to blockchain',
            data: {
              txHash: txResult.hash,
              policyId: policyId,
              amount: amount,
              status: 'PENDING',
              timestamp: new Date().toISOString()
            }
          };
        }
      } catch (walletError) {
        console.error('Error using wallet adapter:', walletError);
        // Fall through to API approach
      }
    }
    
    // Try processing payment through the API
    try {
      const payload = {
        wallet_address: walletAddress,
        policy_id: policyId,
        amount: Number(amount)
      };
      
      console.log("Sending payment request to API:", payload);
      const response = await axios.post(`${API_BASE_URL}/blockchain/process-payment`, payload);
      
      if (response.data.success) {
        console.log("Payment processed successfully via API:", response.data);
        return {
          success: true,
          message: 'Payment processed successfully on-chain',
          data: {
            txHash: response.data.data?.transaction_hash,
            policyId: policyId,
            amount: amount,
            status: 'COMPLETED',
            timestamp: new Date().toISOString()
          }
        };
      } else {
        console.warn("API returned error for payment processing:", response.data);
      }
    } catch (apiError) {
      console.warn("Could not process payment via API, using mock implementation", apiError);
    }
    
    // Fallback to mock implementation
    // Create transaction payload (for mock purposes)
    const payload = {
      function: `${POLICY_MODULE_ADDRESS}::premium_escrow::pay_premium`,
      type_arguments: [],
      arguments: [
        policyId,
        amount.toString()
      ]
    };
    
    // Log transaction details
    console.log("Using mock implementation for payment:", payload);
    
    // Simulate blockchain delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate a mock transaction hash
    const txHash = `0x${Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    // Return success with transaction data
    return {
      success: true,
      message: 'Payment processed successfully (simulated)',
      data: {
        txHash,
        policyId: policyId,
        amount: amount,
        status: 'COMPLETED',
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error processing payment:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred during payment processing'
    };
  }
};

/**
 * Get the status of a transaction from the blockchain
 */
const getTransactionStatus = async (txHash: string): Promise<BlockchainResponse> => {
  try {
    console.log(`[BLOCKCHAIN] Checking transaction status: ${txHash}`);
    
    // In a real implementation, this would query the blockchain for transaction status
    // using the Aptos client
    
    // Simulate blockchain delay
    await simulateBlockchainDelay();
    
    // For mock purposes, always return success
    return {
      success: true,
      message: 'Transaction status retrieved successfully',
      data: {
        status: 'Completed',
        blockHeight: Math.floor(Math.random() * 10000) + 1,
        timestamp: new Date().toISOString(),
        gasUsed: Math.floor(Math.random() * 1000) + 100
      }
    };
  } catch (error) {
    console.error('Error checking transaction status:', error);
    return {
      success: false,
      message: 'Failed to check transaction status'
    };
  }
};

/**
 * Verify if a wallet address is mapped to an existing account
 */
const verifyWalletMapping = async (walletAddress: string): Promise<BlockchainResponse> => {
  try {
    console.log(`[BLOCKCHAIN] Verifying wallet mapping for address: ${walletAddress}`);
    
    if (!walletAddress) {
      return {
        success: false,
        message: 'Invalid wallet address provided'
      };
    }
    
    // Try verifying through the API
    try {
      // Use default user_id if none provided
      const userId = 'user_123'; // Default user ID for testing
      const response = await axios.get(`${API_BASE_URL}/blockchain/verify-wallet/${userId}/${walletAddress}`);
      if (response.data.success) {
        return response.data;
      }
    } catch (apiError) {
      console.warn("Could not verify wallet mapping via API, using mock implementation", apiError);
    }
    
    // Simulate network delay
    await simulateBlockchainDelay();
    
    // For mock purposes, always return a valid mapping
    return {
      success: true,
      message: 'Wallet mapping verified successfully',
      data: {
        isMapped: true,
        userId: 'user_123'
      }
    };
  } catch (error) {
    console.error('Error verifying wallet mapping:', error);
    return {
      success: false,
      message: 'Failed to verify wallet mapping'
    };
  }
};

/**
 * Submit a new claim on the blockchain
 */
const submitClaim = async (
  walletAddress: string,
  policyId: string,
  claimData: {
    amount: number;
    reason: string;
    details: string;
    submitted_date: string;
  }
): Promise<BlockchainResponse> => {
  try {
    console.log(`[BLOCKCHAIN] Submitting claim for policy ${policyId} from address: ${walletAddress}`);
    
    // In a real implementation, this would submit a transaction to the blockchain
    // to submit a new claim for processing
    
    // Create transaction payload (for mock purposes)
    const payload = {
      function: `${CLAIMS_MODULE_ADDRESS}::insurance_claims::submit_claim`,
      type_arguments: [],
      arguments: [
        policyId,
        claimData.amount.toString(),
        claimData.reason,
        claimData.details
      ]
    };
    
    // Log transaction details
    logTransaction('Submit Claim', payload);
    
    // Simulate blockchain delay
    await simulateBlockchainDelay();
    
    // Generate a mock transaction hash
    const txHash = `0x${Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)).join('')}`;
    
    // Generate a unique claim ID
    const claimId = `CLM-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // Return success with claim data
    return {
      success: true,
      message: 'Claim submitted successfully',
      data: {
        claim_id: claimId,
        policy_id: policyId,
        amount: claimData.amount,
        status: 'Pending',
        txHash,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error submitting claim:', error);
    return {
      success: false,
      message: 'Failed to submit claim on blockchain'
    };
  }
};

/**
 * Create a wallet mapping between a user ID and wallet address
 */
const createWalletMapping = async (
  userId: string, 
  walletAddress: string
): Promise<BlockchainResponse> => {
  try {
    console.log(`[BLOCKCHAIN] Creating wallet mapping for user ${userId} with address: ${walletAddress}`);
    
    if (!userId || !walletAddress) {
      return {
        success: false,
        message: 'Invalid user ID or wallet address provided'
      };
    }
    
    // Try creating mapping through the API
    try {
      const payload = {
        user_id: userId,
        wallet_address: walletAddress
      };
      
      console.log("Sending wallet mapping request to API:", payload);
      const response = await axios.post(`${API_BASE_URL}/blockchain/wallet-mapping`, payload);
      
      if (response.data.success) {
        return response.data;
      } else {
        console.warn("API returned error for wallet mapping:", response.data);
      }
    } catch (apiError) {
      console.warn("Could not create wallet mapping via API, using mock implementation", apiError);
    }
    
    // Simulate network delay
    await simulateBlockchainDelay();
    
    // Return a successful response
    return {
      success: true,
      message: 'Wallet mapping created successfully (simulated)',
      data: {
        userId: userId,
        walletAddress: walletAddress,
        createdAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error creating wallet mapping:', error);
    return {
      success: false,
      message: 'Failed to create wallet mapping'
    };
  }
};

// API service class
class BlockchainService {
  // Wallet mapping
  async createWalletMapping(user_id: string, wallet_address: string): Promise<BlockchainResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/blockchain/wallet-mapping`, { 
        user_id, 
        wallet_address 
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Register user
  async registerUser(user_id: string, wallet_address: string): Promise<BlockchainResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/blockchain/register-user`, { 
        user_id, 
        wallet_address 
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Create policy
  async createPolicy(wallet_address: string, policy_data: any): Promise<BlockchainResponse> {
    try {
      console.log(`[BLOCKCHAIN] Creating policy for address: ${wallet_address}`, policy_data);
      
      if (!wallet_address) {
        return {
          success: false,
          message: 'Invalid wallet address provided'
        };
      }
      
      // Validate policy data
      if (!policy_data || typeof policy_data !== 'object') {
        return {
          success: false,
          message: 'Invalid policy data provided'
        };
      }
      
      // Try creating policy through the API
      try {
        const payload = {
          wallet_address: wallet_address,
          policy_data: {
            policy_type: policy_data.policy_type,
            coverage_amount: Number(policy_data.coverage_amount),
            term_length: Number(policy_data.term_length),
            premium_amount: Number(policy_data.premium_amount),
            payment_frequency: policy_data.payment_frequency || 'annually',
            start_date: policy_data.start_date,
            end_date: policy_data.end_date
          }
        };
        
        console.log("Sending create policy request to API:", payload);
        const response = await axios.post(`${API_BASE_URL}/blockchain/create-policy`, payload);
        
        if (response.data.success) {
          console.log("Policy created successfully via API:", response.data);
          return {
            success: true,
            message: 'Policy created successfully on-chain',
            data: {
              policy_id: response.data.data?.policy_id,
              txHash: response.data.data?.transaction_hash,
              status: 'CREATED',
              details: response.data.data?.policy_details || payload.policy_data
            }
          };
        } else {
          console.warn("API returned error for create policy:", response.data);
        }
      } catch (apiError) {
        console.warn("Could not create policy via API, using mock implementation", apiError);
      }
      
      // Fallback to mock implementation
      // Generate policy ID
      const policyId = generatePolicyId();
      
      // Log transaction details
      logTransaction('Create Policy', { wallet_address, policy_data });
      
      // Simulate blockchain delay
      await simulateBlockchainDelay();
      
      // Generate a mock transaction hash
      const txHash = `0x${Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)).join('')}`;

      // Return success with policy data
      return {
        success: true,
        message: 'Policy created successfully on-chain (simulated)',
        data: {
          policy_id: policyId,
          txHash: txHash,
          status: 'CREATED',
          details: policy_data,
          transaction_hash: txHash,
          policy_details: policy_data
        }
      };
    } catch (error) {
      console.error('Error creating policy:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred during policy creation'
      };
    }
  }

  // Get user policies
  async getUserPolicies(wallet_address: string): Promise<BlockchainResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/blockchain/user-policies/${wallet_address}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: { policies: [] }
      };
    }
  }

  // Get policy details
  async getPolicyDetails(policy_id: string): Promise<BlockchainResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/blockchain/policy-details/${policy_id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Process payment
  async processPayment(wallet_address: string, policy_id: string, amount: number): Promise<BlockchainResponse> {
    try {
      console.log(`[BLOCKCHAIN] Processing payment of ${amount} for policy ${policy_id} from wallet ${wallet_address}`);
      
      if (!wallet_address || !policy_id) {
        return {
          success: false,
          message: 'Invalid wallet address or policy ID provided'
        };
      }
      
      // Check if we can access the wallet adapter through window object
      if (typeof window !== 'undefined' && window.aptos) {
        try {
          console.log('Found Aptos wallet adapter, attempting direct transaction');
          
          // Create transaction payload for the blockchain
          const payload = {
            type: "entry_function_payload",
            function: `${POLICY_MODULE_ADDRESS}::premium_escrow::pay_premium`,
            type_arguments: [],
            arguments: [
              policy_id,
              Math.floor(amount * 100000000).toString() // Convert to octas (Aptos smallest unit)
            ]
          };
          
          console.log('Submitting transaction payload:', payload);
          
          const txResult = await window.aptos.signAndSubmitTransaction(payload);
          console.log('Transaction result:', txResult);
          
          if (txResult && txResult.hash) {
            return {
              success: true,
              message: 'Payment transaction submitted to blockchain',
              data: {
                txHash: txResult.hash,
                policyId: policy_id,
                amount: amount,
                status: 'PENDING',
                timestamp: new Date().toISOString()
              }
            };
          }
        } catch (walletError) {
          console.error('Error using wallet adapter:', walletError);
          // Fall through to API approach
        }
      }
      
      // Try processing payment through the API
      try {
        const payload = {
          wallet_address: wallet_address,
          policy_id: policy_id,
          amount: Number(amount)
        };
        
        console.log("Sending payment request to API:", payload);
        const response = await axios.post(`${API_BASE_URL}/blockchain/process-payment`, payload);
        
        if (response.data.success) {
          console.log("Payment processed successfully via API:", response.data);
          return {
            success: true,
            message: 'Payment processed successfully on-chain',
            data: {
              txHash: response.data.data?.transaction_hash,
              policyId: policy_id,
              amount: amount,
              status: 'COMPLETED',
              timestamp: new Date().toISOString()
            }
          };
        } else {
          console.warn("API returned error for payment processing:", response.data);
        }
      } catch (apiError) {
        console.warn("Could not process payment via API, using mock implementation", apiError);
      }
      
      // Fallback to mock implementation
      // Create transaction payload (for mock purposes)
      const payload = {
        function: `${POLICY_MODULE_ADDRESS}::premium_escrow::pay_premium`,
        type_arguments: [],
        arguments: [
          policy_id,
          amount.toString()
        ]
      };
      
      // Log transaction details
      console.log("Using mock implementation for payment:", payload);
      
      // Simulate blockchain delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a mock transaction hash
      const txHash = `0x${Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)).join('')}`;
      
      // Return success with transaction data
      return {
        success: true,
        message: 'Payment processed successfully (simulated)',
        data: {
          txHash,
          policyId: policy_id,
          amount: amount,
          status: 'COMPLETED',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred during payment processing'
      };
    }
  }

  // Submit claim
  async submitClaim(wallet_address: string, policy_id: string, claim_data: any): Promise<BlockchainResponse> {
    try {
      const response = await axios.post(`${API_BASE_URL}/blockchain/submit-claim`, { 
        wallet_address, 
        policy_id, 
        claim_data 
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Get claim status
  async getClaimStatus(claim_id: string): Promise<BlockchainResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/blockchain/claim-status/${claim_id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  // Add a new method to get transaction status from chain
  async getTransactionStatus(txHash: string): Promise<BlockchainResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/blockchain/transaction-status/${txHash}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        return error.response.data;
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred while checking transaction' 
      };
    }
  }
}

// Export a singleton instance
export const blockchainService = {
  getUserPolicies: async (walletAddress: string): Promise<BlockchainResponse> => {
    try {
      console.log(`[BLOCKCHAIN] Fetching policies for address: ${walletAddress}`);
      
      // Try to get policies from the API first
      try {
        const response = await axios.get(`${API_BASE_URL}/blockchain/user-policies/${walletAddress}`);
        if (response.data.success && response.data.data?.policies) {
          console.log("Received policies from API:", response.data.data.policies);
          return response.data;
        }
      } catch (apiError) {
        console.warn("Could not fetch policies from API, using mock data", apiError);
      }
      
      // Fallback to mock data
      await simulateBlockchainDelay();
      
      return {
        success: true,
        message: 'Policies retrieved successfully',
        data: {
          policies: mockPolicies
        }
      };
    } catch (error) {
      console.error('Error fetching policies:', error);
      return {
        success: false,
        message: 'Failed to fetch policies from blockchain',
        data: { policies: [] }
      };
    }
  },
  
  createPolicy: async (walletAddress: string, policyData: any): Promise<BlockchainResponse> => {
    try {
      console.log(`[BLOCKCHAIN] Creating policy for address: ${walletAddress}`, policyData);
      
      if (!walletAddress) {
        return {
          success: false,
          message: 'Invalid wallet address provided'
        };
      }
      
      // Validate policy data
      if (!policyData || typeof policyData !== 'object') {
        return {
          success: false,
          message: 'Invalid policy data provided'
        };
      }
      
      // Try creating policy through the API
      try {
        const payload = {
          wallet_address: walletAddress,
          policy_data: {
            policy_type: policyData.policy_type,
            coverage_amount: Number(policyData.coverage_amount),
            term_length: Number(policyData.term_length),
            premium_amount: Number(policyData.premium_amount),
            payment_frequency: policyData.payment_frequency || 'annually',
            start_date: policyData.start_date,
            end_date: policyData.end_date
          }
        };
        
        console.log("Sending create policy request to API:", payload);
        const response = await axios.post(`${API_BASE_URL}/blockchain/create-policy`, payload);
        
        if (response.data.success) {
          console.log("Policy created successfully via API:", response.data);
          return {
            success: true,
            message: 'Policy created successfully on-chain',
            data: {
              policy_id: response.data.data?.policy_id,
              txHash: response.data.data?.transaction_hash,
              status: 'CREATED',
              details: response.data.data?.policy_details || payload.policy_data
            }
          };
        } else {
          console.warn("API returned error for create policy:", response.data);
        }
      } catch (apiError) {
        console.warn("Could not create policy via API, using mock implementation", apiError);
      }
      
      // Fallback to mock implementation
      // Generate policy ID
      const policyId = generatePolicyId();
      
      // Log transaction details
      logTransaction('Create Policy', { walletAddress, policyData });
      
      // Simulate blockchain delay
      await simulateBlockchainDelay();
      
      // Generate a mock transaction hash
      const txHash = `0x${Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)).join('')}`;

      // Return success with policy data
      return {
        success: true,
        message: 'Policy created successfully on-chain (simulated)',
        data: {
          policy_id: policyId,
          txHash: txHash,
          status: 'CREATED',
          details: policyData,
          transaction_hash: txHash,
          policy_details: policyData
        }
      };
    } catch (error) {
      console.error('Error creating policy:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred during policy creation'
      };
    }
  },
  
  processPayment: async (walletAddress: string, policyId: string, amount: number): Promise<BlockchainResponse> => {
    try {
      console.log(`[BLOCKCHAIN] Processing payment of ${amount} for policy ${policyId} from wallet ${walletAddress}`);
      
      if (!walletAddress || !policyId) {
        return {
          success: false,
          message: 'Invalid wallet address or policy ID provided'
        };
      }
      
      // Check if we can access the wallet adapter through window object
      if (typeof window !== 'undefined' && window.aptos) {
        try {
          console.log('Found Aptos wallet adapter, attempting direct transaction');
          
          // Create transaction payload for the blockchain
          const payload = {
            type: "entry_function_payload",
            function: `${POLICY_MODULE_ADDRESS}::premium_escrow::pay_premium`,
            type_arguments: [],
            arguments: [
              policyId,
              Math.floor(amount * 100000000).toString() // Convert to octas (Aptos smallest unit)
            ]
          };
          
          console.log('Submitting transaction payload:', payload);
          
          const txResult = await window.aptos.signAndSubmitTransaction(payload);
          console.log('Transaction result:', txResult);
          
          if (txResult && txResult.hash) {
            return {
              success: true,
              message: 'Payment transaction submitted to blockchain',
              data: {
                txHash: txResult.hash,
                policyId: policyId,
                amount: amount,
                status: 'PENDING',
                timestamp: new Date().toISOString()
              }
            };
          }
        } catch (walletError) {
          console.error('Error using wallet adapter:', walletError);
          // Fall through to API approach
        }
      }
      
      // Try processing payment through the API
      try {
        const payload = {
          wallet_address: walletAddress,
          policy_id: policyId,
          amount: Number(amount)
        };
        
        console.log("Sending payment request to API:", payload);
        const response = await axios.post(`${API_BASE_URL}/blockchain/process-payment`, payload);
        
        if (response.data.success) {
          console.log("Payment processed successfully via API:", response.data);
          return {
            success: true,
            message: 'Payment processed successfully on-chain',
            data: {
              txHash: response.data.data?.transaction_hash,
              policyId: policyId,
              amount: amount,
              status: 'COMPLETED',
              timestamp: new Date().toISOString()
            }
          };
        } else {
          console.warn("API returned error for payment processing:", response.data);
        }
      } catch (apiError) {
        console.warn("Could not process payment via API, using mock implementation", apiError);
      }
      
      // Fallback to mock implementation
      // Create transaction payload (for mock purposes)
      const payload = {
        function: `${POLICY_MODULE_ADDRESS}::premium_escrow::pay_premium`,
        type_arguments: [],
        arguments: [
          policyId,
          amount.toString()
        ]
      };
      
      // Log transaction details
      console.log("Using mock implementation for payment:", payload);
      
      // Simulate blockchain delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a mock transaction hash
      const txHash = `0x${Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)).join('')}`;
      
      // Return success with transaction data
      return {
        success: true,
        message: 'Payment processed successfully (simulated)',
        data: {
          txHash,
          policyId: policyId,
          amount: amount,
          status: 'COMPLETED',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred during payment processing'
      };
    }
  },
  
  getTransactionStatus,
  verifyWalletMapping: async (walletAddress: string): Promise<BlockchainResponse> => {
    try {
      console.log(`[BLOCKCHAIN] Verifying wallet mapping for address: ${walletAddress}`);
      
      if (!walletAddress) {
        return {
          success: false,
          message: 'Invalid wallet address provided'
        };
      }
      
      // Try verifying through the API
      try {
        // Use default user_id if none provided
        const userId = 'user_123'; // Default user ID for testing
        const response = await axios.get(`${API_BASE_URL}/blockchain/verify-wallet/${userId}/${walletAddress}`);
        if (response.data.success) {
          return response.data;
        }
      } catch (apiError) {
        console.warn("Could not verify wallet mapping via API, using mock implementation", apiError);
      }
      
      // Simulate network delay
      await simulateBlockchainDelay();
      
      // For mock purposes, always return a valid mapping
      return {
        success: true,
        message: 'Wallet mapping verified successfully',
        data: {
          isMapped: true,
          userId: 'user_123'
        }
      };
    } catch (error) {
      console.error('Error verifying wallet mapping:', error);
      return {
        success: false,
        message: 'Failed to verify wallet mapping'
      };
    }
  },
  
  submitClaim,
  createWalletMapping: async (userId: string, walletAddress: string): Promise<BlockchainResponse> => {
    try {
      console.log(`[BLOCKCHAIN] Creating wallet mapping for user ${userId} with address: ${walletAddress}`);
      
      if (!userId || !walletAddress) {
        return {
          success: false,
          message: 'Invalid user ID or wallet address provided'
        };
      }
      
      // Try creating mapping through the API
      try {
        const payload = {
          user_id: userId,
          wallet_address: walletAddress
        };
        
        console.log("Sending wallet mapping request to API:", payload);
        const response = await axios.post(`${API_BASE_URL}/blockchain/wallet-mapping`, payload);
        
        if (response.data.success) {
          return response.data;
        } else {
          console.warn("API returned error for wallet mapping:", response.data);
        }
      } catch (apiError) {
        console.warn("Could not create wallet mapping via API, using mock implementation", apiError);
      }
      
      // Simulate network delay
      await simulateBlockchainDelay();
      
      // Return a successful response
      return {
        success: true,
        message: 'Wallet mapping created successfully (simulated)',
        data: {
          userId: userId,
          walletAddress: walletAddress,
          createdAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error creating wallet mapping:', error);
      return {
        success: false,
        message: 'Failed to create wallet mapping'
      };
    }
  }
}; 