import { Message } from "./types";
import { useRef, useEffect } from "react";
import { Policy } from "../../view-functions/policyService";
import { toast } from "react-hot-toast";

type ChatTabProps = {
  messages: Message[];
  isTyping: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSendMessage: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
  handleAcceptPolicy?: (policy: any) => void;
  handleRejectPolicy?: () => void;
  handlePayPremium?: (policyId: string) => void;
  handleFileClaim?: (policyId: string) => void;
};

export function ChatTab({
  messages,
  isTyping,
  inputValue,
  setInputValue,
  handleSendMessage,
  handleKeyPress,
  handleAcceptPolicy,
  handleRejectPolicy,
  handlePayPremium,
  handleFileClaim
}: ChatTabProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change or typing status changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);
  
  // Function to scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Check if a message contains a policy recommendation
  const hasPolicyRecommendation = (text: string) => {
    // Check for both frontend and backend formats
    return (text.includes("POLICY_RECOMMENDATION") && text.includes("coverageAmount") && text.includes("premiumAmount")) || 
           (text.includes("policy_type") && text.includes("coverage_amount") && text.includes("term_length"));
  };

  // Extract policy data from message text
  const extractPolicyData = (text: string) => {
    try {
      // First check for frontend format
      if (text.includes("POLICY_RECOMMENDATION")) {
        const policyJson = text.substring(
          text.indexOf("POLICY_RECOMMENDATION") + "POLICY_RECOMMENDATION".length
        );
        return JSON.parse(policyJson);
      }
      
      // Check for backend format (JSON enclosed in curly braces)
      const jsonMatch = text.match(/\{[\s\S]*"policy_type"[\s\S]*"coverage_amount"[\s\S]*"term_length"[\s\S]*\}/);
      if (jsonMatch) {
        const policyJson = jsonMatch[0];
        const parsedPolicy = JSON.parse(policyJson);
        
        // Convert backend format to frontend format
        return {
          coverageAmount: parsedPolicy.coverage_amount,
          premiumAmount: parsedPolicy.premium_amount || parsedPolicy.premium || 0,
          termLength: parsedPolicy.term_length
        };
      }
      
      return null;
    } catch (e) {
      console.error("Failed to parse policy data:", e);
      return null;
    }
  };
  
  // Format policy details for display
  const formatPolicyDetails = (policy: any) => {
    return (
      <div className="bg-black/40 p-3 rounded-md mt-2 border border-cora-primary/30">
        <div className="text-sm font-semibold text-cora-primary mb-1">Policy Details</div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <div>Coverage Amount:</div>
          <div>${policy.coverageAmount?.toLocaleString()}</div>
          <div>Premium Amount:</div>
          <div>${policy.premiumAmount?.toLocaleString()}/year</div>
          <div>Term Length:</div>
          <div>{policy.termLength || 1} year(s)</div>
        </div>
      </div>
    );
  };

  // Helper function to render message content with formatting
  const renderMessageContent = (message: Message) => {
    // Check if this message contains a policy recommendation
    if (message.sender === "agent" && hasPolicyRecommendation(message.text)) {
      const policyData = extractPolicyData(message.text);
      const cleanText = message.text.substring(0, message.text.indexOf("POLICY_RECOMMENDATION"));
      
      if (policyData) {
        return (
          <>
            <p className="text-sm whitespace-pre-wrap">{cleanText}</p>
            
            {formatPolicyDetails(policyData)}
            
            <div className="flex space-x-2 mt-3">
              <button 
                onClick={() => handleAcceptPolicy && handleAcceptPolicy(policyData)}
                className="bg-cora-primary text-white px-3 py-1 text-xs rounded-full  transition-colors"
              >
                Accept Policy
              </button>
              <button 
                onClick={() => handleRejectPolicy && handleRejectPolicy()}
                className="bg-black/30 text-white/80 px-3 py-1 text-xs rounded-full hover:bg-black/50 transition-colors"
              >
                Reject
              </button>
            </div>
          </>
        );
      }
    }
    
    // Check if this message contains a prompt to pay premium
    if (message.sender === "agent" && message.text.includes("PAY_PREMIUM_PROMPT:")) {
      const parts = message.text.split("PAY_PREMIUM_PROMPT:");
      let policyId = parts[1]?.trim();
      
      console.log("Raw policy ID from message:", policyId);
      
      // Extract any numeric part from the policy ID or generate a new one
      let numericPolicyId;
      if (policyId) {
        // Extract just the numeric part 
        const match = policyId.match(/\d+/);
        if (match) {
          numericPolicyId = parseInt(match[0], 10);
          console.log("Extracted numeric policy ID:", numericPolicyId);
        } else if (policyId.startsWith("0x")) {
          // Don't use wallet addresses as policy IDs
          console.error("Cannot use wallet address as policy ID");
          toast.error("Invalid policy ID format");
          return (
            <p className="text-sm whitespace-pre-wrap">{parts[0]} <span className="text-red-400">(Error: Invalid policy ID)</span></p>
          );
        } else {
          // Try to convert directly to a number
          numericPolicyId = parseInt(policyId, 10);
          
          // Final validation check - if we can't convert to number, show error
          if (isNaN(numericPolicyId)) {
            console.error("Invalid policy ID - not a number:", policyId);
            toast.error("Invalid policy ID format");
            return (
              <p className="text-sm whitespace-pre-wrap">{parts[0]} <span className="text-red-400">(Error: Invalid policy ID)</span></p>
            );
          }
        }
      } else {
        // No policy ID found - show error
        console.error("No policy ID found in message");
        toast.error("No policy ID found");
        return (
          <p className="text-sm whitespace-pre-wrap">{parts[0]} <span className="text-red-400">(Error: No policy ID found)</span></p>
        );
      }
      
      console.log("Final numeric policy ID to be used:", numericPolicyId);
      
      return (
        <>
          <p className="text-sm whitespace-pre-wrap">{parts[0]}</p>
          
          <div className="mt-3">
            <button 
              onClick={() => {
                console.log("Pay Premium button clicked with policy ID:", numericPolicyId);
                handlePayPremium && handlePayPremium(numericPolicyId.toString());
              }}
              className="bg-blue-500 text-white px-3 py-1 text-xs rounded-full hover:bg-blue-600 transition-colors"
            >
              Pay Premium
            </button>
          </div>
        </>
      );
    }
    
    // Check if this message contains a prompt to file a claim
    if (message.sender === "agent" && message.text.includes("FILE_CLAIM_PROMPT:")) {
      const parts = message.text.split("FILE_CLAIM_PROMPT:");
      const policyId = parts[1]?.trim();
      
      return (
        <>
          <p className="text-sm whitespace-pre-wrap">{parts[0]}</p>
          
          {policyId && (
            <div className="mt-3">
              <button 
                onClick={() => handleFileClaim && handleFileClaim(policyId)}
                className="bg-amber-500 text-white px-3 py-1 text-xs rounded-full hover:bg-amber-600 transition-colors"
              >
                File Claim
              </button>
            </div>
          )}
        </>
      );
    }
    
    // Default rendering for regular messages
    return (
      <p className="text-sm whitespace-pre-wrap">{message.text}</p>
    );
  };

  return (
    <div className="h-full flex flex-col rounded-2xl overflow-hidden backdrop-blur-xl bg-black/40 border border-white/15 shadow-2xl">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
        {messages.map((message, index) => (
          <div
            key={`${message.id}-${index}`}
            className={`flex ${
              message.sender === "agent"
                ? "justify-start"
                : "justify-end"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-xl p-3 ${
                message.sender === "agent"
                  ? "bg-black/60 border border-white/10 text-white rounded-tl-sm"
                  : "bg-cora-primary text-white rounded-tr-sm"
              }`}
            >
              {message.sender === "agent" && (
                <div className="flex items-center mb-1">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cora-primary via-cora-secondary to-cora-light flex items-center justify-center mr-2">
                    <span className="text-cora-dark font-bold text-[10px]">C</span>
                  </div>
                  <p className="text-xs font-medium">Cora</p>
                </div>
              )}
              {renderMessageContent(message)}
              <p className="text-[10px] text-right mt-1 opacity-70">
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-xl p-4 bg-black/60 border border-white/10 text-white rounded-tl-sm">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-cora-primary animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-cora-primary animate-pulse delay-150"></div>
                <div className="w-2 h-2 rounded-full bg-cora-primary animate-pulse delay-300"></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Invisible div at the bottom for scrolling to */}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex rounded-xl overflow-hidden bg-black/40 border border-white/10">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask Cora about insurance..."
            className="flex-1 bg-transparent text-white placeholder-white/30 p-3 outline-none resize-none max-h-32"
            rows={1}
            aria-label="Message input"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className={`px-4 flex items-center justify-center ${
              inputValue.trim()
                ? "text-cora-primary hover:text-white"
                : "text-white/20"
            }`}
            title="Send message"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-xs text-cora-gray">
            Cora is an AI assistant and may occasionally provide incorrect information.
          </p>
        </div>
      </div>
    </div>
  );
} 