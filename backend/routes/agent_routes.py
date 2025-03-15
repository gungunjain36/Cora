from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import os

from  utils.useLLM import UseLLM
from  agents.communication_agent import CommunicationAgent

# Create router
router = APIRouter(
    prefix="/agents",
    tags=["agents"],
    responses={404: {"description": "Not found"}},
)

# Initialize the LLM utility
try:
    llm_utility = UseLLM(
        model_name="gpt-4o",
        temperature=0.7,
        api_key=os.environ.get("OPENAI_API_KEY")
    )
    
    # Initialize the communication agent
    communication_agent = CommunicationAgent(llm_utility)
    print("Communication agent initialized")
    print(communication_agent)
except Exception as e:
    print(f"Error initializing agents: {str(e)}")
    communication_agent = None

# Request and response models
class MessageRequest(BaseModel):
    message: str
    user_id: str = "default_user"

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
    """
    if communication_agent is None:
        raise HTTPException(status_code=500, detail="Agents not initialized properly")
    
    try:
        response = communication_agent.invoke(request.message, request.user_id)
        return response
    except Exception as e:
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