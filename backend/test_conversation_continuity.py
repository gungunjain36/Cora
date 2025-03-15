"""
Test script to verify that the communication agent maintains a continuous conversation with the client.
"""

from utils.useLLM import UseLLM
from agents.communication_agent import CommunicationAgent

def main():
    # Initialize the agents
    print("Initializing agents...")
    llm = UseLLM()
    communication_agent = CommunicationAgent(llm)
    
    # User details
    user_details = {
        "name": "Rahul Mehta",
        "age": 32,
        "gender": "Male",
        "email": "rahul.mehta@example.com",
        "phone": "+91 98765 12345",
        "smoker": "No",
        "preExistingConditions": "No",
        "familyHistory": "No",
        "occupation": "Software Engineer",
        "income": "₹15,00,000 - ₹20,00,000"
    }
    
    # Simulate a conversation
    conversation = [
        "Hi, I'm looking for a life insurance policy.",
        "I'm 32 years old and I don't smoke.",
        "I work as a software engineer and earn about 18 lakhs per year.",
        "I'm looking for a term life policy with good coverage.",
        "What would you recommend for someone like me?",
        "How much would the premium be?",
        "What's the difference between term life and whole life insurance?",
        "I think I prefer term life. Can you suggest a specific plan?",
        "That sounds good. What's the process to apply for this policy?",
        "Thank you for your help!"
    ]
    
    # First message to initialize the conversation
    print("\n--- Starting conversation ---")
    print(f"User: {conversation[0]}")
    response = communication_agent.invoke(
        message=conversation[0],
        user_id="test_conversation",
        user_details=user_details
    )
    
    print(f"Assistant: {response['response']}")
    print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Continue the conversation
    for i, message in enumerate(conversation[1:], 1):
        print(f"\nUser: {message}")
        response = communication_agent.invoke(
            message=message,
            user_id="test_conversation"
        )
        
        print(f"Assistant: {response['response']}")
        print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Print the final user info and policy details
    print("\n--- Final User Info ---")
    print(communication_agent.conversation_history["test_conversation"]["user_info"])
    
    print("\n--- Final Policy Details ---")
    print(communication_agent.conversation_history["test_conversation"]["policy_details"])
    
    print("\n--- Recommendation Result ---")
    if communication_agent.conversation_history["test_conversation"]["recommendation_result"]:
        print("Recommendation was generated successfully!")
        print(f"Recommended Policy: {communication_agent.conversation_history['test_conversation']['recommendation_result']['policy_recommendation']['recommended_policy'].get('name', 'Not specified')}")
    else:
        print("No recommendation was generated.")

if __name__ == "__main__":
    main() 