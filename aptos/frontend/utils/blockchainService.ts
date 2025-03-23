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
const POLICY_MODULE_ADDRESS = import.meta.env.VITE_POLICY_MODULE_ADDRESS 
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
  message: string;
  data?: any;
}

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

  // Verify wallet mapping
  async verifyWallet(user_id: string, wallet_address: string): Promise<BlockchainResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/blockchain/verify-wallet/${user_id}/${wallet_address}`);
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
      const response = await axios.post(`${API_BASE_URL}/blockchain/create-policy`, { 
        wallet_address, 
        policy_data 
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
      const response = await axios.post(`${API_BASE_URL}/blockchain/process-payment`, { 
        wallet_address, 
        policy_id, 
        amount 
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
}

// Export a singleton instance
export const blockchainService = new BlockchainService(); 