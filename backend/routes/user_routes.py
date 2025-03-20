from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
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
    smoker: Optional[str] = None
    alcoholConsumption: Optional[str] = None
    preExistingConditions: Optional[str] = None
    familyHistory: Optional[str] = None
    occupation: Optional[str] = None
    riskyHobbies: Optional[str] = None
    exerciseFrequency: Optional[str] = None
    income: Optional[str] = None
    coverageAmount: Optional[str] = None
    policyTerm: Optional[str] = None
    paymentFrequency: Optional[str] = None
    riders: Optional[str] = None
    
    # Allow additional fields
    class Config:
        extra = "allow"


# Helper function to save user data to a JSON file
def save_user_data(user_data: Dict[str, Any]):
    try:
        # Ensure the Users directory exists
        users_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Users")
        os.makedirs(users_dir, exist_ok=True)
        
        if not os.path.exists(users_dir):
            raise ValueError(f"Failed to create Users directory at {users_dir}")
        
        # Validate UUID before creating file
        if not user_data.get('uuid'):
            raise ValueError("User data missing UUID")
        
        # Create the user's JSON file
        file_path = os.path.join(users_dir, f"{user_data['uuid']}.json")
        
        with open(file_path, 'w') as f:
            json.dump(user_data, f, indent=2)
        
        # Verify the file was created
        if not os.path.exists(file_path):
            raise ValueError(f"Failed to create user file at {file_path}")
        
        return file_path
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error saving user data: {str(e)}\n{error_details}")
        raise


@router.post("/")
async def create_user(user_data: UserData = Body(...)):
    try:
        # Convert to dict for saving
        user_dict = user_data.dict()
        
        print(f"Received user data: {user_dict}")
        
        # Save the user data to a JSON file
        file_path = save_user_data(user_dict)
        
        return {
            "message": "User data stored successfully",
            "uuid": user_data.uuid,
            "file_path": os.path.basename(file_path)
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error creating user: {str(e)}\n{error_details}")
        raise HTTPException(status_code=500, detail=f"Failed to store user data: {str(e)}")


@router.get("/{uuid}")
async def get_user(uuid: str):
    users_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Users")
    file_path = os.path.join(users_dir, f"{uuid}.json")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"User with UUID {uuid} not found")
    
    try:
        with open(file_path, 'r') as f:
            user_data = json.load(f)
        return user_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user data: {str(e)}") 