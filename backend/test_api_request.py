"""
Test script to simulate the exact API request from the user's curl command.
"""

from utils.useLLM import UseLLM
from agents.communication_agent import CommunicationAgent

def main():
    # Initialize the agents
    print("Initializing agents...")
    llm = UseLLM()
    communication_agent = CommunicationAgent(llm)
    
    # User details from the curl command
    user_details = {
        "name": "Amit Sharma",
        "age": 35,
        "gender": "Male",
        "email": "amit.sharma@example.com",
        "phone": "+91 98765 43210",
        "maritalStatus": "Married",
        "height": 175,
        "weight": 70,
        "smoker": "No",
        "alcoholConsumption": "Occasional",
        "preExistingConditions": "No",
        "familyHistory": "No",
        "occupation": "Salaried",
        "riskyHobbies": "No",
        "exerciseFrequency": "3-4 times/week",
        "income": "₹10,00,000 - ₹15,00,000",
        "coverageAmount": "₹50,00,000",
        "policyTerm": "20",
        "paymentFrequency": "Annually",
        "riders": "Critical Illness Cover"
    }
    
    # First message to initialize the conversation
    print("Initializing conversation with user details...")
    response = communication_agent.invoke(
        message="Hello, I need a life insurance policy.",
        user_id="2",
        user_details=user_details
    )
    
    print("\nInitial Response:")
    print(response["response"])
    print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Second message to request a recommendation (exact message from the curl command)
    print("\nRequesting recommendation with exact message from curl command...")
    response = communication_agent.invoke(
        message="Okay now suggest me a proper plan which I should go with.",
        user_id="2"
    )
    
    print("\nRecommendation Response:")
    print(response["response"])
    print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Print the user info and policy details to verify they were properly extracted
    print("\nUser Info:")
    print(communication_agent.conversation_history["2"]["user_info"])
    
    print("\nPolicy Details:")
    print(communication_agent.conversation_history["2"]["policy_details"])
    
    print("\nRecommendation Result:")
    if communication_agent.conversation_history["2"]["recommendation_result"]:
        print("Recommendation was generated successfully!")
        print(f"Recommended Policy: {communication_agent.conversation_history['2']['recommendation_result']['policy_recommendation']['recommended_policy'].get('name', 'Not specified')}")
    else:
        print("No recommendation was generated.")

if __name__ == "__main__":
    main() 