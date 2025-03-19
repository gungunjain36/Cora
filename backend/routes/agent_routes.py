from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os
import traceback

from utils.useLLM import UseLLM
from agents.communication_agent import CommunicationAgent

# Create router
router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    responses={404: {"description": "Not found"}},
)

# Initialize the LLM utility
try:
    print("Initializing LLM utility...")
    api_key = os.environ.get("OPENAI_API_KEY")
    print(f"API key available: {bool(api_key)}")
    
    llm_utility = UseLLM(
        model_name="gpt-4",
        temperature=0.7,
        api_key=api_key
    )
    print("LLM utility initialized successfully")
    
    # Initialize the communication agent
    print("Initializing communication agent...")
    communication_agent = CommunicationAgent(llm_utility)
    print("Communication agent initialized successfully")
except Exception as e:
    print(f"Error initializing agents: {str(e)}")
    print(traceback.format_exc())
    communication_agent = None

# Request and response models
class MessageRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    user_details: Optional[Dict[str, Any]] = None

class MessageResponse(BaseModel):
    response: str
    conversation_stage: str

class ConversationHistoryResponse(BaseModel):
    history: List[Dict[str, str]]

# Routes
@router.post("/chat", response_model=MessageResponse)
async def chat(request: MessageRequest):
    """
    Chat with the communication agent.
    
    The request can include user details from the frontend onboarding form.
    """
    if communication_agent is None:
        raise HTTPException(status_code=500, detail="Agents not initialized properly")
    
    try:
        print(f"Processing chat request for user {request.user_id}")
        print(f"User details: {request.user_details}")
        print(f"Message: {request.message}")
        
        # Use the async version for better performance
        response = await communication_agent.invoke_async(
            request.message, 
            request.user_id,
            request.user_details
        )
        
        print(f"Generated response: {response}")
        return response
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        print(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@router.get("/history/{user_id}", response_model=ConversationHistoryResponse)
async def get_conversation_history(user_id: str):
    """
    Get the conversation history for a user.
    """
    if communication_agent is None:
        raise HTTPException(status_code=500, detail="Agents not initialized properly")
    
    try:
        history = communication_agent.get_conversation_history(user_id)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving conversation history: {str(e)}") 