import { useState, useEffect } from "react";
import { Message, PolicyCard, ChatSession } from "./dashboard/types";
import { Sidebar } from "./dashboard/Sidebar";
import { ChatTab } from "./dashboard/ChatTab";
import { PoliciesTab } from "./dashboard/PoliciesTab";
import { ClaimsTab } from "./dashboard/ClaimsTab";
import { SessionManager } from "./dashboard/SessionManager";
import { getUserUUID } from "../utils/uuid";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { blockchainService } from "../utils/blockchainService";
import { 
  getUserData, 
  createSession, 
  getSession, 
  getUserSessions, 
  addMessage,
  sendMessageToAgent,
  getConversationHistory,
  initializeSession
} from "../utils/api";

export function Dashboard() {
  const { user, authenticated, loading: authLoading } = useAuth();
  const { account } = useWallet();
  const [userData, setUserData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "agent",
      text: "Hello! I'm Cora, your AI insurance assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "policies" | "claims">("chat");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [userSessions, setUserSessions] = useState<string[]>([]);
  const [policies, setPolicies] = useState<PolicyCard[]>([
    {
      id: "policy-1",
      name: "Term Life Insurance",
      coverage: "₹50,00,000",
      premium: "₹12,500/year",
      status: "Active" as "Active" | "Pending" | "Expired",
      details: [
        { label: "Term Length", value: "20 years" },
        { label: "Premium Payment", value: "Annual" }
      ]
    }
  ]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (authLoading) return; // Wait for auth to load
        
        setLoading(true);
        
        // Check if user exists from auth
        if (!authenticated || !user) {
          setError("No user ID found. Please complete onboarding first.");
          setLoading(false);
          return;
        }
        
        // Get UUID from user object or generate one
        const userId = user.uuid || getUserUUID();
        
        // Use user data from auth context or fetch it
        const userInfo = user || await getUserData(userId);
        setUserData(userInfo);
        
        // If wallet is connected, verify or create wallet mapping
        if (account?.address && userInfo?.uuid) {
          try {
            // Check if wallet is already mapped
            const mappingResult = await blockchainService.verifyWallet(userInfo.uuid, account.address);
            
            // If not mapped, create mapping
            if (!mappingResult.success) {
              await blockchainService.createWalletMapping(userInfo.uuid, account.address);
              console.log("Created new wallet mapping");
            } else {
              console.log("Wallet mapping verified");
            }
            
            // After successful wallet mapping or verification, fetch policies
            fetchUserPolicies(account.address);
          } catch (err) {
            console.error("Error with wallet mapping:", err);
          }
        }
        
        // Fetch or create a session
        await fetchOrCreateSession(userId);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load your information. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, authenticated, authLoading, account?.address]);

  // Add function to fetch user policies
  const fetchUserPolicies = async (walletAddress: string) => {
    try {
      const result = await blockchainService.getUserPolicies(walletAddress);
      
      if (result.success && result.data?.policies) {
        // Map blockchain policies to the PolicyCard format
        const formattedPolicies = result.data.policies.map((policy: any) => ({
          id: policy.policy_id,
          name: policy.policy_type,
          coverage: `$${policy.coverage_amount?.toLocaleString()}`,
          premium: `$${policy.premium_amount?.toLocaleString()}/year`,
          status: policy.status || "Active",
          details: [
            { label: "Start Date", value: policy.start_date || "N/A" },
            { label: "End Date", value: policy.end_date || "N/A" },
            { label: "Policy Type", value: policy.policy_type || "Standard" }
          ]
        }));
        
        setPolicies(formattedPolicies);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    }
  };

  const fetchOrCreateSession = async (userId: string) => {
    try {
      // First try to get existing sessions
      const sessionsData = await getUserSessions(userId);
      
      if (sessionsData.sessions && sessionsData.sessions.length > 0) {
        // Use the most recent session
        setUserSessions(sessionsData.sessions);
        const sessionId = sessionsData.sessions[0]; // Most recent session
        setCurrentSessionId(sessionId);
        
        // Try to get conversation history from the agent
        try {
          const historyData = await getConversationHistory(userId);
          if (historyData.history && historyData.history.length > 0) {
            // Convert message timestamp strings back to Date objects for the UI
            const convertedMessages = historyData.history.map((msg: any) => ({
              id: msg.id || Date.now().toString(),
              text: msg.content,
              sender: msg.role === "user" ? "user" : "agent",
              timestamp: new Date()
            }));
            
            if (convertedMessages.length > 0) {
              setMessages(convertedMessages);
              
              // Save these messages to the session if they don't exist there
              for (const msg of convertedMessages) {
                try {
                  await addMessage(userId, sessionId, {
                    id: msg.id,
                    sender: msg.sender,
                    text: msg.text,
                    timestamp: msg.timestamp.toISOString()
                  });
                } catch (err) {
                  console.error("Error saving message to session:", err);
                }
              }
              
              return;
            }
          }
        } catch (err) {
          console.error("Error fetching agent history:", err);
          // Continue with regular session loading if agent history fails
        }
        
        // Fall back to fetching session data if agent history isn't available
        const sessionData = await getSession(userId, sessionId);
        
        // Convert message timestamp strings back to Date objects for the UI
        const convertedMessages = sessionData.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          sender: msg.sender as "user" | "agent"
        }));
        
        if (convertedMessages.length > 0) {
          setMessages(convertedMessages);
        }
      } else {
        // Create a new session if none exists
        const newSession = await createSession(userId);
        setCurrentSessionId(newSession.session_id);
        setUserSessions([newSession.session_id]);
        
        // Get a personalized greeting from the communication agent
        try {
          const initialGreeting = await initializeSession(
            userId, 
            userData || undefined
          );
          
          // Create an initial message with the greeting
          const initialMessage: Message = {
            id: "1",
            sender: "agent",
            text: initialGreeting.greeting,
            timestamp: new Date(),
          };
          
          // Set this as the first message
          setMessages([initialMessage]);
          
          // Save it to the session
          await addMessage(userId, newSession.session_id, {
            id: initialMessage.id,
            sender: initialMessage.sender,
            text: initialMessage.text,
            timestamp: initialMessage.timestamp.toISOString()
          });
        } catch (error) {
          console.error("Error getting initial greeting:", error);
          
          // Fallback to default greeting if agent fails
          const defaultMessage: Message = {
            id: "1",
            sender: "agent",
            text: "Hello! I'm Cora, your AI insurance assistant. How can I help you today?",
            timestamp: new Date(),
          };
          
          setMessages([defaultMessage]);
          
          // Save the default message to the session
          await addMessage(userId, newSession.session_id, {
            id: defaultMessage.id,
            sender: defaultMessage.sender,
            text: defaultMessage.text,
            timestamp: defaultMessage.timestamp.toISOString()
          });
        }
      }
    } catch (error) {
      console.error("Error setting up session:", error);
      setError("Failed to set up chat session. Please try again later.");
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;
    
    // Create a new message for the UI
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date(),
    };
    
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsTyping(true);
    
    try {
      if (!user || !currentSessionId) {
        throw new Error("No user or session found");
      }
      
      const userUuid = user.uuid || "";
      
      // Save user message to session
      await addMessage(userUuid, currentSessionId, {
        id: newUserMessage.id,
        sender: newUserMessage.sender,
        text: newUserMessage.text,
        timestamp: newUserMessage.timestamp.toISOString()
      });
      
      // Send message to AI agent and get response
      const response = await sendMessageToAgent(userUuid, inputValue);
      
      // Create agent message from response
      const agentMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: response.response || "I'm sorry, I couldn't process that request.",
        timestamp: new Date(),
      };
      
      // Update messages with agent response
      setMessages([...updatedMessages, agentMessage]);
      
      // Save agent message to session
      await addMessage(userUuid, currentSessionId, {
        id: agentMessage.id,
        sender: agentMessage.sender,
        text: agentMessage.text,
        timestamp: agentMessage.timestamp.toISOString()
      });
    } catch (err) {
      console.error("Error sending message:", err);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: "Sorry, there was an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSessionChange = async (sessionId: string) => {
    if (!userData?.uuid || sessionId === currentSessionId) return;
    
    try {
      setLoading(true);
      setCurrentSessionId(sessionId);
      
      // Fetch the session data
      const sessionData = await getSession(userData.uuid, sessionId);
      
      // Convert message timestamp strings back to Date objects for the UI
      const convertedMessages = sessionData.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        sender: msg.sender as "user" | "agent"
      }));
      
      // Check if we have messages in this session
      const hasMessages = convertedMessages.length > 0;
      
      // If no messages are found in the session, try to fetch from agent history
      if (!hasMessages) {
        try {
          const historyData = await getConversationHistory(userData.uuid);
          if (historyData.history && historyData.history.length > 0) {
            // Convert agent history to our message format
            const agentMessages = historyData.history.map((msg: any) => ({
              id: msg.id || Date.now().toString(),
              text: msg.content,
              sender: msg.role === "user" ? "user" : "agent",
              timestamp: new Date()
            }));
            
            if (agentMessages.length > 0) {
              setMessages(agentMessages);
              
              // Save these messages to the session
              for (const msg of agentMessages) {
                try {
                  await addMessage(userData.uuid, sessionId, {
                    id: msg.id,
                    sender: msg.sender,
                    text: msg.text,
                    timestamp: msg.timestamp.toISOString()
                  });
                } catch (err) {
                  console.error("Error saving message to session:", err);
                }
              }
              
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error("Error fetching agent history:", err);
        }
      }
      
      // Use session messages or default greeting if no messages were found
      setMessages(hasMessages ? convertedMessages : [
        {
          id: "1",
          sender: "agent" as "agent",
          text: "Hello! I'm Cora, your AI insurance assistant. How can I help you today?",
          timestamp: new Date(),
        }
      ]);
    } catch (error) {
      console.error("Error changing session:", error);
      setError("Failed to load the selected session. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSessionCreate = async (sessionId: string) => {
    if (!userData?.uuid) return;
    
    try {
      setCurrentSessionId(sessionId);
      setUserSessions((prev) => [sessionId, ...prev]);
      
      // Get a personalized greeting from the communication agent
      const initialGreeting = await initializeSession(userData.uuid, userData);
      
      // Create an initial message with the greeting
      const initialMessage: Message = {
        id: "1",
        sender: "agent",
        text: initialGreeting.greeting,
        timestamp: new Date(),
      };
      
      // Set this as the first message
      setMessages([initialMessage]);
      
      // Save it to the session
      try {
        await addMessage(
          userData.uuid,
          sessionId,
          {
            id: initialMessage.id,
            sender: initialMessage.sender,
            text: initialMessage.text,
            timestamp: initialMessage.timestamp.toISOString()
          }
        );
      } catch (err) {
        console.error("Error saving initial greeting to session:", err);
      }
    } catch (error) {
      console.error("Error creating new session:", error);
      
      // Fallback to default greeting if agent fails
      const defaultMessage: Message = {
        id: "1",
        sender: "agent",
        text: "Hello! I'm Cora, your AI insurance assistant. How can I help you today?",
        timestamp: new Date(),
      };
      
      setMessages([defaultMessage]);
      
      // Try to save the default message
      try {
        await addMessage(
          userData.uuid,
          sessionId,
          {
            id: defaultMessage.id,
            sender: defaultMessage.sender,
            text: defaultMessage.text,
            timestamp: defaultMessage.timestamp.toISOString()
          }
        );
      } catch (err) {
        console.error("Error saving default greeting to session:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Loading your dashboard...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Dashboard Error</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-[#0d1117] text-cora-light">
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      <div className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-cora-primary"></div>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6 backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-xl font-medium mb-4">{error}</h2>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gradient-to-r from-cora-primary to-cora-secondary text-cora-light rounded-xl hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "chat" && (
              <>
                <div className="max-w-5xl mx-auto h-full">
                  <SessionManager 
                    userId={user?.uuid || ""}
                    sessionIds={userSessions}
                    currentSessionId={currentSessionId}
                    onSessionCreate={handleSessionCreate}
                    onSessionChange={handleSessionChange}
                  />
                  <div className="mt-4 h-[calc(100%-4rem)]">
                    <ChatTab 
                      messages={messages}
                      isTyping={isTyping}
                      inputValue={inputValue}
                      setInputValue={setInputValue}
                      handleSendMessage={sendMessage}
                      handleKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                  </div>
                </div>
              </>
            )}
            
            {activeTab === "policies" && (
              <PoliciesTab userId={user?.uuid || ""} />
            )}
            
            {activeTab === "claims" && (
              <ClaimsTab userId={user?.uuid || ""} />
            )}
          </>
        )}
      </div>
    </div>
  );
}