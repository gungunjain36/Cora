"""
Test script to demonstrate how to use the multi-agent system.
This script shows how to interact with the communication agent directly.
"""

import os
import json
from dotenv import load_dotenv
from  utils.useLLM import UseLLM
from  agents.communication_agent import CommunicationAgent

# Load environment variables from .env file
load_dotenv()

def main():
    """
    Main function to test the multi-agent system.
    """
    # Check if API key is set
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set.")
        print("Please set it in a .env file or export it in your environment.")
        return
    
    # Initialize the LLM utility
    llm_utility = UseLLM(
        model_name="gpt-4o",
        temperature=0.7,
        api_key=api_key
    )
    
    # Initialize the communication agent
    communication_agent = CommunicationAgent(llm_utility)
    
    # User ID for this conversation
    user_id = "test_user_1"
    
    # Start the conversation
    print("\n=== Starting conversation with the insurance agent ===\n")
    
    # Initial message
    message = "Hello, I'm interested in getting life insurance."
    print(f"User: {message}")
    
    # Get response from the agent
    response = communication_agent.invoke(message, user_id)
    print(f"Agent: {response['response']}")
    print(f"Conversation stage: {response['conversation_stage']}")
    
    # Continue the conversation with user information
    message = "I'm 35 years old, male, and I don't smoke. I have no major health conditions."
    print(f"\nUser: {message}")
    
    # Get response from the agent
    response = communication_agent.invoke(message, user_id)
    print(f"Agent: {response['response']}")
    print(f"Conversation stage: {response['conversation_stage']}")
    
    # Continue with policy preferences
    message = "I'm interested in a term life policy with $500,000 coverage for 20 years."
    print(f"\nUser: {message}")
    
    # Get response from the agent
    response = communication_agent.invoke(message, user_id)
    print(f"Agent: {response['response']}")
    print(f"Conversation stage: {response['conversation_stage']}")
    
    # Ask a follow-up question
    message = "What riders do you recommend for my policy?"
    print(f"\nUser: {message}")
    
    # Get response from the agent
    response = communication_agent.invoke(message, user_id)
    print(f"Agent: {response['response']}")
    print(f"Conversation stage: {response['conversation_stage']}")
    
    # End the conversation
    message = "Thank you for your help. I'll think about it and get back to you."
    print(f"\nUser: {message}")
    
    # Get response from the agent
    response = communication_agent.invoke(message, user_id)
    print(f"Agent: {response['response']}")
    print(f"Conversation stage: {response['conversation_stage']}")
    
    # Get conversation history
    print("\n=== Conversation History ===\n")
    history = communication_agent.get_conversation_history(user_id)
    for i, msg in enumerate(history):
        role = "User" if msg["role"] == "user" else "Agent"
        print(f"{i+1}. {role}: {msg['content'][:100]}...")

if __name__ == "__main__":
    main() 