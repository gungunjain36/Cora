# This agent will query blockchain data for the clients
# This agent will perform all the blockchain related tasks.

import os
import json
import requests
from typing import Dict, Any, List, Optional, Union
import asyncio
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class AptosAgent:
    """
    Agent responsible for interacting with the Aptos blockchain.
    Handles user registration, policy creation, premium payments, and claims.
    """

    def __init__(self):
        """Initialize the Aptos agent with necessary configurations."""
        self.node_url = os.getenv("APTOS_NODE_URL", "https://fullnode.testnet.aptoslabs.com/v1")
        self.api_key = os.getenv("APTOS_API_KEY", "")
        self.module_address = os.getenv("MODULE_ADDRESS", "")
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"
        
        # Set the contract modules
        self.cora_module = f"{self.module_address}::cora_insurance"
        self.policy_registry_module = f"{self.module_address}::policy_registry"
        self.premium_escrow_module = f"{self.module_address}::premium_escrow"
        self.claim_processor_module = f"{self.module_address}::claim_processor"

    def get_account_resources(self, account_address: str) -> List[Dict[str, Any]]:
        """Get all resources for an account."""
        try:
            response = requests.get(
                f"{self.node_url}/accounts/{account_address}/resources",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error getting account resources: {str(e)}")
            return []

    def get_account_resource(self, account_address: str, resource_type: str) -> Optional[Dict[str, Any]]:
        """Get a specific resource for an account."""
        try:
            response = requests.get(
                f"{self.node_url}/accounts/{account_address}/resource/{resource_type}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return None
            raise
        except Exception as e:
            print(f"Error getting account resource: {str(e)}")
            return None

    def get_user_profile(self, wallet_address: str) -> Optional[Dict[str, Any]]:
        """Get user profile from blockchain."""
        resource_type = f"{self.policy_registry_module}::UserProfile"
        return self.get_account_resource(wallet_address, resource_type)

    def get_user_policies(self, wallet_address: str) -> List[Dict[str, Any]]:
        """Get all policies for a user."""
        try:
            profile = self.get_user_profile(wallet_address)
            if not profile or "data" not in profile:
                return []
            
            policies = profile.get("data", {}).get("policies", [])
            return policies
        except Exception as e:
            print(f"Error getting user policies: {str(e)}")
            return []

    def get_policy_details(self, policy_id: str) -> Optional[Dict[str, Any]]:
        """Get details for a specific policy."""
        try:
            # This would be a view function call to the contract
            # For now, we'll return a placeholder
            return {
                "policy_id": policy_id,
                "policy_type": "Term Life",
                "coverage_amount": 2000000,
                "premium": 150,
                "term_length": 20,
                "status": "Active"
            }
        except Exception as e:
            print(f"Error getting policy details: {str(e)}")
            return None

    def register_user(self, wallet_address: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Register a user with the policy registry.
        This would typically involve a transaction, but we'll simulate for now.
        """
        try:
            # In production, this would involve constructing and submitting a transaction
            # For now, we'll return a successful response
            return {
                "success": True,
                "user_id": wallet_address,
                "message": "User registered successfully"
            }
        except Exception as e:
            print(f"Error registering user: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to register user: {str(e)}"
            }

    def create_policy(self, wallet_address: str, policy_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new insurance policy for a user.
        This would typically involve a transaction, but we'll simulate for now.
        """
        try:
            policy_id = f"POL-{wallet_address[-8:]}-{hash(json.dumps(policy_data)) % 10000}"
            return {
                "success": True,
                "policy_id": policy_id,
                "message": "Policy created successfully"
            }
        except Exception as e:
            print(f"Error creating policy: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to create policy: {str(e)}"
            }

    def process_premium_payment(self, wallet_address: str, policy_id: str, amount: float) -> Dict[str, Any]:
        """
        Process a premium payment for a policy.
        This would typically involve a transaction, but we'll simulate for now.
        """
        try:
            return {
                "success": True,
                "transaction_id": f"TXN-{hash(wallet_address + policy_id) % 1000000}",
                "message": "Premium payment processed successfully"
            }
        except Exception as e:
            print(f"Error processing payment: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to process payment: {str(e)}"
            }

    def submit_claim(self, wallet_address: str, policy_id: str, claim_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Submit an insurance claim for a policy.
        This would typically involve a transaction, but we'll simulate for now.
        """
        try:
            claim_id = f"CLM-{wallet_address[-6:]}-{hash(json.dumps(claim_data)) % 10000}"
            return {
                "success": True,
                "claim_id": claim_id,
                "status": "Pending",
                "message": "Claim submitted successfully"
            }
        except Exception as e:
            print(f"Error submitting claim: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to submit claim: {str(e)}"
            }

    def get_claim_status(self, claim_id: str) -> Dict[str, Any]:
        """
        Get the status of a claim.
        This would typically query the blockchain, but we'll simulate for now.
        """
        try:
            # Simulate different statuses
            import random
            statuses = ["Pending", "Under Review", "Approved", "Paid", "Rejected"]
            status = random.choice(statuses)
            
            return {
                "claim_id": claim_id,
                "status": status,
                "updated_at": "2024-03-22T12:00:00Z",
                "message": f"Claim is currently {status}"
            }
        except Exception as e:
            print(f"Error getting claim status: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to get claim status: {str(e)}"
            }

    async def verify_wallet_mapping(self, user_id: str, wallet_address: str) -> bool:
        """
        Verify that a wallet address is mapped to a user ID.
        This is used to ensure that users can only interact with their own policies.
        """
        try:
            # In a real implementation, this would check a database or blockchain mapping
            # For now, we'll use a simple file-based approach
            mapping_file = os.path.join("wallet_mappings", f"{user_id}.json")
            
            if os.path.exists(mapping_file):
                with open(mapping_file, "r") as f:
                    mapping = json.load(f)
                    return mapping.get("wallet_address") == wallet_address
            
            return False
        except Exception as e:
            print(f"Error verifying wallet mapping: {str(e)}")
            return False

    async def create_wallet_mapping(self, user_id: str, wallet_address: str) -> Dict[str, Any]:
        """
        Create a mapping between a user ID and a wallet address.
        """
        try:
            # Ensure directory exists
            os.makedirs("wallet_mappings", exist_ok=True)
            
            mapping_file = os.path.join("wallet_mappings", f"{user_id}.json")
            mapping = {
                "user_id": user_id,
                "wallet_address": wallet_address,
                "created_at": str(asyncio.get_event_loop().time())
            }
            
            with open(mapping_file, "w") as f:
                json.dump(mapping, f)
            
            return {
                "success": True,
                "message": "Wallet mapping created successfully"
            }
        except Exception as e:
            print(f"Error creating wallet mapping: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to create wallet mapping: {str(e)}"
            }
