from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

# Create router
router = APIRouter(
    prefix="/sessions",
    tags=["sessions"],
    responses={404: {"description": "Not found"}},
)

# Message model
class Message(BaseModel):
    id: str
    sender: str
    text: str
    timestamp: str

# Session model
class Session(BaseModel):
    session_id: str
    user_id: str
    messages: List[Message] = []
    created_at: str
    updated_at: str

# Session update model
class SessionUpdate(BaseModel):
    messages: List[Message]

# Helper function to ensure sessions directory exists
def get_sessions_dir():
    sessions_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sessions")
    os.makedirs(sessions_dir, exist_ok=True)
    return sessions_dir

# Helper function to get user sessions
def get_user_sessions(user_id: str):
    sessions_dir = get_sessions_dir()
    sessions = []
    
    # Pattern to match: user_id_*.json
    for filename in os.listdir(sessions_dir):
        if filename.startswith(f"{user_id}_") and filename.endswith(".json"):
            session_id = filename.replace(f"{user_id}_", "").replace(".json", "")
            sessions.append(session_id)
            
    return sessions

# Helper function to save session data
def save_session(user_id: str, session_data: Dict[str, Any]):
    try:
        sessions_dir = get_sessions_dir()
        
        # Validate session data
        if not session_data.get('session_id'):
            raise ValueError("Session data missing session_id")
        
        # Create the session JSON file
        file_path = os.path.join(sessions_dir, f"{user_id}_{session_data['session_id']}.json")
        
        with open(file_path, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        # Verify the file was created
        if not os.path.exists(file_path):
            raise ValueError(f"Failed to create session file at {file_path}")
        
        return file_path
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error saving session data: {str(e)}\n{error_details}")
        raise

# Create a new session
@router.post("/{user_id}")
async def create_session(user_id: str):
    try:
        # Generate a new session ID
        session_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        # Create session data
        session_data = {
            "session_id": session_id,
            "user_id": user_id,
            "messages": [],
            "created_at": timestamp,
            "updated_at": timestamp
        }
        
        # Save the session
        file_path = save_session(user_id, session_data)
        
        return {
            "message": "Session created successfully",
            "user_id": user_id,
            "session_id": session_id,
            "file_path": os.path.basename(file_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

# Get all sessions for a user
@router.get("/{user_id}")
async def get_sessions(user_id: str):
    try:
        sessions = get_user_sessions(user_id)
        return {
            "user_id": user_id,
            "sessions": sessions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve sessions: {str(e)}")

# Get a specific session
@router.get("/{user_id}/{session_id}")
async def get_session(user_id: str, session_id: str):
    try:
        sessions_dir = get_sessions_dir()
        file_path = os.path.join(sessions_dir, f"{user_id}_{session_id}.json")
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Session not found")
        
        with open(file_path, 'r') as f:
            session_data = json.load(f)
            
        return session_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve session: {str(e)}")

# Update session with new messages
@router.put("/{user_id}/{session_id}")
async def update_session(
    user_id: str, 
    session_id: str, 
    session_update: SessionUpdate = Body(...)
):
    try:
        sessions_dir = get_sessions_dir()
        file_path = os.path.join(sessions_dir, f"{user_id}_{session_id}.json")
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Session not found")
        
        # Read existing session data
        with open(file_path, 'r') as f:
            session_data = json.load(f)
        
        # Update messages and updated_at timestamp
        session_data["messages"] = session_update.messages
        session_data["updated_at"] = datetime.now().isoformat()
        
        # Save updated session
        with open(file_path, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return {
            "message": "Session updated successfully",
            "user_id": user_id,
            "session_id": session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update session: {str(e)}")

# Add a message to a session
@router.post("/{user_id}/{session_id}/messages")
async def add_message(
    user_id: str, 
    session_id: str, 
    message: Message = Body(...)
):
    try:
        sessions_dir = get_sessions_dir()
        file_path = os.path.join(sessions_dir, f"{user_id}_{session_id}.json")
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Session not found")
        
        # Read existing session data
        with open(file_path, 'r') as f:
            session_data = json.load(f)
        
        # Add new message and update timestamp
        session_data["messages"].append(message.dict())
        session_data["updated_at"] = datetime.now().isoformat()
        
        # Save updated session
        with open(file_path, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return {
            "message": "Message added successfully",
            "user_id": user_id,
            "session_id": session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add message: {str(e)}") 