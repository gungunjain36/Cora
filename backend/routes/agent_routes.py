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
        # Validate input
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        if not request.user_id:
            raise HTTPException(status_code=400, detail="User ID is required")
        
        # Log request for debugging
        print(f"Before async graph execution - User: {request.user_id}, Stage: greeting")
        print(f"Message: {request.message[:50]}{'...' if len(request.message) > 50 else ''}")
        
        # Use the async version for better performance
        response = await communication_agent.invoke_async(
            request.message, 
            request.user_id,
            request.user_details
        )
        
        # Validate response format
        if 'response' not in response:
            print(f"Invalid response format: {response}")
            raise HTTPException(status_code=500, detail="Invalid response format from agent")
        
        # Log successful response for debugging
        print(f"Successfully processed request for user: {request.user_id}")
        print(f"Response: {response['response'][:50]}{'...' if len(response['response']) > 50 else ''}")
        
        return response
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error processing message: {str(e)}\n{error_details}")
        
        # Return a friendly error message to the client
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing message: {str(e)}. Please try again later."
        )

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

@router.post("/initialize-session/{user_id}")
async def initialize_session(user_id: str, user_details: Optional[Dict[str, Any]] = None):
    """
    Initialize a session with a greeting message from the communication agent.
    
    This is useful when creating a new chat session for a user.
    """
    if communication_agent is None:
        raise HTTPException(status_code=500, detail="Agents not initialized properly")
    
    try:
        # Generate a greeting message
        greeting_prompt = "Hello"
        
        # Use the communication agent to generate a personalized greeting
        response = await communication_agent.invoke_async(
            greeting_prompt,
            user_id,
            user_details
        )
        
        return {
            "greeting": response["response"],
            "conversation_stage": response.get("conversation_stage", "general_conversation")
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error initializing session: {str(e)}\n{error_details}")
        
        # Provide a default greeting if the agent fails
        return {
            "greeting": "Hello! I'm Cora, your AI insurance assistant. How can I help you today?",
            "conversation_stage": "general_conversation"
        } 