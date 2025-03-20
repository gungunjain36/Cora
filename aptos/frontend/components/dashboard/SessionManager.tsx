import { useState } from 'react';
import { createSession } from '../../utils/api';

type SessionManagerProps = {
  userId: string;
  sessionIds: string[];
  currentSessionId: string | null;
  onSessionChange: (sessionId: string) => void;
  onSessionCreate: (sessionId: string) => void;
};

export function SessionManager({
  userId,
  sessionIds,
  currentSessionId,
  onSessionChange,
  onSessionCreate
}: SessionManagerProps) {
  const [isCreating, setIsCreating] = useState(false);

  // Format session ID to be more user-friendly
  const formatSessionId = (sessionId: string): string => {
    return sessionId.substring(0, 8);
  };

  // Format date from ISO string
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Handle creating a new session
  const handleCreateSession = async () => {
    try {
      setIsCreating(true);
      const newSession = await createSession(userId);
      onSessionCreate(newSession.session_id);
    } catch (error) {
      console.error('Error creating new session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="border-b border-white/10 pb-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-cora-light font-medium">Chat Sessions</h3>
        <button
          onClick={handleCreateSession}
          disabled={isCreating}
          className="text-sm text-cora-primary hover:text-cora-secondary px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
        >
          {isCreating ? 'Creating...' : 'New Session'}
        </button>
      </div>
      
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {sessionIds.map((sessionId) => (
          <button
            key={sessionId}
            onClick={() => onSessionChange(sessionId)}
            className={`w-full text-left p-2 rounded-md transition-colors ${
              sessionId === currentSessionId
                ? 'bg-cora-primary/20 text-white'
                : 'text-gray-300 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs">{formatSessionId(sessionId)}</span>
              {sessionId === currentSessionId && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-cora-primary text-cora-light">
                  Active
                </span>
              )}
            </div>
          </button>
        ))}
        
        {sessionIds.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-2">
            No previous sessions found
          </div>
        )}
      </div>
    </div>
  );
} 