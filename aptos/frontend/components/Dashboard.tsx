import { useState } from "react";
import { Message, PolicyCard } from "./dashboard/types";
import { Sidebar } from "./dashboard/Sidebar";
import { ChatTab } from "./dashboard/ChatTab";
import { PoliciesTab } from "./dashboard/PoliciesTab";
import { ClaimsTab } from "./dashboard/ClaimsTab";

export function Dashboard() {
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
  const [policies, setPolicies] = useState<PolicyCard[]>([
    {
      id: "policy-1",
      name: "Term Life Insurance",
      coverage: "₹50,00,000",
      premium: "₹12,500/year",
      status: "Active",
    }
  ]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response after a delay
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputValue);
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
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