import { AptosClient, TokenClient, FaucetClient, CoinClient, HexString, Types } from 'aptos';
import { Provider, Network } from 'aptos';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default network
const DEFAULT_NETWORK = Network.DEVNET;

// Configuration
const config = {
  nodeUrl: process.env.APTOS_NODE_URL || 'https://fullnode.devnet.aptoslabs.com/v1',
  faucetUrl: process.env.APTOS_FAUCET_URL || 'https://faucet.devnet.aptoslabs.com',
  privateKey: process.env.ADMIN_PRIVATE_KEY || '',
  contractAddress: process.env.CONTRACT_ADDRESS || '',
  policyRegistryModule: process.env.POLICY_REGISTRY_MODULE || 'policy_registry',
  claimsModule: process.env.CLAIMS_MODULE || 'claims',
  network: process.env.NETWORK || DEFAULT_NETWORK,
};

// Main class to handle blockchain operations
export class BlockchainManager {
  private client: AptosClient;
  private provider: Provider;
  private tokenClient: TokenClient;
  private coinClient: CoinClient;
  private faucetClient: FaucetClient | null;
  
  constructor(networkOverride?: Network) {
    const network = networkOverride || config.network as Network;
    
    this.client = new AptosClient(config.nodeUrl);
    this.provider = new Provider(network);
    this.tokenClient = new TokenClient(this.client);
    this.coinClient = new CoinClient(this.client);
    
    // Only initialize faucet client for test environments
    if (network === Network.DEVNET || network === Network.TESTNET) {
      this.faucetClient = new FaucetClient(config.nodeUrl, config.faucetUrl);
    } else {
      this.faucetClient = null;
    }

    console.log(`BlockchainManager initialized with network: ${network}`);
    console.log(`Connected to node: ${config.nodeUrl}`);
  }

  /**
   * Get the provider instance
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Get the Aptos client instance
   */
  getClient(): AptosClient {
    return this.client;
  }

  /**
   * Create a payload for registering a user
   */
  createRegisterUserPayload(userId: string, name: string, email: string, walletAddress: string): Types.TransactionPayload {
    return {
      type: "entry_function_payload",
      function: `${config.contractAddress}::${config.policyRegistryModule}::register_user`,
      type_arguments: [],
      arguments: [userId, name, email, walletAddress]
    };
  }

  /**
   * Create a payload for creating a policy
   */
  createPolicyPayload(
    policyId: string, 
    userId: string, 
    policyType: string,
    coverageAmount: number,
    premiumAmount: number,
    startDate: string,
    endDate: string
  ): Types.TransactionPayload {
    return {
      type: "entry_function_payload",
      function: `${config.contractAddress}::${config.policyRegistryModule}::create_policy`,
      type_arguments: [],
      arguments: [
        policyId, 
        userId, 
        policyType, 
        coverageAmount.toString(), 
        premiumAmount.toString(), 
        startDate, 
        endDate
      ]
    };
  }

  /**
   * Create a payload for making a premium payment
   */
  createPremiumPaymentPayload(
    policyId: string,
    amount: number,
    paymentDate: string
  ): Types.TransactionPayload {
    return {
      type: "entry_function_payload",
      function: `${config.contractAddress}::${config.policyRegistryModule}::record_payment`,
      type_arguments: [],
      arguments: [policyId, amount.toString(), paymentDate]
    };
  }

  /**
   * Create a payload for submitting a claim
   */
  createSubmitClaimPayload(
    claimId: string,
    policyId: string,
    amount: number,
    reason: string,
    submissionDate: string
  ): Types.TransactionPayload {
    return {
      type: "entry_function_payload",
      function: `${config.contractAddress}::${config.claimsModule}::submit_claim`,
      type_arguments: [],
      arguments: [claimId, policyId, amount.toString(), reason, submissionDate]
    };
  }

  /**
   * Get user profile from the blockchain
   */
  async getUserProfile(walletAddress: string): Promise<any> {
    try {
      const resource = await this.client.getAccountResource(
        walletAddress,
        `${config.contractAddress}::${config.policyRegistryModule}::UserProfile`
      );
      
      return resource.data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }

  /**
   * Get policies for a user
   */
  async getUserPolicies(walletAddress: string): Promise<any[]> {
    try {
      const resource = await this.client.getAccountResource(
        walletAddress,
        `${config.contractAddress}::${config.policyRegistryModule}::UserPolicies`
      );
      
      return (resource.data as any).policies || [];
    } catch (error) {
      console.error("Error fetching user policies:", error);
      return [];
    }
  }

  /**
   * Get details of a specific policy
   */
  async getPolicyDetails(policyId: string): Promise<any> {
    try {
      // In a real implementation, we would query the blockchain for the specific policy
      // For now, we'll simulate by fetching all policies and filtering
      const tableHandle = await this.getTableHandle(`${config.contractAddress}::${config.policyRegistryModule}::PolicyRegistry`);
      
      if (!tableHandle) {
        throw new Error("Policy registry table not found");
      }
      
      const policy = await this.client.getTableItem(tableHandle, {
        key_type: "string",
        value_type: `${config.contractAddress}::${config.policyRegistryModule}::Policy`,
        key: policyId
      });
      
      return policy;
    } catch (error) {
      console.error(`Error fetching policy details for ${policyId}:`, error);
      return null;
    }
  }

  /**
   * Get claim status from the blockchain
   */
  async getClaimStatus(claimId: string): Promise<any> {
    try {
      // In a real implementation, we would query the blockchain for the specific claim
      // For now, we'll simulate by fetching all claims and filtering
      const tableHandle = await this.getTableHandle(`${config.contractAddress}::${config.claimsModule}::ClaimsRegistry`);
      
      if (!tableHandle) {
        throw new Error("Claims registry table not found");
      }
      
      const claim = await this.client.getTableItem(tableHandle, {
        key_type: "string",
        value_type: `${config.contractAddress}::${config.claimsModule}::Claim`,
        key: claimId
      });
      
      return claim;
    } catch (error) {
      console.error(`Error fetching claim status for ${claimId}:`, error);
      return null;
    }
  }

  /**
   * Helper method to get a table handle by name
   */
  private async getTableHandle(tableName: string): Promise<string | null> {
    try {
      const accountResources = await this.client.getAccountResources(config.contractAddress);
      
      for (const resource of accountResources) {
        if (resource.type.includes("0x1::table::Table") && resource.type.includes(tableName)) {
          return (resource.data as any).handle;
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching table handle:", error);
      return null;
    }
  }

  /**
   * Fund an account with test tokens (only for development)
   */
  async fundAccount(address: string, amount: number = 100_000_000): Promise<void> {
    if (!this.faucetClient) {
      throw new Error("Faucet client not available for this network");
    }
    
    await this.faucetClient.fundAccount(address, amount);
    console.log(`Funded account ${address} with ${amount} test tokens`);
  }

  /**
   * Get account balance
   */
  async getBalance(address: string): Promise<bigint> {
    return await this.coinClient.checkBalance(address);
  }
}

// Create and export a default instance
const blockchainManager = new BlockchainManager();
export default blockchainManager; 