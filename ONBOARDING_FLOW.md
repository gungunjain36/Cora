# User Onboarding Flow

This document outlines the user onboarding flow for the application, focusing on user identification and data persistence.

## Overview

The flow follows these steps:

1. A new user begins the onboarding process in the frontend
2. A unique UUID is generated for the user and stored locally
3. User completes the onboarding form with their personal details
4. The UUID and form data are sent to the backend
5. Backend creates a unique JSON file for the user, named with their UUID
6. User data is persisted and accessible via the UUID for future sessions

## Frontend Implementation

### UUID Generation

- Utility functions in `aptos/frontend/utils/uuid.ts` handle UUID generation
- UUIDs are generated using a standard v4 implementation
- Once generated, UUIDs are stored in localStorage for persistence

### API Utilities

- API communication utilities in `aptos/frontend/utils/api.ts`
- `registerUser()` function handles sending user data to the backend
- `getUserData()` function retrieves user data using the UUID

### Onboarding Component

- Located in `aptos/frontend/components/Onboarding.tsx`
- Collects user information through a multi-step form
- On form completion, gets/generates UUID and submits data to backend
- Provides error handling and loading states

### Dashboard Component

- Located in `aptos/frontend/components/Dashboard.tsx`
- Retrieves user data using the stored UUID
- Displays user information and profile details

## Backend Implementation

### User Routes

- API routes defined in `backend/routes/user_routes.py`
- Endpoints:
  - `POST /users` - Create a new user with UUID and form data
  - `GET /users/{uuid}` - Retrieve user data by UUID

### Data Storage

- User data is stored in individual JSON files
- Files are created in the `backend/Users/` directory
- Each file is named with the user's UUID (e.g., `123e4567-e89b-12d3-a456-426614174000.json`)
- This allows for easy user identification without database configuration

## Testing the Flow

1. Start the frontend and backend servers
2. Visit the onboarding page and complete the form
3. Check the backend's `Users/` directory to verify a JSON file was created with the UUID
4. Visit the dashboard to confirm user data is successfully retrieved

## Security Considerations

- UUIDs are stored in localStorage, which has some security limitations
- For a production system, consider additional security measures:
  - Use a proper authentication system (JWT, OAuth, etc.)
  - Encrypt sensitive user data
  - Add rate limiting to prevent abuse
  - Implement proper validation of user input 