from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel
import os
import json
import time

from agents.aptos_agent import AptosAgent

# Create router
router = APIRouter(
    prefix="/blockchain",
    tags=["blockchain"],
    responses={404: {"description": "Not found"}},
)

# Initialize the Aptos agent
try:
    aptos_agent = AptosAgent()
    print("Aptos agent initialized")
except Exception as e:
    print(f"Error initializing Aptos agent: {str(e)}")
    aptos_agent = None

# Models for request/response
class WalletMappingRequest(BaseModel):
    wallet_address: str
    user_id: str

class PolicyRequest(BaseModel):
    wallet_address: str
    policy_type: str
    coverage_amount: Union[int, str]
    term_length: Union[int, str]
    premium_amount: Union[int, str]
    document_hash: Optional[str] = ""

class PaymentRequest(BaseModel):
    wallet_address: str
    policy_id: Union[int, str]
    amount: Union[int, str]

class ClaimRequest(BaseModel):
    wallet_address: str
    policy_id: Union[int, str]
    claim_amount: Union[int, str]
    claim_reason: str

class ClaimStatusRequest(BaseModel):
    claim_id: str

# Routes
@router.post("/wallet-mapping")
async def create_wallet_mapping(request: WalletMappingRequest):
    """Map a user ID to a wallet address."""
    # Mock implementation for now
    return {
        "success": True,
        "message": "Wallet mapping created",
        "wallet_address": request.wallet_address,
        "user_id": request.user_id
    }

@router.get("/verify-wallet/{user_id}/{wallet_address}")
async def verify_wallet(user_id: str, wallet_address: str):
    """Verify if a wallet address belongs to a user."""
    # Mock implementation for now
    return {
        "success": True,
        "message": "Wallet verification completed",
        "verified": True,
        "user_id": user_id,
        "wallet_address": wallet_address
    }

@router.post("/register-user")
async def register_user(wallet_address: str = Body(..., embed=True)):
    """Register a new user with their wallet address."""
    # Mock implementation for now
    return {
        "success": True,
        "message": "User registered successfully",
        "wallet_address": wallet_address,
        "user_id": "usr_" + wallet_address[:8]
    }

@router.post("/create-policy")
async def create_policy(policy_request: PolicyRequest):
    """Create a new insurance policy on the blockchain."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    try:
        # Validate term length (convert from years to days if needed)
        term_length = policy_request.term_length
        if isinstance(term_length, str):
            try:
                term_length = float(term_length)
                term_length = int(term_length)
            except ValueError:
                # If it's not a valid number, try to extract numeric part
                import re
                numeric_match = re.search(r'\d+(\.\d+)?', str(term_length))
                if numeric_match:
                    term_length = int(float(numeric_match.group()))
                else:
                    raise HTTPException(status_code=422, detail="Invalid term length format")
        
        # Convert coverage amount
        coverage_amount = policy_request.coverage_amount
        if isinstance(coverage_amount, str):
            try:
                coverage_amount = float(coverage_amount)
                coverage_amount = int(coverage_amount)
            except ValueError:
                # Try to extract numeric part
                import re
                numeric_match = re.search(r'\d+(\.\d+)?', str(coverage_amount))
                if numeric_match:
                    coverage_amount = int(float(numeric_match.group()))
                else:
                    raise HTTPException(status_code=422, detail="Invalid coverage amount format")
        elif isinstance(coverage_amount, float):
            coverage_amount = int(coverage_amount)
            
        # Convert premium amount
        premium_amount = policy_request.premium_amount
        if isinstance(premium_amount, str):
            try:
                premium_amount = float(premium_amount)
                premium_amount = int(premium_amount * 100)  # Convert to cents/smallest unit
            except ValueError:
                # Try to extract numeric part
                import re
                numeric_match = re.search(r'\d+(\.\d+)?', str(premium_amount))
                if numeric_match:
                    premium_amount = int(float(numeric_match.group()) * 100)
                else:
                    raise HTTPException(status_code=422, detail="Invalid premium amount format")
        elif isinstance(premium_amount, float):
            premium_amount = int(premium_amount * 100)  # Convert to cents/smallest unit
            
        # Log the request
        print(f"Creating policy: {policy_request.wallet_address}, {policy_request.policy_type}, "
              f"{coverage_amount}, {term_length}, {premium_amount}")
    
        result = await aptos_agent.create_policy_async(
            wallet_address=policy_request.wallet_address,
            policy_type=policy_request.policy_type,
            coverage_amount=coverage_amount,
            term_length=term_length,
            premium_amount=premium_amount,
            document_hash=policy_request.document_hash
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        # Save the policy details to a file for later retrieval
        if "policy_details" in result:
            policy_details = result["policy_details"]
            
            # If we have a policy ID, log it prominently
            if "policy_id" in policy_details:
                print(f"POLICY CREATED with ID: {policy_details['policy_id']} for wallet {policy_request.wallet_address}")
            
            wallet_address = policy_request.wallet_address
            
            # Ensure data directory exists
            os.makedirs(os.path.join("data", "policies"), exist_ok=True)
            
            policy_file = os.path.join("data", "policies", f"{wallet_address}.json")
            
            # Add a few more fields for compatibility with frontend
            policy_details["premium"] = policy_details.get("premium_amount", premium_amount)
            policy_details["next_payment_due"] = int(time.time() + 30 * 24 * 3600)  # 30 days from now
            
            # Load existing policies if file exists
            policies = []
            if os.path.exists(policy_file):
                try:
                    with open(policy_file, "r") as f:
                        policies = json.load(f)
                        if not isinstance(policies, list):
                            policies = []
                except Exception as e:
                    print(f"Error loading existing policies: {str(e)}")
            
            # Add new policy
            policies.append(policy_details)
            
            # Save to file
            try:
                with open(policy_file, "w") as f:
                    json.dump(policies, f)
                print(f"Saved policy {policy_details['policy_id']} to file for {wallet_address}")
            except Exception as e:
                print(f"Error saving policy to file: {str(e)}")
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating policy: {str(e)}")

@router.get("/user-policies/{wallet_address}")
async def get_user_policies(wallet_address: str):
    """Get all policies for a user."""
    try:
        print(f"Fetching policies for wallet: {wallet_address}")
        
        # Query the blockchain for policies owned by this wallet address
        # This should be implemented to call a view function or query resources
        # on the blockchain to get the actual policies
        
        # For now, we'll return a combination of:
        # 1. Any known policies we've created through the API
        # 2. A standard policy with ID 1 for backward compatibility
        
        # In a real implementation, this would query the blockchain directly
        
        policies = []
        
        # Add standard policy ID 1 for backward compatibility if needed
        standard_policy = {
            "policy_id": "1",
            "policy_type": "Term Life",
            "coverage_amount": 10000,
            "premium_amount": 5000,
            "premium": 5000,
            "term_length": 365,
            "status": "Active",
            "transaction_hash": "0x1f5ab5e1c8d7d93700657b7510c59855fb7d87d4dee7ee1de4ecb351483ca048",
            "created_at": int(time.time() - 3600),  # 1 hour ago
            "next_payment_due": int(time.time() + 30 * 24 * 3600)  # 30 days from now
        }
        
        # If we have a policy creation record file, read it to get actual created policies
        policy_file = os.path.join("data", "policies", f"{wallet_address}.json")
        if os.path.exists(policy_file):
            try:
                with open(policy_file, "r") as f:
                    saved_policies = json.load(f)
                    if isinstance(saved_policies, list):
                        policies.extend(saved_policies)
                        print(f"Loaded {len(saved_policies)} policies from file for {wallet_address}")
                    else:
                        print(f"Invalid policy data format in {policy_file}")
            except Exception as e:
                print(f"Error loading policies from file: {str(e)}")
        
        # If we don't have any saved policies, include the standard one
        if not policies:
            policies.append(standard_policy)
            
        # Try to look for recent policy creations by checking the backend database or logs
        # This is a fallback mechanism for policies created during this session
        # In a real implementation, you would query the blockchain directly
        
        return {
            "success": True,
            "message": "User policies retrieved",
            "policies": policies
        }
    except Exception as e:
        print(f"Error fetching policies: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return a minimal response on error
        return {
            "success": False,
            "message": f"Error retrieving policies: {str(e)}",
            "policies": []
        }

@router.get("/policy-details/{policy_id}")
async def get_policy_details(policy_id: str):
    """Get details for a specific policy."""
    # Mock implementation for now
    return {
        "success": True,
        "message": "Policy details retrieved",
        "policy": {
            "policy_id": policy_id,
            "policy_type": "health",
            "coverage_amount": 100000,
            "premium_amount": 500,
            "term_length": 365,
            "status": "active",
            "created_at": "2023-04-01T10:00:00Z"
        }
    }

@router.post("/process-payment")
async def process_payment(payment_request: PaymentRequest):
    """Process a premium payment for a policy."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
        
    try:
        # Print request for debugging
        print(f"Payment request received: {payment_request}")
        
        # Convert amount to numeric if needed
        amount = payment_request.amount
        if isinstance(amount, str):
            # Try to convert string to float first, then to int
            try:
                amount = float(amount)
                # Convert to integer (assume values in smallest unit, like cents)
                amount = int(amount * 100)
            except ValueError:
                # If it's not a valid number, try to extract numeric part
                import re
                numeric_match = re.search(r'\d+(\.\d+)?', str(amount))
                if numeric_match:
                    amount = float(numeric_match.group())
                    amount = int(amount * 100)
                else:
                    # For demo purposes, use a default value that works
                    amount = 5000
                    print(f"WARNING: Invalid amount format, using default amount: {amount}")
            
        # Log the request
        print(f"Processing payment: {payment_request.wallet_address}, {payment_request.policy_id}, {amount}")
            
        result = await aptos_agent.process_premium_payment_async(
            wallet_address=payment_request.wallet_address,
            policy_id=payment_request.policy_id,
            amount=amount
        )
        
        # Return success response even if there was a "payment already made" message
        if result["success"]:
            print(f"PAYMENT SUCCEEDED: {result}")
            return result
        
        # Only reach here for real failures
        print(f"PAYMENT FAILED: {result}")
        
        # For demo purposes, we'll use a more controlled error response
        error_message = result.get("message", "Unknown error")
        
        # Handle different types of errors
        if "Transaction failed" in error_message:
            # For blockchain transaction failures, return 400
            raise HTTPException(status_code=400, detail=error_message)
        else:
            # For other errors, return 500
            raise HTTPException(status_code=500, detail=error_message)
            
    except HTTPException:
        # Re-raise HTTP exceptions as is
        raise
    except Exception as e:
        # For uncaught exceptions, log and return 500
        import traceback
        print(f"PAYMENT EXCEPTION: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing payment: {str(e)}")

@router.post("/file-claim")
async def file_claim(claim_request: ClaimRequest):
    """File an insurance claim on the blockchain."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
        
    try:
        # Convert claim amount to numeric
        claim_amount = claim_request.claim_amount
        if isinstance(claim_amount, str):
            # Try to convert string to float first, then to int
            try:
                claim_amount = float(claim_amount)
                # Convert to integer (assume values in smallest unit, like cents)
                claim_amount = int(claim_amount * 100)
            except ValueError:
                # If it's not a valid number, try to extract numeric part
                import re
                numeric_match = re.search(r'\d+(\.\d+)?', str(claim_amount))
                if numeric_match:
                    claim_amount = float(numeric_match.group())
                    claim_amount = int(claim_amount * 100)
                else:
                    raise HTTPException(status_code=422, detail="Invalid claim amount format")
        elif isinstance(claim_amount, float):
            # Convert float to integer (multiply by 100 to preserve cents)
            claim_amount = int(claim_amount * 100)
            
        # Log the request
        print(f"Filing claim: {claim_request.wallet_address}, {claim_request.policy_id}, "
              f"{claim_amount}, {claim_request.claim_reason}")
            
        result = await aptos_agent.file_claim_async(
            wallet_address=claim_request.wallet_address,
            policy_id=claim_request.policy_id,
            claim_amount=claim_amount,
            claim_reason=claim_request.claim_reason
        )
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error filing claim: {str(e)}")

@router.get("/claim-status/{claim_id}")
async def get_claim_status(claim_id: str):
    """Get the status of a claim."""
    # Mock implementation for now
    return {
        "success": True,
        "message": "Claim status retrieved",
        "claim": {
            "claim_id": claim_id,
            "status": "pending",
            "amount": 5000,
            "submission_date": "2023-04-15T14:30:00Z"
        }
    } 