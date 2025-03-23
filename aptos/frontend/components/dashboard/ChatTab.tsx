import { Message } from "./types";
import { useRef, useEffect } from "react";

type ChatTabProps = {
  messages: Message[];
  isTyping: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSendMessage: () => void;
  handleKeyPress: (e: React.KeyboardEvent) => void;
};

export function ChatTab({
  messages,
  isTyping,
  inputValue,
  setInputValue,
  handleSendMessage,
  handleKeyPress
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

  // Helper function to render message content with formatting
  const renderMessageContent = (text: string) => {
    return text;
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
                  : "bg-gradient-to-r from-cora-primary to-cora-secondary text-white rounded-tr-sm"
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
              <p className="text-sm whitespace-pre-wrap">{renderMessageContent(message.text)}</p>
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