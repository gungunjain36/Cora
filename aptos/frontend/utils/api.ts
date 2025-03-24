/**
 * API utilities for interacting with the backend
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Register a new user with the backend
 * @param userData User data object containing UUID and form information
 * @returns API response
 */
export const registerUser = async (userData: Record<string, any>) => {
  try {
    const response = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    
    if (!response.ok) {
      // Try to get more detailed error information
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = JSON.stringify(errorData);
      } catch {
        errorDetail = `Status: ${response.status}`;
      }
      
      throw new Error(`API error: ${response.status} - ${errorDetail}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to register user:', error);
    throw error;
  }
};

/**
 * Get user data by UUID
 * @param uuid User's UUID
 * @returns User data from the backend
 */
export const getUserData = async (uuid: string) => {
  try {
    const response = await fetch(`${API_URL}/users/${uuid}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    throw error;
  }
};

/**
 * Create a new chat session for a user
 * @param userId The UUID of the user
 * @returns Session data with the session ID
 */
export const createSession = async (userId: string) => {
  try {
    const response = await fetch(`${API_URL}/sessions/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to create session:', error);
    throw error;
  }
};

/**
 * Get all sessions for a user
 * @param userId The UUID of the user
 * @returns List of user's session IDs
 */
export const getUserSessions = async (userId: string) => {
  try {
    const response = await fetch(`${API_URL}/sessions/${userId}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user sessions:', error);
    throw error;
  }
};

/**
 * Get a specific session by ID
 * @param userId The UUID of the user
 * @param sessionId The UUID of the session
 * @returns Session data with messages
 */
export const getSession = async (userId: string, sessionId: string) => {
  try {
    const response = await fetch(`${API_URL}/sessions/${userId}/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch session:', error);
    throw error;
  }
};

/**
 * Add a new message to a session
 * @param userId The UUID of the user
 * @param sessionId The UUID of the session
 * @param message The message object to add
 * @returns Confirmation response
 */
export const addMessage = async (userId: string, sessionId: string, message: {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}) => {
  try {
    const response = await fetch(`${API_URL}/sessions/${userId}/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to add message:', error);
    throw error;
  }
};

/**
 * Send a message to the communication agent and get a response
 * @param userId The UUID of the user
 * @param message The message text to send
 * @param userDetails Optional user details for context
 * @returns The response from the communication agent
 */
export const sendMessageToAgent = async (
  userId: string,
  message: string,
  userDetails?: Record<string, any>
) => {
  try {
    const response = await fetch(`${API_URL}/agents/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user_id: userId,
        user_details: userDetails,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get agent response:', error);
    throw error;
  }
};

/**
 * Get conversation history for a user
 * @param userId The UUID of the user
 * @returns The conversation history
 */
export const getConversationHistory = async (userId: string) => {
  try {
    const response = await fetch(`${API_URL}/agents/history/${userId}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch conversation history:', error);
    throw error;
  }
};

/**
 * Initialize a session with a greeting from the communication agent
 * @param userId The UUID of the user
 * @param userDetails Optional user details for context
 * @returns The greeting and conversation stage
 */
export const initializeSession = async (
  userId: string,
  userDetails?: Record<string, any>
) => {
  try {
    const response = await fetch(`${API_URL}/agents/initialize-session/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: userDetails ? JSON.stringify(userDetails) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to initialize session:', error);
    throw error;
  }
};

/**
 * Get user data by wallet address
 * @param walletAddress User's wallet address
 * @returns User data from the backend
 */
export const getUserByWalletAddress = async (walletAddress: string) => {
  try {
    const response = await fetch(`${API_URL}/users/wallet/${walletAddress}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        // Not found is expected if user hasn't completed onboarding
        return null;
      }
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user data by wallet address:', error);
    throw error;
  }
}; 