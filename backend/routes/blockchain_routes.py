from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
import json

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
    user_id: str
    wallet_address: str

class PolicyRequest(BaseModel):
    wallet_address: str
    policy_data: Dict[str, Any]

class PaymentRequest(BaseModel):
    wallet_address: str
    policy_id: str
    amount: float

class ClaimRequest(BaseModel):
    wallet_address: str
    policy_id: str
    claim_data: Dict[str, Any]

class ClaimStatusRequest(BaseModel):
    claim_id: str

class BlockchainResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

# Routes
@router.post("/wallet-mapping", response_model=BlockchainResponse)
async def create_wallet_mapping(request: WalletMappingRequest):
    """Create a mapping between a user ID and a wallet address."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    result = await aptos_agent.create_wallet_mapping(request.user_id, request.wallet_address)
    
    if not result.get("success", False):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to create wallet mapping"))
    
    return BlockchainResponse(
        success=True,
        message="Wallet mapping created successfully",
        data={"user_id": request.user_id, "wallet_address": request.wallet_address}
    )

@router.get("/verify-wallet/{user_id}/{wallet_address}", response_model=BlockchainResponse)
async def verify_wallet(user_id: str, wallet_address: str):
    """Verify that a wallet address is mapped to a user ID."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    is_valid = await aptos_agent.verify_wallet_mapping(user_id, wallet_address)
    
    if not is_valid:
        return BlockchainResponse(
            success=False,
            message="Invalid wallet mapping",
            data={"is_valid": False}
        )
    
    return BlockchainResponse(
        success=True,
        message="Wallet mapping verified",
        data={"is_valid": True, "user_id": user_id, "wallet_address": wallet_address}
    )

@router.post("/register-user", response_model=BlockchainResponse)
async def register_user(request: WalletMappingRequest):
    """Register a user with the policy registry."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    # First create the wallet mapping
    mapping_result = await aptos_agent.create_wallet_mapping(request.user_id, request.wallet_address)
    
    if not mapping_result.get("success", False):
        raise HTTPException(status_code=400, detail=mapping_result.get("message", "Failed to create wallet mapping"))
    
    # Then register the user with blockchain
    user_data = {"user_id": request.user_id}
    result = aptos_agent.register_user(request.wallet_address, user_data)
    
    if not result.get("success", False):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to register user"))
    
    return BlockchainResponse(
        success=True,
        message="User registered successfully",
        data={"user_id": request.user_id, "wallet_address": request.wallet_address}
    )

@router.post("/create-policy", response_model=BlockchainResponse)
async def create_policy(request: PolicyRequest):
    """Create a new insurance policy for a user."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    result = aptos_agent.create_policy(request.wallet_address, request.policy_data)
    
    if not result.get("success", False):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to create policy"))
    
    return BlockchainResponse(
        success=True,
        message="Policy created successfully",
        data={"policy_id": result.get("policy_id"), "wallet_address": request.wallet_address}
    )

@router.get("/user-policies/{wallet_address}", response_model=BlockchainResponse)
async def get_user_policies(wallet_address: str):
    """Get all policies for a user."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    policies = aptos_agent.get_user_policies(wallet_address)
    
    return BlockchainResponse(
        success=True,
        message=f"Found {len(policies)} policies",
        data={"policies": policies, "wallet_address": wallet_address}
    )

@router.get("/policy-details/{policy_id}", response_model=BlockchainResponse)
async def get_policy_details(policy_id: str):
    """Get details for a specific policy."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    policy = aptos_agent.get_policy_details(policy_id)
    
    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy {policy_id} not found")
    
    return BlockchainResponse(
        success=True,
        message="Policy found",
        data={"policy": policy}
    )

@router.post("/process-payment", response_model=BlockchainResponse)
async def process_payment(request: PaymentRequest):
    """Process a premium payment for a policy."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    result = aptos_agent.process_premium_payment(request.wallet_address, request.policy_id, request.amount)
    
    if not result.get("success", False):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to process payment"))
    
    return BlockchainResponse(
        success=True,
        message="Payment processed successfully",
        data={
            "transaction_id": result.get("transaction_id"),
            "policy_id": request.policy_id,
            "amount": request.amount
        }
    )

@router.post("/submit-claim", response_model=BlockchainResponse)
async def submit_claim(request: ClaimRequest):
    """Submit an insurance claim for a policy."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    result = aptos_agent.submit_claim(request.wallet_address, request.policy_id, request.claim_data)
    
    if not result.get("success", False):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to submit claim"))
    
    return BlockchainResponse(
        success=True,
        message="Claim submitted successfully",
        data={
            "claim_id": result.get("claim_id"),
            "policy_id": request.policy_id,
            "status": result.get("status")
        }
    )

@router.get("/claim-status/{claim_id}", response_model=BlockchainResponse)
async def get_claim_status(claim_id: str):
    """Get the status of a claim."""
    if not aptos_agent:
        raise HTTPException(status_code=500, detail="Aptos agent not initialized")
    
    result = aptos_agent.get_claim_status(claim_id)
    
    if not result.get("claim_id"):
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found")
    
    return BlockchainResponse(
        success=True,
        message=result.get("message", "Claim status retrieved"),
        data={
            "claim_id": claim_id,
            "status": result.get("status"),
            "updated_at": result.get("updated_at")
        }
    ) 