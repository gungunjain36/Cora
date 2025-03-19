"""
Test script for the communication agent with predefined user details.
"""

from utils.useLLM import UseLLM
from agents.communication_agent import CommunicationAgent

def main():
    # Initialize the agents
    print("Initializing agents...")
    llm = UseLLM()
    communication_agent = CommunicationAgent(llm)
    
    # Test case 1: User with complete details requesting a recommendation
    print("\n\nTest Case 1: User with complete details requesting a recommendation")
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
        user_id="test_user_1",
        user_details=user_details
    )
    
    print("\nInitial Response:")
    print(response["response"])
    print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Second message to request a recommendation
    print("\nRequesting recommendation...")
    response = communication_agent.invoke(
        message="Okay now suggest me a proper plan which I should go with.",
        user_id="test_user_1"
    )
    
    print("\nRecommendation Response:")
    print(response["response"])
    print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Test case 2: User with partial details
    print("\n\nTest Case 2: User with partial details")
    partial_user_details = {
        "name": "Priya Patel",
        "age": 30,
        "gender": "Female",
        "email": "priya.patel@example.com",
        "occupation": "Self-employed"
    }
    
    # First message to initialize the conversation
    print("Initializing conversation with partial user details...")
    response = communication_agent.invoke(
        message="Hi, I'm looking for insurance options.",
        user_id="test_user_2",
        user_details=partial_user_details
    )
    
    print("\nInitial Response:")
    print(response["response"])
    print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Second message to provide more information
    print("\nProviding more information...")
    response = communication_agent.invoke(
        message="I don't smoke, and I have no health issues. I'm looking for a term life policy with about 30 lakh coverage.",
        user_id="test_user_2"
    )
    
    print("\nFollow-up Response:")
    print(response["response"])
    print(f"Conversation Stage: {response['conversation_stage']}")
    
    # Third message to request a recommendation
    print("\nRequesting recommendation...")
    response = communication_agent.invoke(
        message="Please suggest a suitable plan for me.",
        user_id="test_user_2"
    )
    
    print("\nRecommendation Response:")
    print(response["response"])
    print(f"Conversation Stage: {response['conversation_stage']}")

if __name__ == "__main__":
    main() 