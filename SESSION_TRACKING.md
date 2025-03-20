# Session Tracking System Documentation

This document explains how the session tracking system works in the Cora Insurance application, covering both frontend and backend components.

## Overview

The session tracking system allows the application to:

1. Create unique chat sessions for each user
2. Store conversation history in JSON files on the backend
3. Load previous sessions when a user returns
4. Switch between multiple sessions
5. Create new sessions when needed

## File Structure

Each user's chat sessions are stored in individual JSON files with the following naming pattern:
```
<uuid>_<session-id>.json
```

Where:
- `<uuid>` is the unique identifier for the user
- `<session-id>` is a unique identifier for the session (UUID v4)

These files are stored in the `backend/sessions` directory.

## Backend Implementation

### Routes

The session system is implemented in `backend/routes/session_routes.py` with the following endpoints:

- `POST /sessions/{user_id}` - Create a new session
- `GET /sessions/{user_id}` - Get all sessions for a user
- `GET /sessions/{user_id}/{session_id}` - Get a specific session
- `PUT /sessions/{user_id}/{session_id}` - Update session with new messages
- `POST /sessions/{user_id}/{session_id}/messages` - Add a single message to a session

### Data Models

- `Message` - Represents a chat message with sender, text, and timestamp
- `Session` - Represents a chat session with messages and metadata
- `SessionUpdate` - Used for updating sessions with new messages

### File Operations

- `get_sessions_dir()` - Ensures the sessions directory exists
- `get_user_sessions(user_id)` - Gets all sessions for a specific user
- `save_session(user_id, session_data)` - Saves session data to a file

## Frontend Implementation

### API Utilities

The frontend communicates with the backend via functions in `aptos/frontend/utils/api.ts`:

- `createSession(userId)` - Creates a new session
- `getUserSessions(userId)` - Gets all sessions for a user
- `getSession(userId, sessionId)` - Gets a specific session
- `addMessage(userId, sessionId, message)` - Adds a message to a session

### Components

#### Dashboard Component

The main component that manages the chat functionality:

- Initializes by loading or creating a session
- Handles sending and receiving messages
- Persists messages to the backend
- Manages multiple sessions

#### SessionManager Component

A dedicated component for managing sessions:

- Displays a list of available sessions
- Allows creating new sessions
- Enables switching between sessions
- Shows the active session

## Usage Flow

1. When a user logs in, the system:
   - Checks if the user has existing sessions
   - Loads the most recent session if available
   - Creates a new session if none exist

2. When a user sends a message:
   - The message is added to the UI
   - The message is sent to the backend and stored in the session file
   - AI responses are also stored in the session file

3. When a user creates a new session:
   - A new UUID is generated for the session
   - A new file is created in the `sessions` directory
   - The UI is reset with a new greeting message

4. When a user switches sessions:
   - The selected session is loaded from the backend
   - The UI is updated with the messages from that session

## Error Handling

- File operations include error checking and logging
- API requests include error handling with appropriate feedback
- UI components display loading states and error messages

## Security Considerations

- Session files are stored on the server, not exposed directly to clients
- User authentication should be implemented to secure access to sessions
- Additional validation may be needed for production use

## Future Enhancements

- Session expiration and cleanup
- Pagination for long conversations
- Session metadata (e.g., topics, tags)
- Session export/import functionality 