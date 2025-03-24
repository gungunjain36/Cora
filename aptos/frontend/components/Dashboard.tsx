import { useState, useEffect } from "react";
import { Message, PolicyCard, ChatSession } from "./dashboard/types";
import { Sidebar } from "./dashboard/Sidebar";
import { ChatTab } from "./dashboard/ChatTab";
import { PoliciesTab } from "./dashboard/PoliciesTab";
import { ClaimsTab } from "./dashboard/ClaimsTab";
import { getUserUUID } from "../utils/uuid";
import { useAuth } from "@/lib/useAuth";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { blockchainService } from "../utils/blockchainService";
import { useLocation } from "react-router-dom";
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
import { 
  createPolicy, 
  payPremium, 
  fileClaim, 
  getUserPolicies, 
  getPremiumPaymentStatus,
  Policy 
} from "../view-functions/policyService";
import { Toaster, toast } from 'react-hot-toast';

// Feature flags - control behavior
const USE_MOCK_POLICY_RECOMMENDATIONS = true; // Set to false to use real backend recommendations

export function Dashboard() {
  const { user, authenticated, loading: authLoading } = useAuth();
  const { account, connect, wallets, signAndSubmitTransaction } = useWallet();
  const location = useLocation();
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
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [recommendedPolicy, setRecommendedPolicy] = useState<any>(null);
  const [transactionInProgress, setTransactionInProgress] = useState(false);
  const [policyStats, setPolicyStats] = useState({
    totalPolicies: 0,
    totalCoverage: 0,
    totalPremiumPaid: 0,
    activePolicies: 0,
    totalClaims: 0
  });

  // Parse URL parameters to set the active tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    
    // Set active tab based on URL parameter if it exists and is valid
    if (tabParam) {
      if (tabParam === 'policies' || tabParam === 'claims' || tabParam === 'chat') {
        setActiveTab(tabParam);
      }
    }
  }, [location.search]);

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
        
        // If wallet is connected, verify wallet mapping
        if (account?.address && userInfo?.uuid) {
          try {
            console.log("Wallet connection detected. Verifying wallet mapping...");
            // Check if wallet is already mapped
            const mappingResult = await blockchainService.verifyWalletMapping(account.address.toString());
            
            if (mappingResult.success) {
              console.log("Wallet mapping verified");
              // After successful wallet mapping verification, fetch policies
              fetchUserPolicies(account.address.toString());
            } else {
              console.log("Wallet mapping verification failed");
            }
          } catch (err) {
            console.error("Error with wallet mapping:", err);
          }
        } else {
          console.log("No wallet connected or user ID missing", { 
            walletConnected: !!account?.address, 
            userIdExists: !!userInfo?.uuid 
          });
        }
        
        // Fetch or create a session
        await fetchOrCreateSession(userId);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load your information. Please try again later.");
      } finally {
        setLoading(false);
        
        // Delay setting dashboardReady to allow for animation
        setTimeout(() => {
          setDashboardReady(true);
        }, 300);
      }
    };

    fetchUserData();
  }, [user, authenticated, authLoading, account?.address]);

  // Add function to fetch user policies
  const fetchUserPolicies = async (walletAddress: string) => {
    try {
      const result = await blockchainService.getUserPolicies(walletAddress);
      
      if (result.success && result.data?.policies) {
        // Map blockchain policies to the PolicyCard format with payment info
        const formattedPolicies = result.data.policies.map((policy: any) => {
          // Calculate if payment is due
          const startDate = new Date(policy.start_date || Date.now());
          const now = new Date();
          const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const paymentDue = policy.status === 'Pending' || (daysSinceStart > 0 && daysSinceStart % 365 === 0);
          
          // Create next payment date (1 year after start date)
          const paymentDate = new Date(startDate);
          paymentDate.setFullYear(paymentDate.getFullYear() + 1);
          
          return {
            id: policy.policy_id,
            name: policy.policy_type || 'Life Insurance Policy',
            coverage: `$${(policy.coverage_amount || 0).toLocaleString()}`,
            premium: `$${(policy.premium || 0).toLocaleString()} / year`,
            status: policy.status || 'Active',
            premiumAmount: policy.premium || 0,
            txHash: policy.transaction_hash,
            policyCreationDate: policy.start_date,
            paymentDue: paymentDue,
            paymentDueDate: paymentDate.toISOString().split('T')[0],
            nextPaymentAmount: policy.premium || 0,
            details: [
              { label: 'Policy Type', value: policy.policy_type || 'N/A' },
              { label: 'Term Length', value: `${policy.term_length || 'N/A'} years` },
              { label: 'Start Date', value: policy.start_date || 'N/A' },
              { label: 'End Date', value: policy.end_date || 'N/A' },
            ]
          };
        });
        
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
    
    // Check if wallet is connected when needed for blockchain operations
    if (!account?.address && inputValue.toLowerCase().includes("policy")) {
      setMessages([...messages, {
        id: Date.now().toString(),
        sender: "agent",
        text: "To interact with policies or create new insurance products, you'll need to connect your wallet first. Please use the connect wallet button in the navbar.",
        timestamp: new Date(),
      }]);
      return;
    }
    
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
      // Check for policy-related requests
      const input = inputValue.toLowerCase();
      
      // Handle claim submission if the message starts with the claim prefix
      if (input.includes("file a claim for policy #") && input.includes("for $")) {
        // Extract policy ID and amount from message
        const policyMatch = input.match(/policy #(\d+)/i);
        const amountMatch = input.match(/\$(\d+)/);
        
        if (policyMatch && amountMatch && account?.address) {
          const policyId = policyMatch[1];
          const claimAmount = parseInt(amountMatch[1]);
          const claimReason = input.split("for $")[1].split(".")[1]?.trim() || "Medical expenses";
          
          setTransactionInProgress(true);
          
          try {
            // Create claim transaction
            const result = await fileClaim({
              policyId,
              claimantAddress: account.address.toString(),
              claimAmount,
              claimReason
            });
            
            // Parse the transaction payload
            let payload;
            try {
              payload = JSON.parse(result.hash);
            } catch (parseError) {
              console.error("Failed to parse transaction payload:", parseError);
              throw new Error("Invalid transaction payload format");
            }
            
            // Submit the transaction
            const response = await signAndSubmitTransaction({
              sender: account.address,
              data: {
                function: payload.function,
                functionArguments: payload.arguments,
                typeArguments: payload.type_arguments || []
              }
            });
            
            // Add a success message
            const successMessage: Message = {
              id: Date.now().toString(),
              sender: "agent",
              text: `Your claim has been filed successfully! The transaction hash is: ${response.hash}

We'll review your claim and get back to you within 2-3 business days.`,
              timestamp: new Date(),
            };
            
            setMessages([...updatedMessages, successMessage]);
            toast.success("Claim filed successfully!");
            
            setTransactionInProgress(false);
            
            // Skip regular message processing
            setIsTyping(false);
            return;
          } catch (error) {
            console.error("Error filing claim:", error);
            
            // Add an error message
            const errorMessage: Message = {
              id: Date.now().toString(),
              sender: "agent",
              text: `I'm sorry, there was an error filing your claim. Please try again.`,
              timestamp: new Date(),
            };
            
            setMessages([...updatedMessages, errorMessage]);
            toast.error(`Failed to file claim: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsTyping(false);
            setTransactionInProgress(false);
            return;
          }
        }
      }

      // Add a check for policy recommendation requests
      if ((input.includes("recommend") || input.includes("suggest")) && 
          (input.includes("policy") || input.includes("insurance"))) {
        
        if (USE_MOCK_POLICY_RECOMMENDATIONS) {
          // Use mock policy recommendations
          console.log("Using mock policy recommendations instead of backend API");
          
          // Create mock policy recommendations
          const mockPolicies = [
            {
              policy_type: "Term Life",
              coverageAmount: 50000,
              premiumAmount: 500,
              termLength: 1,
              premium: 500
            },
            {
              policy_type: "Whole Life",
              coverageAmount: 100000,
              premiumAmount: 1200,
              termLength: 5,
              premium: 1200
            },
            {
              policy_type: "Universal Life",
              coverageAmount: 200000,
              premiumAmount: 2000,
              termLength: 10,
              premium: 2000
            }
          ];
          
          // Format the recommendation message
          const recommendationText = `Based on your profile, I've generated these policy recommendations for you:
          
1. ${mockPolicies[0].policy_type}: $${mockPolicies[0].coverageAmount.toLocaleString()} coverage, $${mockPolicies[0].premiumAmount}/year
2. ${mockPolicies[1].policy_type}: $${mockPolicies[1].coverageAmount.toLocaleString()} coverage, $${mockPolicies[1].premiumAmount}/year
3. ${mockPolicies[2].policy_type}: $${mockPolicies[2].coverageAmount.toLocaleString()} coverage, $${mockPolicies[2].premiumAmount}/year

Here's my top recommendation:`;
          
          // Create the recommendation with embedded JSON that the UI can parse
          const agentMessage: Message = {
            id: Date.now().toString(),
            sender: "agent",
            text: `${recommendationText}POLICY_RECOMMENDATION${JSON.stringify(mockPolicies[0])}`,
            timestamp: new Date(),
            isPolicyRecommendation: true
          };
          
          setMessages([...updatedMessages, agentMessage]);
          setIsTyping(false);
          
          // Save the message to the session if needed
          if (currentSessionId && user?.uuid) {
            try {
              await addMessage(user.uuid, currentSessionId, {
                id: agentMessage.id,
                sender: agentMessage.sender,
                text: agentMessage.text,
                timestamp: agentMessage.timestamp.toISOString()
              });
            } catch (err) {
              console.error("Error saving recommendation message:", err);
            }
          }
          
          return;
        } else {
          // Use the backend API for policy recommendations
          try {
            if (!user || !currentSessionId) {
              throw new Error("No user or session found");
            }
            
            const userUuid = user.uuid || "";
            
            // Send the message to the backend agent
            console.log("Calling backend API for policy recommendations");
            const response = await sendMessageToAgent(userUuid, inputValue);
            
            // Create the agent response message
            const agentMessage: Message = {
              id: Date.now().toString(),
              sender: "agent",
              text: response.response,
              timestamp: new Date(),
            };
            
            setMessages([...updatedMessages, agentMessage]);
            setIsTyping(false);
            
            // Add the message to the session in the backend
            if (currentSessionId) {
              await addMessage(userUuid, currentSessionId, {
                id: agentMessage.id,
                sender: agentMessage.sender,
                text: agentMessage.text,
                timestamp: agentMessage.timestamp.toISOString(),
              });
            }
            
            return;
          } catch (error) {
            console.error("Error getting recommendation from backend:", error);
            
            const errorMessage: Message = {
              id: Date.now().toString(),
              sender: "agent",
              text: "I'm sorry, I had trouble generating a policy recommendation. Please try again.",
              timestamp: new Date(),
            };
            
            setMessages([...updatedMessages, errorMessage]);
            setIsTyping(false);
            return;
          }
        }
      }

      // Continue with the standard message processing
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Handle creating a new session
  const handleCreateSession = async (userId: string) => {
    try {
      setIsCreatingSession(true);
      const newSession = await createSession(userId);
      handleSessionCreate(newSession.session_id);
    } catch (error) {
      console.error('Error creating new session:', error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Calculate policy statistics when policies change
  useEffect(() => {
    if (policies.length > 0) {
      const stats = {
        totalPolicies: policies.length,
        totalCoverage: policies.reduce((sum, policy) => sum + (policy.coverage_amount || 0), 0),
        totalPremiumPaid: policies.filter(p => p.isPremiumPaid).length * policies[0].premium_amount,
        activePolicies: policies.filter(p => p.status === 'ACTIVE').length,
        totalClaims: 0 // This would need to be fetched from the blockchain
      };
      setPolicyStats(stats);
    }
  }, [policies]);

  // Add these new methods for handling policy recommendations
  
  // Handle policy recommendation from agent
  const handlePolicyRecommendation = (policyData: any) => {
    setRecommendedPolicy(policyData);
    // Add a message to inform the user
    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "agent",
      text: `I've prepared a policy recommendation for you. 
      
Coverage: $${policyData.coverageAmount?.toLocaleString()}
Premium: $${policyData.premiumAmount}/year
Term: ${policyData.termLength || 1} year(s)

Would you like to proceed with this policy?POLICY_RECOMMENDATION${JSON.stringify(policyData)}`,
      timestamp: new Date(),
    };
    
    setMessages([...messages, newMessage]);
  };
  
  // Handle accepting a policy recommendation
  const handleAcceptPolicy = async (policyData: any) => {
    if (!account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    setTransactionInProgress(true);
    try {
      // Add a message indicating acceptance
      const acceptMessage: Message = {
        id: Date.now().toString(),
        sender: "user",
        text: "I'd like to accept this policy recommendation.",
        timestamp: new Date(),
      };
      setMessages([...messages, acceptMessage]);
      
      console.log("Creating policy with data:", policyData);
      
      // Create the policy using the blockchain service
      const result = await createPolicy({
        walletAddress: account.address.toString(),
        coverageAmount: policyData.coverageAmount,
        premiumAmount: policyData.premiumAmount,
        durationDays: (policyData.termLength || 1) * 365
      });
      
      // Parse the transaction payload
      let payload;
      try {
        payload = JSON.parse(result.hash);
        console.log("Policy creation payload:", payload);
      } catch (parseError) {
        console.error("Failed to parse transaction payload:", parseError);
        throw new Error("Invalid transaction payload format");
      }
      
      // Submit the transaction through the wallet
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: payload.function,
          functionArguments: payload.arguments,
          typeArguments: payload.type_arguments || []
        }
      });
      
      console.log("Transaction response:", response);
      
      // Add a waiting message while we fetch the real policy ID
      const waitingMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: `Great! Your policy has been created successfully. The transaction hash is: ${response.hash}

Fetching your policy details...`,
        timestamp: new Date(),
      };
      
      setMessages([...messages, acceptMessage, waitingMessage]);
      toast.success("Policy created! Fetching details...");
      
      // Wait a moment for the blockchain to process the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch the actual policies from the blockchain to get the real policy_id
      console.log("Fetching policies to find the new one...");
      const userPolicies = await getUserPolicies(account.address.toString());
      console.log("Fetched policies after creation:", userPolicies);
      
      if (userPolicies.length === 0) {
        throw new Error("No policies found after creation");
      }
      
      // Sort by creation time to get the most recently created policy
      const sortedPolicies = [...userPolicies].sort((a, b) => 
        parseInt(b.created_at.toString()) - parseInt(a.created_at.toString())
      );
      
      const newPolicy = sortedPolicies[0]; // The most recent policy
      console.log("Using most recent policy:", newPolicy);
      
      if (!newPolicy || !newPolicy.policy_id) {
        throw new Error("Could not find a valid policy ID");
      }
      
      // Use the actual policy ID from the blockchain
      console.log("Found real policy ID from blockchain:", newPolicy.policy_id);
      
      // Update the list of policies
      setPolicies(sortedPolicies);
      
      // Now create the success message with the real policy ID
      const successMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: `I've added your new policy to your account. 

Policy details:
- Policy ID: ${newPolicy.policy_id}
- Coverage: $${newPolicy.coverage_amount.toLocaleString()}
- Premium: $${newPolicy.premium_amount.toLocaleString()}/year
- Term: ${newPolicy.term_length} days

Would you like to pay the premium now to activate your policy?PAY_PREMIUM_PROMPT:${newPolicy.policy_id}`,
        timestamp: new Date(),
      };
      
      // Replace the waiting message with the success message
      const updatedMessages = [...messages, acceptMessage, successMessage];
      setMessages(updatedMessages);
      
    } catch (error) {
      console.error("Error in policy acceptance/creation:", error);
      
      // Add an error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: `I'm sorry, there was an error processing your policy: ${error instanceof Error ? error.message : 'Unknown error'}.

Please try again later or contact support.`,
        timestamp: new Date(),
      };
      
      setMessages([...messages, errorMessage]);
      toast.error(`Policy operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
      setRecommendedPolicy(null);
    }
  };
  
  // Handle rejecting a policy recommendation
  const handleRejectPolicy = () => {
    // Add a rejection message
    const rejectMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: "I'd like to see other options.",
      timestamp: new Date(),
    };
    
    const responseMessage: Message = {
      id: Date.now().toString() + "1",
      sender: "agent",
      text: "No problem. Let me know what changes you'd like to make to the policy, and I can prepare a new recommendation.",
      timestamp: new Date(),
    };
    
    setMessages([...messages, rejectMessage, responseMessage]);
    setRecommendedPolicy(null);
  };
  
  // Handle paying a premium for a policy
  const handlePayPremium = async (policyId: string) => {
    if (!account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    setTransactionInProgress(true);
    try {
      // Convert policy ID to a number
      let numericPolicyId: number;
      
      try {
        // Extract just the numeric part if it contains non-numeric characters
        const match = policyId.match(/\d+/);
        if (match) {
          numericPolicyId = parseInt(match[0], 10);
        } else {
          numericPolicyId = parseInt(policyId, 10);
        }
        
        if (isNaN(numericPolicyId)) {
          throw new Error(`Invalid policy ID format: ${policyId}`);
        }
      } catch (error) {
        console.error("Error parsing policy ID:", error);
        toast.error("Invalid policy ID format");
        return;
      }
      
      console.log("Using numeric policy ID for premium payment:", numericPolicyId);
      
      // Find the matching policy in our list if possible
      const matchingPolicy = policies.find(p => 
        p.policy_id === numericPolicyId.toString() || 
        parseInt(p.policy_id.toString()) === numericPolicyId
      );
      
      // Get premium amount from matching policy or use default
      const premiumAmount = matchingPolicy?.premium_amount || 500;
      console.log("Using premium amount:", premiumAmount, "for policy:", matchingPolicy || "not found");
      
      // Add a message indicating payment intention
      const payMessage: Message = {
        id: Date.now().toString(),
        sender: "user",
        text: `I'd like to pay the premium for policy #${numericPolicyId}.`,
        timestamp: new Date(),
      };
      setMessages([...messages, payMessage]);
      
      console.log("Paying premium for policy ID:", numericPolicyId, "with amount:", premiumAmount);
      
      // Create the payment transaction
      const result = await payPremium({
        policyId: numericPolicyId,
        amount: premiumAmount
      });
      
      // Parse the transaction payload
      let payload;
      try {
        payload = JSON.parse(result.hash);
        console.log("Premium payment payload:", payload);
      } catch (parseError) {
        console.error("Failed to parse transaction payload:", parseError);
        throw new Error("Invalid transaction payload format");
      }
      
      // Submit the transaction through the wallet
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: payload.function,
          functionArguments: payload.arguments,
          typeArguments: payload.type_arguments || []
        }
      });
      
      console.log("Premium payment transaction response:", response);
      
      // Add a success message
      const successMessage: Message = {
        id: Date.now().toString(),
        sender: "agent",
        text: `Great! Your premium payment for policy #${numericPolicyId} was successful.

Transaction hash: ${response.hash}

Your policy is now active and your coverage is in effect.`,
        timestamp: new Date(),
      };
      
      setMessages([...messages, payMessage, successMessage]);
      toast.success("Premium payment successful!");
      
      // Wait a moment for the blockchain to process the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh policies to update status
      console.log("Refreshing policies after premium payment");
      const updatedPolicies = await getUserPolicies(account.address.toString());
      setPolicies(updatedPolicies);
      
    } catch (error) {
      console.error("Error paying premium:", error);
      
      // Add an error message
      const errorMessage: Message = {
        id: Date.now().toString() + "1",
        sender: "agent",
        text: `I'm sorry, there was an error processing your premium payment. Please try again.`,
        timestamp: new Date(),
      };
      
      setMessages([...messages, errorMessage]);
      toast.error(`Failed to pay premium: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };
  
  // Handle filing a claim
  const handleFileClaim = async (policyId: string) => {
    if (!account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }
    
    // Show a prompt for entering claim details
    const claimMessage: Message = {
      id: Date.now().toString(),
      sender: "agent",
      text: `Please tell me more about your claim for policy #${policyId}. What happened and what amount are you claiming?`,
      timestamp: new Date(),
    };
    
    setMessages([...messages, claimMessage]);
    
    // Store the policy ID for when the user responds
    setInputValue(`I'd like to file a claim for policy #${policyId} for $`);
    
    // Note: The actual claim submission will happen when the user responds with details
    // That would need to be handled in the sendMessage function
  };

  if (loading && !dashboardReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-[#0d1117] to-[#161b22] text-cora-light pt-16">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cora-primary via-cora-secondary to-cora-light flex items-center justify-center shadow-lg mb-6 animate-pulse">
            <span className="text-[#0d1117] font-bold text-3xl">C</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Loading your dashboard</h1>
          <div className="flex space-x-2 mt-4">
            <div className="w-3 h-3 rounded-full bg-cora-primary animate-bounce"></div>
            <div className="w-3 h-3 rounded-full bg-cora-primary animate-bounce delay-100"></div>
            <div className="w-3 h-3 rounded-full bg-cora-primary animate-bounce delay-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-[#0d1117] to-[#161b22] text-cora-light pt-16">
        <div className="text-center max-w-md mx-auto p-8 backdrop-blur-xl bg-black/40 rounded-2xl border border-white/10 shadow-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-medium mb-4">Dashboard Error</h2>
          <p className="mb-6 text-cora-gray">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-cora-primary to-cora-secondary text-cora-light rounded-xl hover:opacity-90 transition-all shadow-lg shadow-cora-primary/20 transform hover:scale-105"
            title="Reload dashboard"
            aria-label="Reload dashboard"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col md:flex-row w-full h-screen bg-gradient-to-b from-[#0d1117] to-[#161b22] text-cora-light transition-opacity duration-500 pt-16 ${dashboardReady ? 'opacity-100' : 'opacity-0'}`}>
      <Toaster position="top-right" />
      <div className="md:w-64 lg:w-72 p-2 hidden md:block overflow-hidden">
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sessionIds={userSessions}
          currentSessionId={currentSessionId}
          onSessionChange={handleSessionChange}
          onSessionCreate={handleCreateSession}
          isCreatingSession={isCreatingSession}
          userId={user?.uuid || ""}
        />
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/60 backdrop-blur-md border-t border-white/10 md:hidden">
        <div className="flex justify-around py-3">
          <button 
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center px-5 py-2 rounded-xl transition-all ${
              activeTab === "chat" 
                ? "text-cora-primary" 
                : "text-cora-gray"
            }`}
            title="Chat with Cora"
            aria-label="Chat with Cora"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <span className="text-xs mt-1">Chat</span>
          </button>
          <button 
            onClick={() => setActiveTab("policies")}
            className={`flex flex-col items-center px-5 py-2 rounded-xl transition-all ${
              activeTab === "policies" 
                ? "text-cora-primary" 
                : "text-cora-gray"
            }`}
            title="My Policies"
            aria-label="My Policies"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
              <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <span className="text-xs mt-1">Policies</span>
          </button>
          <button 
            onClick={() => setActiveTab("claims")}
            className={`flex flex-col items-center px-5 py-2 rounded-xl transition-all ${
              activeTab === "claims" 
                ? "text-cora-primary" 
                : "text-cora-gray"
            }`}
            title="File a Claim"
            aria-label="File a Claim"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
            </svg>
            <span className="text-xs mt-1">Claims</span>
          </button>
          <button 
            className="flex flex-col items-center px-5 py-2 text-cora-gray"
            title="View Profile"
            aria-label="View Profile"
          >
            <div className="h-6 w-6 rounded-full bg-cora-primary flex items-center justify-center">
              <span className="text-xs font-bold text-black">
                {user?.name?.charAt(0) || "C"}
              </span>
            </div>
            <span className="text-xs mt-1">Profile</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-2 md:p-4 overflow-y-auto pb-20 md:pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cora-primary"></div>
          </div>
        ) : (
          <>
            {activeTab === "chat" && (
              <div className="max-w-4xl mx-auto h-full transform transition-all duration-300 opacity-100 scale-100">
                <div className="h-full">
                  <ChatTab 
                    messages={messages}
                    isTyping={isTyping}
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    handleSendMessage={sendMessage}
                    handleKeyPress={handleKeyPress}
                    handleAcceptPolicy={handleAcceptPolicy}
                    handleRejectPolicy={handleRejectPolicy}
                    handlePayPremium={handlePayPremium}
                    handleFileClaim={handleFileClaim}
                  />
                </div>
              </div>
            )}
            
            {activeTab === "policies" && (
              <div className="max-w-4xl mx-auto transform transition-all duration-300 opacity-100 scale-100">
                <PoliciesTab userId={user?.uuid || ""} />
              </div>
            )}
            
            {activeTab === "claims" && (
              <div className="max-w-4xl mx-auto transform transition-all duration-300 opacity-100 scale-100">
                <ClaimsTab userId={user?.uuid || ""} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}