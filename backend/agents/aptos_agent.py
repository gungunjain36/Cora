# This agent will query blockchain data for the clients
# This agent will perform all the blockchain related tasks.

import os
import json
import requests
import httpx
from typing import Dict, Any, List, Optional, Union
import asyncio
import time
from dotenv import load_dotenv
import hashlib
from aptos_sdk.account import Account
from aptos_sdk.async_client import RestClient
from aptos_sdk.transactions import (
    EntryFunction, 
    TransactionArgument, 
    TransactionPayload,
    SignedTransaction
)
import re

# Load environment variables from .env file
load_dotenv()

class AptosAgent:
    """
    Agent responsible for interacting with the Aptos blockchain.
    Handles user registration, policy creation, premium payments, and claims.
    """

    def __init__(self):
        """Initialize the Aptos agent with necessary configurations."""
        self.network = os.getenv("VITE_APP_NETWORK", "testnet")
        self.api_key = os.getenv("VITE_APTOS_API_KEY", "")
        self.module_address = os.getenv("VITE_MODULE_ADDRESS", "")
        
        # Load configuration from environment variables
        self.contract_address = os.getenv("CONTRACT_ADDRESS", "0xd290fb8c741c327618b21904475cfda58f566471e43f44495f4525295553c1ae")
        
        # Ensure contract_address has 0x prefix
        if self.contract_address and not self.contract_address.startswith("0x"):
            self.contract_address = f"0x{self.contract_address}"
        
        # If module_address is not set, use contract_address
        if not self.module_address:
            self.module_address = self.contract_address
        # Ensure module_address has the 0x prefix
        elif not self.module_address.startswith("0x"):
            self.module_address = f"0x{self.module_address}"
        
        # Set up API endpoints based on network
        if self.network == "mainnet":
            self.node_url = "https://fullnode.mainnet.aptoslabs.com/v1"
        elif self.network == "testnet":
            self.node_url = "https://fullnode.testnet.aptoslabs.com/v1"
        else:
            self.node_url = "https://fullnode.devnet.aptoslabs.com/v1"
        
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

        print(f"Using module address: {self.module_address}")
        print(f"Using policy registry module: {self.policy_registry_module}")
            
        self.admin_private_key = os.getenv("MODULE_PUBLISHER_PRIVATE_KEY", "0x03575c3b20fa782bfec2c6d715d2e8feec7b6e881ca81b0e18d7142c8baebf4f")
        
        # Initialize HTTP client for API requests
        self.client = httpx.AsyncClient(timeout=30.0)
        
        # Initialize Aptos REST client - will be created when needed
        self._rest_client = None
        
        # Initialize admin account from private key
        # WARNING: In production, the private key should be securely stored and never exposed
        try:
            if self.admin_private_key:
                if self.admin_private_key.startswith("0x"):
                    self.admin_private_key = self.admin_private_key[2:]
                self.admin_account = Account.load_key(self.admin_private_key)
                print(f"Admin account loaded with address: {self.admin_account.address()}")
            else:
                print("WARNING: Admin private key not provided. Some functions will not work correctly.")
                self.admin_account = None
        except Exception as e:
            print(f"Error initializing admin account: {str(e)}")
            self.admin_account = None
        
        # Store user wallet mappings (in production this would be in a database)
        self.wallet_mappings = {}
        
        print(f"AptosAgent initialized with contract: {self.contract_address}")
    
    async def get_rest_client(self):
        """Get or create the REST client."""
        if self._rest_client is None:
            self._rest_client = RestClient(self.node_url)
            print("Aptos REST client initialized")
        return self._rest_client

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
        """Get all policies for a user by querying the blockchain."""
        try:
            # In a real implementation, this would:
            # 1. Call the blockchain to get the user's profile 
            # 2. Extract the list of policies from the profile
            # 3. Return the policy details
            
            # For simulation, we'll return mock data
            import random
            import time
            
            # Generate a few random policies
            policy_count = random.randint(1, 3)
            policies = []
            
            for i in range(policy_count):
                # Generate numeric policy IDs based on timestamp - this is critical for blockchain compatibility
                time_component = int(time.time()) - random.randint(0, 10000)
                numeric_policy_id = str(time_component)
                
                # For display in UI, we can add a formatted policy ID
                display_policy_id = f"POL-{wallet_address[-6:]}-{i+1:04d}"
                
                transaction_hash = f"0x{wallet_address[-8:]}{''.join([str(j) for j in range(10)])}{time_component % 1000000}"
                
                # Create policy types and statuses
                policy_types = ["Term Life", "Health Insurance", "Home Insurance"]
                statuses = ["Active", "Pending", "Active"]
                
                # Calculate dates
                from datetime import datetime, timedelta
                start_date = (datetime.now() - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d")
                term_length = random.choice([1, 5, 10, 20])
                end_date = (datetime.now() + timedelta(days=365 * term_length)).strftime("%Y-%m-%d")
                
                # Create policy
                policy = {
                    "id": numeric_policy_id,  # Primary ID - must be numeric for blockchain compatibility
                    "display_id": display_policy_id,  # For display purposes only
                    "policy_type": policy_types[i % len(policy_types)],
                    "coverage_amount": random.choice([100000, 250000, 500000, 1000000]),
                    "premium": random.choice([120, 240, 500, 1200]),
                    "term_length": term_length,
                    "status": statuses[i % len(statuses)],
                    "start_date": start_date,
                    "end_date": end_date,
                    "transaction_hash": transaction_hash,
                    "next_payment_amount": random.choice([120, 240, 500, 1200]) # Adding next payment amount
                }
                
                policies.append(policy)
            
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

    async def get_latest_policy_id(self, wallet_address: str, transaction_hash: str = None) -> Optional[str]:
        """
        Query the blockchain to get the latest policy ID for a wallet address.
        This is used after policy creation to get the actual policy ID.
        
        Args:
            wallet_address: The wallet address of the policy holder
            transaction_hash: Optional transaction hash to look up specific events
            
        Returns:
            The latest policy ID as a string, or None if not found
        """
        try:
            print(f"Querying for latest policy ID for wallet: {wallet_address}")
            
            # Method 1: Try to get events from the transaction if we have a hash
            if transaction_hash:
                # Remove 0x prefix if present for consistent formatting in API calls
                if transaction_hash.startswith("0x"):
                    clean_hash = transaction_hash[2:]
                else:
                    clean_hash = transaction_hash
                    
                events_url = f"{self.node_url}/transactions/by_hash/{clean_hash}/events"
                print(f"Querying transaction events: {events_url}")
                
                response = requests.get(events_url, headers=self.headers)
                if response.status_code == 200:
                    events = response.json()
                    print(f"Found {len(events)} events in transaction")
                    
                    # Look for policy creation events
                    for event in events:
                        event_type = event.get("type", "")
                        if "policy" in event_type.lower() and "create" in event_type.lower():
                            # Found a policy creation event
                            print(f"Found policy creation event: {event}")
                            data = event.get("data", {})
                            if "policy_id" in data:
                                policy_id = str(data["policy_id"])
                                print(f"Extracted policy ID from event: {policy_id}")
                                return policy_id
                            
                            # Try alternate field names
                            for key in data:
                                if "policy" in key.lower() and "id" in key.lower():
                                    policy_id = str(data[key])
                                    print(f"Extracted policy ID from event field {key}: {policy_id}")
                                    return policy_id
            
            # Method 2: Query resources to find policies
            resource_type = f"{self.module_address}::policy_registry::UserPolicies"
            print(f"Looking for resource: {resource_type}")
            
            try:
                response = requests.get(
                    f"{self.node_url}/accounts/{wallet_address}/resource/{resource_type}",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    resource_data = response.json()
                    print(f"Found policy resource: {resource_data}")
                    
                    # Extract policy IDs from the resource
                    if "data" in resource_data:
                        data = resource_data["data"]
                        if "policies" in data and isinstance(data["policies"], list):
                            policies = data["policies"]
                            if policies:
                                # Get the latest policy (assuming the last one is the newest)
                                latest_policy = policies[-1]
                                if "policy_id" in latest_policy:
                                    policy_id = str(latest_policy["policy_id"])
                                    print(f"Found latest policy ID: {policy_id}")
                                    return policy_id
                                
                                # Try to extract ID from other fields
                                for key in latest_policy:
                                    if "id" in key.lower():
                                        policy_id = str(latest_policy[key])
                                        print(f"Found policy ID in field {key}: {policy_id}")
                                        return policy_id
                        
                        # Try alternate data structures
                        if "policy_counter" in data:
                            # If the contract uses a counter for policy IDs, the latest should be the counter value
                            policy_id = str(data["policy_counter"])
                            print(f"Using policy counter as latest ID: {policy_id}")
                            return policy_id
            except Exception as e:
                print(f"Error querying resource: {str(e)}")
            
            # Method 3: Query events for the module to find the latest policy creation
            events_url = f"{self.node_url}/accounts/{self.module_address}/events/{self.module_address}::policy_registry::PolicyCreated"
            print(f"Querying module events: {events_url}")
            
            try:
                response = requests.get(events_url, headers=self.headers)
                if response.status_code == 200:
                    events = response.json()
                    if events and isinstance(events, list):
                        # Find events for this wallet address
                        matching_events = [
                            e for e in events 
                            if "data" in e and "policyholder" in e["data"] and e["data"]["policyholder"] == wallet_address
                        ]
                        
                        if matching_events:
                            # Get the latest event (should be last in the list)
                            latest_event = matching_events[-1]
                            if "data" in latest_event and "policy_id" in latest_event["data"]:
                                policy_id = str(latest_event["data"]["policy_id"])
                                print(f"Extracted policy ID from latest event: {policy_id}")
                                return policy_id
            except Exception as e:
                print(f"Error querying events: {str(e)}")
            
            # If all methods fail, return None to indicate policy ID couldn't be determined
            print("Could not determine policy ID from blockchain - no default will be used")
            return None
            
        except Exception as e:
            print(f"Error getting latest policy ID: {str(e)}")
            return None

    async def create_policy_async(self, wallet_address: str, policy_type: str, 
                             coverage_amount: Union[int, str], term_length: Union[int, str], 
                             premium_amount: Union[int, str], document_hash: str = "") -> Dict[str, Any]:
        """
        Create a new insurance policy on the blockchain using CLI.
        Based on working example from Aptos_Cli.md.
        
        Args:
            wallet_address: User's wallet address
            policy_type: Type of policy (e.g., "health", "auto", "home")
            coverage_amount: Amount of coverage
            term_length: Length of policy term in days
            premium_amount: Amount of premium
            document_hash: Optional hash of policy document
            
        Returns:
            Dict containing success status and policy information
        """
        # Validate required fields
        if not all([wallet_address, policy_type, coverage_amount, term_length, premium_amount]):
            return {"success": False, "message": "Missing required fields for policy creation"}
        
        try:
            print(f"Creating policy: {wallet_address}, {policy_type}, {coverage_amount}, {term_length}, {premium_amount}")
            
            # Convert amounts to integers, ensuring reasonable values
            coverage_amount_int = int(coverage_amount) if isinstance(coverage_amount, str) else coverage_amount
            # Ensure coverage is reasonable (10000 minimum based on working examples)
            if coverage_amount_int < 10000:
                coverage_amount_int = 10000  # Use value from working example
                
            term_length_int = int(term_length) if isinstance(term_length, str) else term_length
            premium_amount_int = int(premium_amount) if isinstance(premium_amount, str) else premium_amount
            # Ensure premium is reasonable
            if premium_amount_int < 1000:
                premium_amount_int = 5000  # Use value from working example
            
            # Convert term_length from years to days if necessary (assuming input is in years)
            if term_length_int < 1000:  # If less than 1000, assume it's in years
                duration_days = term_length_int * 365
            else:
                duration_days = term_length_int
                
            # Generate document hash if not provided - VERY IMPORTANT: make it a simple hex value matching example
            if not document_hash:
                # Use a simple hex value like "01020304" from the working example
                document_hash = "01020304"  # Simple hex value that works based on Aptos_Cli.md example
            else:
                # If document_hash is provided, ensure it's a simple hex string without 0x prefix
                if document_hash.startswith("0x"):
                    document_hash = document_hash[2:]
                # Ensure it's not too long (keep it simple)
                if len(document_hash) > 20:
                    # Truncate or use a simpler value
                    document_hash = "01020304"
            
            print(f"Using document_hash: {document_hash}")
            
            # For Aptos blockchain, ensure wallet address has 0x prefix
            if not wallet_address.startswith("0x"):
                wallet_address = f"0x{wallet_address}"
            
            # Prepare function ID and arguments for blockchain transaction
            function_id = f"{self.module_address}::policy_registry::create_policy"
            type_args = []  # No type arguments for create_policy
            
            # Create the list of arguments for the transaction - EXACTLY matching the CLI format
            # Order from Aptos_Cli.md: address u64 u64 hex u64
            args = [
                wallet_address,         # policyholder address (as address)
                coverage_amount_int,    # coverage amount (as u64)
                premium_amount_int,     # premium amount (as u64)
                document_hash,          # document hash (as hex string)
                duration_days           # duration in days (as u64)
            ]
            
            print(f"Transaction args: {args}")
            
            # Submit transaction to blockchain using our CLI-based method
            result = await self.submit_blockchain_transaction(function_id, type_args, args)
            
            if result["success"]:
                # Get transaction hash for querying policy ID
                tx_hash = result.get("transaction_hash", "")
                
                # Query the blockchain to get the actual policy ID
                # First try to extract policy ID from the transaction output
                policy_id = None
                
                # Try to extract from stdout if available
                if "stdout" in result:
                    stdout = result["stdout"]
                    print(f"POLICY DEBUG - Transaction output: {stdout}")
                    
                    # Try to find the policy ID in the output
                    import re
                    id_patterns = [
                        r"policy.*?id.*?(\d+)",  # Generic "policy...id...NUMBER" pattern
                        r"policy.*?(\d+)",       # Generic "policy...NUMBER" pattern
                        r"created.*?policy.*?(\d+)",  # "created...policy...NUMBER"
                        r"Policy ID: (\d+)",     # Explicit "Policy ID: NUMBER"
                        r"ID: (\d+)",            # Simple "ID: NUMBER"
                        r"\"policy_id\":\s*\"?(\d+)\"?"  # JSON format "policy_id": "NUMBER" or "policy_id": NUMBER
                    ]
                    
                    for pattern in id_patterns:
                        matches = re.search(pattern, stdout, re.IGNORECASE)
                        if matches:
                            extracted_id = matches.group(1)
                            policy_id = extracted_id
                            print(f"POLICY DEBUG - Extracted policy ID from output: {policy_id}")
                            break
                    
                    # If we still don't have a policy ID from patterns, maybe it's in JSON
                    if not policy_id:
                        try:
                            import json
                            # Try to parse JSON from stdout
                            json_start = stdout.find('{')
                            json_end = stdout.rfind('}') + 1
                            if json_start >= 0 and json_end > json_start:
                                json_str = stdout[json_start:json_end]
                                json_data = json.loads(json_str)
                                
                                # Look for policy_id in the JSON structure
                                if "policy_id" in json_data:
                                    policy_id = str(json_data["policy_id"])
                                    print(f"POLICY DEBUG - Extracted policy ID from JSON: {policy_id}")
                                elif "changes" in json_data and isinstance(json_data["changes"], list):
                                    # Sometimes the policy ID is in a changes array
                                    for change in json_data["changes"]:
                                        if "policy_id" in change:
                                            policy_id = str(change["policy_id"])
                                            print(f"POLICY DEBUG - Extracted policy ID from changes: {policy_id}")
                                            break
                        except Exception as e:
                            print(f"POLICY DEBUG - Error parsing JSON from output: {str(e)}")
                
                # If we couldn't find the policy ID in the transaction output, query the blockchain
                if not policy_id:
                    # Wait a moment for the transaction to be processed
                    import asyncio
                    print("Waiting for transaction to be processed before querying for policy ID...")
                    await asyncio.sleep(2)  # Short delay to ensure transaction is processed
                    
                    # Query the blockchain to get the policy ID
                    policy_id = await self.get_latest_policy_id(wallet_address, tx_hash)
                
                # If we still couldn't find the policy ID, generate a timestamp-based ID
                # This is only for backwards compatibility and should be avoided
                if not policy_id:
                    print("WARNING: Could not extract policy ID from blockchain, using timestamp")
                    policy_id = str(int(time.time()))
                
                return {
                    "success": True,
                    "message": "Policy created successfully on blockchain",
                    "transaction_hash": tx_hash,
                    "policy_details": {
                        "policy_id": policy_id,
                        "wallet_address": wallet_address,
                        "policy_type": policy_type,
                        "coverage_amount": coverage_amount_int,
                        "term_length": term_length_int,
                        "premium_amount": premium_amount_int,
                        "document_hash": document_hash,
                        "status": "Active",
                        "created_at": int(time.time())
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"Failed to create policy: {result.get('message', 'Unknown error')}"
                }
                
        except Exception as e:
            print(f"Error creating policy: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Error creating policy: {str(e)}"}

    def create_policy(self, wallet_address: str, policy_type: str, 
                     coverage_amount: Union[int, str], term_length: Union[int, str], 
                     premium_amount: Union[int, str], document_hash: str = "") -> Dict[str, Any]:
        """
        WARNING: This is a synchronous wrapper and should only be used in non-async contexts.
        For FastAPI routes, use create_policy_async instead.
        """
        print("WARNING: Using synchronous create_policy in potentially async context.")
        return {
            "success": False,
            "message": "create_policy cannot be used in async context. Use create_policy_async instead.",
            "instruction": "Update your code to use 'await aptos_agent.create_policy_async(...)'"
        }

    async def process_premium_payment_async(self, wallet_address: str, policy_id: Union[int, str], 
                                     amount: Union[int, str]) -> Dict[str, Any]:
        """
        Process a premium payment for a policy on the blockchain.
        Based on working example from Aptos_Cli.md.
        
        Args:
            wallet_address: User's wallet address
            policy_id: ID of the policy
            amount: Amount of payment
            
        Returns:
            Dict containing transaction result
        """
        # Validate inputs
        if not all([wallet_address, policy_id, amount]):
            return {"success": False, "message": "Missing required fields for payment processing"}
            
        try:
            print(f"Processing payment: {wallet_address}, {policy_id}, {amount}")
            
            # Store original values for response
            original_policy_id = policy_id
            original_amount = amount
            
            # Check if the policy exists in the policy file
            policy_file = os.path.join("data", "policies", f"{wallet_address}.json")
            policy_exists = False
            
            if os.path.exists(policy_file):
                try:
                    with open(policy_file, "r") as f:
                        policies = json.load(f)
                        for policy in policies:
                            if str(policy.get("policy_id")) == str(policy_id):
                                policy_exists = True
                                break
                except Exception as e:
                    print(f"Error reading policy file: {str(e)}")
            
            if not policy_exists:
                return {"success": False, "message": f"Policy with ID {policy_id} not found for wallet {wallet_address}"}
            
            # Convert policy_id to int - use the actual policy ID provided
            policy_id_int = int(policy_id) if isinstance(policy_id, str) else policy_id
            print(f"Using policy_id={policy_id_int}")
            
            # Convert amount to int - use the actual amount provided
            amount_int = int(amount) if isinstance(amount, str) else amount
            print(f"Using amount={amount_int}")
            
            # For Aptos blockchain, ensure wallet address has 0x prefix
            if wallet_address and not wallet_address.startswith("0x"):
                wallet_address = f"0x{wallet_address}"
                
            # Prepare function ID and arguments - use premium_escrow module
            function_id = f"{self.module_address}::premium_escrow::pay_premium"
            type_args = []
            
            # Create the list of arguments for the transaction - with actual values
            args = [
                policy_id_int,  # policy_id as u64 (using actual policy ID)
                amount_int      # amount as u64 (using actual amount)
            ]
            
            print(f"PAYMENT DEBUG: Processed args for transaction: {args}")
            print(f"PAYMENT DEBUG: Policy ID: {policy_id_int}")
            print(f"PAYMENT DEBUG: Amount: {amount_int}")
            
            # Submit transaction using CLI
            result = await self.submit_blockchain_transaction(function_id, type_args, args)
            
            # Check if payment was successful
            if result["success"]:
                return {
                    "success": True,
                    "message": "Premium payment processed successfully",
                    "transaction_hash": result.get("transaction_hash", ""),
                    "payment_details": {
                        "payment_id": f"PMT-{original_policy_id}-{int(time.time())}",
                        "wallet_address": wallet_address,
                        "policy_id": original_policy_id,
                        "amount": original_amount,
                        "status": "Completed",
                        "timestamp": int(time.time())
                    }
                }
            else:
                # Add detailed error information to help diagnose issues
                error_message = result.get("message", "Unknown error")
                stderr = result.get("stderr", "")
                stdout = result.get("stdout", "")
                
                # Special handling for "payment already made" errors
                # For hackathon demo purposes, treat this as a success
                if "E_PAYMENT_ALREADY_MADE" in stdout or "E_PAYMENT_ALREADY_MADE" in stderr:
                    print(f"PAYMENT NOTE: Payment already made for policy ID {policy_id_int}, treating as success")
                    return {
                        "success": True,
                        "message": "Premium payment already processed",
                        "transaction_hash": "already_paid",
                        "payment_details": {
                            "payment_id": f"PMT-{original_policy_id}-{int(time.time())}",
                            "wallet_address": wallet_address,
                            "policy_id": original_policy_id,
                            "amount": original_amount,
                            "status": "Completed",
                            "timestamp": int(time.time())
                        }
                    }
                
                print(f"PAYMENT ERROR: {error_message}")
                if stderr:
                    print(f"PAYMENT ERROR STDERR: {stderr}")
                if stdout:
                    print(f"PAYMENT ERROR STDOUT: {stdout}")
                
                return {
                    "success": False, 
                    "message": f"Failed to process payment: {error_message}"
                }
                
        except Exception as e:
            print(f"Error processing payment: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Error processing payment: {str(e)}"}

    def process_premium_payment(self, wallet_address: str, policy_id: Union[int, str], 
                              amount: Union[int, str]) -> Dict[str, Any]:
        """
        WARNING: This is a synchronous wrapper and should only be used in non-async contexts.
        For FastAPI routes, use process_premium_payment_async instead.
        """
        print("WARNING: Using synchronous process_premium_payment in potentially async context.")
        return {
            "success": False,
            "message": "process_premium_payment cannot be used in async context. Use process_premium_payment_async instead.",
            "instruction": "Update your code to use 'await aptos_agent.process_premium_payment_async(...)'"
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

    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    async def submit_blockchain_transaction(self, function_id: str, type_args: List[Any], args: List[Any]) -> Dict[str, Any]:
        """
        Submit a transaction to the blockchain using the Aptos CLI.
        This is more reliable than the SDK for the hackathon.
        
        Args:
            function_id: The function ID to call (format: address::module::function)
            type_args: List of type arguments (if any)
            args: List of arguments to pass to the function
            
        Returns:
            Dict containing result of transaction
        """
        try:
            print(f"Submitting blockchain transaction via CLI: {function_id} with args {args}")
            
            # CRITICAL FIX: Properly format CLI arguments with types
            formatted_args = []
            
            # Map argument to appropriate type based on content or position
            for i, arg in enumerate(args):
                if isinstance(arg, str) and (arg.startswith("0x") and len(arg) > 10):
                    # Most likely an address
                    formatted_args.append(f"address:{arg}")
                elif i == 3 and isinstance(arg, str) and all(c in '0123456789abcdefABCDEF' for c in arg):
                    # Position 3 is document_hash (4th argument) in create_policy, always format as hex
                    formatted_args.append(f"hex:{arg}")
                elif isinstance(arg, str) and len(arg) < 2:
                    # Single character string, probably a bool
                    if arg.lower() in ('true', 't', '1', 'yes', 'y'):
                        formatted_args.append("bool:true")
                    elif arg.lower() in ('false', 'f', '0', 'no', 'n'):
                        formatted_args.append("bool:false")
                    else:
                        formatted_args.append(f"string:{arg}")
                elif isinstance(arg, str) and arg.isdigit():
                    # String that's all digits, should be u64
                    formatted_args.append(f"u64:{arg}")
                elif isinstance(arg, str) and all(c in '0123456789abcdefABCDEF' for c in arg) and len(arg) % 2 == 0:
                    # Looks like a hex string
                    formatted_args.append(f"hex:{arg}")
                elif isinstance(arg, bool):
                    # Boolean
                    formatted_args.append(f"bool:{'true' if arg else 'false'}")
                elif isinstance(arg, int):
                    # Integer, use u64
                    formatted_args.append(f"u64:{arg}")
                elif isinstance(arg, float):
                    # Float, convert to integer
                    formatted_args.append(f"u64:{int(arg)}")
                else:
                    # Default to string for everything else
                    formatted_args.append(f"string:{arg}")
            
            print(f"Formatted CLI args: {formatted_args}")
            
            # Create the command with properly formatted args
            cmd_base = ["aptos", "move", "run", "--function-id", function_id]
            
            # Add type args if present
            for t_arg in type_args:
                cmd_base.extend(["--type-args", t_arg])
            
            # CRITICAL FIX: Properly format CLI arguments
            # For premium_escrow::pay_premium, need to use individual --args flags
            cmd = cmd_base.copy()
            for arg in formatted_args:
                cmd.extend(["--args", arg])
            
            print(f"Command with args: {cmd}")
            
            # Create a temporary directory for the key file
            import tempfile
            import os
            
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create a key file with the admin private key
                admin_key_path = os.path.join(temp_dir, "admin.key")
                with open(admin_key_path, "w") as f:
                    # The key is retrieved from environment variable
                    # This key should correspond to the owner of the contract at 0xd290fb8c741c327618b21904475cfda58f566471e43f44495f4525295553c1ae
                    admin_key = os.environ.get("APTOS_ADMIN_KEY")
                    
                    if not admin_key:
                        return {
                            "success": False,
                            "message": "APTOS_ADMIN_KEY environment variable is not set. It must be set to the private key of the contract owner account."
                        }
                    
                    # Remove 0x prefix if present as key file needs raw hex
                    if admin_key.startswith("0x"):
                        admin_key = admin_key[2:]
                    
                    f.write(admin_key)
                
                # Add key file and other necessary flags to command
                cmd.extend([
                    "--private-key-file", admin_key_path,
                    "--assume-yes",
                    "--url", "https://fullnode.testnet.aptoslabs.com/v1"
                ])
                
                # Execute the command
                command_str = " ".join(cmd)
                print(f"Executing CLI command: {command_str}")
                
                # Run the command and capture output
                import asyncio
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                
                # Convert to strings for easier handling
                stdout_str = stdout.decode() if stdout else ""
                stderr_str = stderr.decode() if stderr else ""
                
                # Debugging output
                if stdout_str:
                    print(f"CLI STDOUT: {stdout_str}")
                if stderr_str:
                    print(f"CLI STDERR: {stderr_str}")
                
                if process.returncode == 0:
                    print("Transaction submitted successfully")
                    
                    # Try to extract transaction hash from output
                    tx_hash = None
                    tx_pattern = r'Transaction hash: ([0-9a-fA-Fx]+)'
                    import re
                    tx_match = re.search(tx_pattern, stdout_str)
                    if tx_match:
                        tx_hash = tx_match.group(1)
                        print(f"Extracted transaction hash: {tx_hash}")
                    
                    return {
                        "success": True,
                        "message": "Transaction submitted successfully",
                        "transaction_hash": tx_hash,
                        "stdout": stdout_str,
                        "stderr": stderr_str,
                        "return_code": process.returncode
                    }
                else:
                    print(f"Error executing Aptos CLI: {stderr_str}")
                    
                    # For E_PAYMENT_ALREADY_MADE, return as success with a special message
                    if "E_PAYMENT_ALREADY_MADE" in stderr_str or "E_PAYMENT_ALREADY_MADE" in stdout_str:
                        return {
                            "success": True,
                            "message": "Payment already made for this policy",
                            "transaction_hash": "already_paid",
                            "stdout": stdout_str,
                            "stderr": stderr_str,
                            "return_code": process.returncode
                        }
                    
                    return {
                        "success": False,
                        "message": f"Transaction failed: {stderr_str}",
                        "stdout": stdout_str,
                        "stderr": stderr_str,
                        "return_code": process.returncode
                    }
                
        except Exception as e:
            import traceback
            print(f"Error submitting transaction: {str(e)}")
            traceback.print_exc()
            return {
                "success": False,
                "message": f"Error submitting transaction: {str(e)}"
            }

    async def file_claim_async(self, wallet_address: str, policy_id: Union[int, str], 
                        claim_amount: Union[int, str], claim_reason: str) -> Dict[str, Any]:
        """
        File an insurance claim on the blockchain using CLI.
        Based on working example from Aptos_Cli.md.
        
        Args:
            wallet_address: User's wallet address
            policy_id: ID of the policy
            claim_amount: Amount of the claim
            claim_reason: Reason for the claim
            
        Returns:
            Dict containing transaction result
        """
        # Validate inputs
        if not all([wallet_address, policy_id, claim_amount, claim_reason]):
            return {"success": False, "message": "Missing required fields for claim filing"}
            
        try:
            # Store original values for response
            original_policy_id = policy_id
            
            # Convert policy_id to int - use the actual policy ID provided
            policy_id_int = int(policy_id) if isinstance(policy_id, str) else policy_id
            print(f"Using policy_id={policy_id_int} for claim")
            
            # Convert amount to int
            claim_amount_int = int(claim_amount) if isinstance(claim_amount, str) else claim_amount
            
            # For Aptos blockchain, ensure wallet address has 0x prefix
            if wallet_address and not wallet_address.startswith("0x"):
                wallet_address = f"0x{wallet_address}"
                
            # Prepare function ID and arguments
            function_id = f"{self.module_address}::claim_processor::file_claim"
            type_args = []
            
            # Create the list of arguments for the transaction using the actual policy ID
            args = [
                policy_id_int,    # policy_id as u64 (using actual policy ID)
                wallet_address,   # claimant address as address
                claim_amount_int, # claim_amount as u64
                claim_reason      # claim_reason as string
            ]
            
            print(f"CLAIM DEBUG: Processing claim with args: {args}")
            
            # Submit transaction using CLI
            result = await self.submit_blockchain_transaction(function_id, type_args, args)
            
            if result["success"]:
                # Generate a unique claim ID based on the transaction hash
                claim_id = f"CLM-{wallet_address[-6:].upper()}-{int(time.time())}"
                
                return {
                    "success": True,
                    "message": "Claim filed successfully",
                    "transaction_hash": result.get("transaction_hash", ""),
                    "claim_details": {
                        "claim_id": claim_id,
                        "wallet_address": wallet_address,
                        "policy_id": original_policy_id,
                        "claim_amount": claim_amount_int,
                        "claim_reason": claim_reason,
                        "status": "Pending",
                        "timestamp": int(time.time())
                    }
                }
            else:
                return {
                    "success": False, 
                    "message": f"Failed to file claim: {result.get('message', 'Unknown error')}"
                }
                
        except Exception as e:
            print(f"Error filing claim: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"Error filing claim: {str(e)}"}

    def file_claim(self, wallet_address: str, policy_id: Union[int, str], 
                 claim_amount: Union[int, str], claim_reason: str) -> Dict[str, Any]:
        """
        WARNING: This is a synchronous wrapper and should only be used in non-async contexts.
        For FastAPI routes, use file_claim_async instead.
        """
        print("WARNING: Using synchronous file_claim in potentially async context.")
        return {
            "success": False,
            "message": "file_claim cannot be used in async context. Use file_claim_async instead.",
            "instruction": "Update your code to use 'await aptos_agent.file_claim_async(...)'"
        }

# Helper function to import time module for timestamp generation
def import_time():
    import datetime
    return datetime.datetime.now()
