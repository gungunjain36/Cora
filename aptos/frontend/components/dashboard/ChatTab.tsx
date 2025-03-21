import { useRef, useEffect, useState } from "react";

type Message = {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: Date;
};

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
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Auto-scroll to bottom when messages change or when typing
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Add scroll event listener
  useEffect(() => {
    const messageContainer = document.getElementById('message-container');
    if (!messageContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = messageContainer;
      // Show button if not scrolled to bottom (with a small threshold)
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };

    messageContainer.addEventListener('scroll', handleScroll);
    return () => messageContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  // Function to render links in messages
  const renderMessageContent = (text: string) => {
    // URL pattern match
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      // Check if this part is a URL
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cora-light-green underline hover:text-cora-primary transition-colors duration-200"
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="backdrop-blur-xl bg-black/30 rounded-2xl border border-white/10 shadow-xl h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cora-primary to-cora-secondary flex items-center justify-center">
          <span className="text-cora-light font-bold">C</span>
        </div>
        <div className="ml-3">
          <h2 className="font-medium text-cora-light">Cora Assistant</h2>
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            <p className="text-xs text-cora-gray">AI Insurance Agent • Always Online</p>
          </div>
        </div>
      </div>
      
      <div 
        id="message-container"
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.sender === "agent" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cora-primary to-cora-secondary flex items-center justify-center mr-3 mt-1">
                <span className="text-cora-light font-bold text-xs">C</span>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl p-4 shadow-lg ${
                message.sender === "user"
                  ? "bg-gradient-to-r from-cora-primary to-cora-secondary text-cora-light"
                  : "bg-white/5 backdrop-blur-sm border border-white/10 text-cora-light"
              }`}
            >
              <p className="leading-relaxed">{renderMessageContent(message.text)}</p>
              <div className="text-xs opacity-70 mt-2 text-right">
                {message.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            {message.sender === "user" && (
              <div className="w-8 h-8 rounded-full bg-cora-gray flex items-center justify-center ml-3 mt-1">
                <span className="text-cora-light font-bold text-xs">You</span>
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cora-primary to-cora-secondary flex items-center justify-center mr-3 mt-1">
              <span className="text-cora-light font-bold text-xs">C</span>
            </div>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-cora-primary rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-cora-primary rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-cora-primary rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          className="absolute bottom-24 right-6 p-2 rounded-full bg-cora-primary text-white shadow-lg"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center bg-white/5 backdrop-blur-sm rounded-xl p-2 border border-white/10 transition-all duration-300 focus-within:border-cora-primary focus-within:shadow-[0_0_15px_rgba(60,179,113,0.3)]">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 text-cora-light placeholder-cora-gray"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            aria-label="Send message"
            className={`relative overflow-hidden ml-2 p-3 rounded-xl transition-all duration-200 ${
              !inputValue.trim()
                ? "bg-cora-dark text-cora-gray cursor-not-allowed"
                : "bg-gradient-to-r from-cora-primary to-cora-secondary text-cora-light"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-cora-gray mt-2 text-center">
          Cora is an AI assistant and may occasionally provide incorrect information.
        </p>
      </div>
    </div>
  );
} 