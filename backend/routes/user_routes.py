from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field, Extra
import json
import os
from typing import Dict, Any, Optional

# Create router
router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

# User data model
class UserData(BaseModel):
    uuid: str
    walletAddress: Optional[str] = None
    
    # Optional fields from the onboarding form
    name: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    maritalStatus: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None
    medicalConditions: Optional[str] = None
    smoker: Optional[str] = None
    alcoholConsumption: Optional[str] = None
    exerciseFrequency: Optional[str] = None
    diet: Optional[str] = None
    familyHistory: Optional[str] = None
    occupation: Optional[str] = None
    income: Optional[str] = None
    coverageAmount: Optional[str] = None
    policyTerm: Optional[str] = None
    paymentFrequency: Optional[str] = None
    riders: Optional[str] = None
    
    # Allow additional fields
    class Config:
        extra = "allow"


# Helper function to save user data to a JSON file
def save_user_data(user_data: Dict[str, Any]) -> str:
    """Save user data to a JSON file"""
    
    # Create the users directory if it doesn't exist
    os.makedirs("users", exist_ok=True)
    
    # Ensure UUID is present
    if "uuid" not in user_data:
        raise ValueError("User data must include a UUID")
        
    uuid = user_data["uuid"]
    file_path = f"users/{uuid}.json"
    
    try:
        with open(file_path, "w") as file:
            json.dump(user_data, file, indent=2)
        return file_path
    except Exception as e:
        raise e


@router.post("/")
async def create_user(user_data: UserData):
    """Create a new user"""
    try:
        user_dict = user_data.dict()
        file_path = save_user_data(user_dict)
        
        # Create a wallet address to UUID mapping if wallet address is provided
        if user_data.walletAddress:
            create_wallet_mapping(user_data.walletAddress, user_data.uuid)
            
        return {
            "message": "User data saved successfully",
            "uuid": user_data.uuid,
            "file_path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def create_wallet_mapping(wallet_address: str, uuid: str) -> None:
    """Create a mapping from wallet address to user UUID"""
    os.makedirs("wallet_mappings", exist_ok=True)
    mapping_path = f"wallet_mappings/{wallet_address}.txt"
    
    try:
        with open(mapping_path, "w") as file:
            file.write(uuid)
    except Exception as e:
        raise e


@router.get("/{uuid}")
async def get_user(uuid: str):
    """Get user data by UUID"""
    file_path = f"users/{uuid}.json"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"User with UUID {uuid} not found")
    
    try:
        with open(file_path, "r") as file:
            user_data = json.load(file)
        return user_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/wallet/{wallet_address}")
async def get_user_by_wallet(wallet_address: str):
    """Get user data by wallet address"""
    mapping_path = f"wallet_mappings/{wallet_address}.txt"
    
    if not os.path.exists(mapping_path):
        raise HTTPException(status_code=404, detail=f"User with wallet address {wallet_address} not found")
    
    try:
        # Read the UUID from the mapping file
        with open(mapping_path, "r") as file:
            uuid = file.read().strip()
        
        # Fetch the user data using the UUID
        file_path = f"users/{uuid}.json"
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"User data for wallet {wallet_address} not found")
            
        with open(file_path, "r") as file:
            user_data = json.load(file)
            
        return user_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 