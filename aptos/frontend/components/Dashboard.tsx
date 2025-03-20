import { useState, useEffect } from "react";
import { Message, PolicyCard, ChatSession } from "./dashboard/types";
import { Sidebar } from "./dashboard/Sidebar";
import { ChatTab } from "./dashboard/ChatTab";
import { PoliciesTab } from "./dashboard/PoliciesTab";
import { ClaimsTab } from "./dashboard/ClaimsTab";
import { SessionManager } from "./dashboard/SessionManager";
import { getUserUUID } from "../utils/uuid";
import { getUserData, createSession, getSession, getUserSessions, addMessage } from "../utils/api";

export function Dashboard() {
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
        setLoading(true);
        // Get the user's UUID
        const uuid = getUserUUID();
        
        if (!uuid) {
          setError("No user ID found. Please complete onboarding first.");
          return;
        }
        
        // Fetch user data from the backend
        const data = await getUserData(uuid);
        setUserData(data);
        
        // Fetch or create a session
        await fetchOrCreateSession(uuid);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load your information. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const fetchOrCreateSession = async (userId: string) => {
    try {
      // First try to get existing sessions
      const sessionsData = await getUserSessions(userId);
      
      if (sessionsData.sessions && sessionsData.sessions.length > 0) {
        // Use the most recent session
        setUserSessions(sessionsData.sessions);
        const sessionId = sessionsData.sessions[0]; // Most recent session
        setCurrentSessionId(sessionId);
        
        // Fetch the session data
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
        
        // Save the initial greeting message to the session
        if (messages.length > 0) {
          const initialMessage = messages[0];
          await addMessage(userId, newSession.session_id, {
            id: initialMessage.id,
            sender: initialMessage.sender,
            text: initialMessage.text,
            timestamp: initialMessage.timestamp.toISOString()
          });
        }
      }
    } catch (error) {
      console.error("Error setting up session:", error);
      setError("Failed to set up chat session. Please try again later.");
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !userData?.uuid || !currentSessionId) return;

    // Add user message to UI
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);
    
    try {
      // Save user message to session
      await addMessage(
        userData.uuid, 
        currentSessionId, 
        {
          id: userMessage.id,
          sender: userMessage.sender,
          text: userMessage.text,
          timestamp: userMessage.timestamp.toISOString()
        }
      );
      
      // Simulate AI response after a delay
      setTimeout(async () => {
        const aiResponse = generateAIResponse(inputValue);
        setMessages((prev) => [...prev, aiResponse]);
        setIsTyping(false);
        
        // Save AI response to session
        await addMessage(
          userData.uuid,
          currentSessionId as string,
          {
            id: aiResponse.id,
            sender: aiResponse.sender,
            text: aiResponse.text,
            timestamp: aiResponse.timestamp.toISOString()
          }
        );
      }, 1500);
    } catch (error) {
      console.error("Error saving message:", error);
      setIsTyping(false);
    }
  };

  const generateAIResponse = (userInput: string): Message => {
    // This is a placeholder for actual AI integration
    console.log("User input:", userInput);
    
    // Simple response logic based on keywords
    let responseText = "";
    
    if (userInput.toLowerCase().includes("policy") || userInput.toLowerCase().includes("insurance")) {
      responseText = "I can help you find the right insurance policy based on your needs. Would you like me to recommend a policy for you?";
    } else if (userInput.toLowerCase().includes("premium") || userInput.toLowerCase().includes("cost")) {
      responseText = "Premium costs vary based on several factors including your age, health status, and coverage amount. I can calculate a personalized premium for you.";
    } else if (userInput.toLowerCase().includes("claim")) {
      responseText = "To file a claim, you'll need to provide some documentation. I can guide you through the process step by step.";
    } else if (userInput.toLowerCase().includes("hello") || userInput.toLowerCase().includes("hi")) {
      responseText = "Hello! How can I assist you with your insurance needs today?";
    } else {
      responseText = "I'm here to help with all your insurance needs. Could you please provide more details about what you're looking for?";
    }
    
    return {
      id: Date.now().toString(),
      sender: "agent",
      text: responseText,
      timestamp: new Date(),
    };
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
      
      setMessages(convertedMessages.length > 0 ? convertedMessages : [
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
      
      // Reset messages to initial state for new session
      const initialMessage: Message = {
        id: "1",
        sender: "agent",
        text: "Hello! I'm Cora, your AI insurance assistant. How can I help you today?",
        timestamp: new Date(),
      };
      
      setMessages([initialMessage]);
      
      // Save the initial greeting message to the session
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
    } catch (error) {
      console.error("Error setting up new session:", error);
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
    <div className="min-h-screen bg-cora-dark">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-neue font-extrabold gradient_text_2">Insurance Dashboard</h1>
          <p className="text-cora-light mt-2 text-lg">Your insurance journey, simplified</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            
            {activeTab === "chat" && userData?.uuid && (
              <div className="mt-6 bg-black/20 rounded-xl border border-white/10 p-4">
                <SessionManager 
                  userId={userData.uuid}
                  sessionIds={userSessions}
                  currentSessionId={currentSessionId}
                  onSessionChange={handleSessionChange}
                  onSessionCreate={handleSessionCreate}
                />
              </div>
            )}
          </div>
          
          {/* Main Content Area */}
          <div className="lg:col-span-9 h-[calc(100vh-200px)]">
            <div className="rounded-3xl transform-gpu transition-all duration-300 hover:shadow-[0px_16px_40px_4px_rgba(46,139,87,0.15)] p-[1px] h-full overflow-hidden bg-gradient-to-b from-cora-gray via-[#60606442] to-cora-secondary w-full">
              <div className="h-full w-full relative rounded-[23px] overflow-hidden black_card_gradient shadow-2xl">
                <div className="absolute z-10 w-full h-full p-6">
                  {activeTab === "chat" && (
                    <ChatTab 
                      messages={messages}
                      isTyping={isTyping}
                      inputValue={inputValue}
                      setInputValue={setInputValue}
                      handleSendMessage={handleSendMessage}
                      handleKeyPress={handleKeyPress}
                    />
                  )}
                  
                  {activeTab === "policies" && (
                    <PoliciesTab policies={policies} />
                  )}
        
                  {activeTab === "claims" && (
                    <ClaimsTab policies={policies} setActiveTab={setActiveTab} />
                  )}
                </div>
                
                <div
                  className="absolute inset-0 opacity-10 z-0 pointer-events-none"
                  style={{
                    backgroundImage: `url('/assets/dots_svg.svg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}