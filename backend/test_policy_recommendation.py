"""
Test script for the policy recommendation agent with predefined policies.
"""

from utils.useLLM import UseLLM
from agents.risk_assesment_agent import RiskAssessmentAgent
from agents.premium_calculation_agent import PremiumCalculationAgent
from agents.policy_recommendation_agent import PolicyRecommendationAgent, AVAILABLE_POLICIES
import json

def main():
    # Initialize the agents
    print("Initializing agents...")
    llm = UseLLM()
    risk_agent = RiskAssessmentAgent(llm)
    premium_agent = PremiumCalculationAgent(llm)
    policy_agent = PolicyRecommendationAgent(llm, risk_agent, premium_agent)
    
    # Print available policies
    print("\nAvailable Policies:")
    for i, policy in enumerate(AVAILABLE_POLICIES, 1):
        print(f"{i}. {policy['name']} - {policy.get('type', 'Unknown')} - {policy.get('premium', 'Unknown')}")
    
    # Test case 1: Young non-smoker
    print("\n\nTest Case 1: Young non-smoker")
    user_info_1 = {
        'name': 'John Doe',
        'age': 28,
        'gender': 'Male',
        'smoking': 'no',
        'health': 'No significant health issues',
        'income': '₹15,00,000 - ₹25,00,000',
        'occupation': 'Salaried'
    }
    policy_details_1 = {
        'policy_type': 'Life',
        'coverage_amount': 500000
    }
    
    print("User Info:", json.dumps(user_info_1, indent=2))
    print("Policy Details:", json.dumps(policy_details_1, indent=2))
    
    result_1 = policy_agent.invoke(user_info_1, policy_details_1)
    
    print("\nRecommendation Result:")
    print(f"Recommended Policy: {result_1['policy_recommendation']['recommended_policy']['name']}")
    print(f"Policy Type: {result_1['policy_recommendation']['recommended_policy'].get('policy_type', 'Not specified')}")
    print(f"Coverage: {result_1['policy_recommendation']['recommended_policy'].get('coverage_amount', 'Not specified')}")
    print(f"Term: {result_1['policy_recommendation']['recommended_policy'].get('term_length', 'Not specified')}")
    print(f"Premium: {result_1['policy_recommendation']['recommended_policy'].get('premium', 'Not specified')}")
    
    print("\nAlternative Policies:")
    for alt in result_1['policy_recommendation'].get('alternative_policies', []):
        print(f"- {alt.get('name', 'Not specified')}: {alt.get('coverage_amount', 'Not specified')} for {alt.get('term_length', 'Not specified')} at {alt.get('premium', 'Not specified')}")
    
    print("\nExplanation:")
    print(result_1['policy_recommendation'].get('explanation', 'No explanation provided.'))
    
    # Test case 2: Older smoker with health issues
    print("\n\nTest Case 2: Older smoker with health issues")
    user_info_2 = {
        'name': 'Jane Smith',
        'age': 45,
        'gender': 'Female',
        'smoking': 'yes',
        'health': 'Has pre-existing conditions, family history of heart disease',
        'income': '₹25,00,000+',
        'occupation': 'Business Owner'
    }
    policy_details_2 = {
        'policy_type': 'Life',
        'coverage_amount': 200000
    }
    
    print("User Info:", json.dumps(user_info_2, indent=2))
    print("Policy Details:", json.dumps(policy_details_2, indent=2))
    
    result_2 = policy_agent.invoke(user_info_2, policy_details_2)
    
    print("\nRecommendation Result:")
    print(f"Recommended Policy: {result_2['policy_recommendation']['recommended_policy']['name']}")
    print(f"Policy Type: {result_2['policy_recommendation']['recommended_policy'].get('policy_type', 'Not specified')}")
    print(f"Coverage: {result_2['policy_recommendation']['recommended_policy'].get('coverage_amount', 'Not specified')}")
    print(f"Term: {result_2['policy_recommendation']['recommended_policy'].get('term_length', 'Not specified')}")
    print(f"Premium: {result_2['policy_recommendation']['recommended_policy'].get('premium', 'Not specified')}")
    
    print("\nAlternative Policies:")
    for alt in result_2['policy_recommendation'].get('alternative_policies', []):
        print(f"- {alt.get('name', 'Not specified')}: {alt.get('coverage_amount', 'Not specified')} for {alt.get('term_length', 'Not specified')} at {alt.get('premium', 'Not specified')}")
    
    print("\nExplanation:")
    print(result_2['policy_recommendation'].get('explanation', 'No explanation provided.'))
    
    # Test case 3: Middle-aged person interested in health insurance
    print("\n\nTest Case 3: Middle-aged person interested in health insurance")
    user_info_3 = {
        'name': 'Alex Johnson',
        'age': 40,
        'gender': 'Other',
        'smoking': 'no',
        'health': 'No significant health issues',
        'income': '₹10,00,000 - ₹15,00,000',
        'occupation': 'Freelancer'
    }
    policy_details_3 = {
        'policy_type': 'Health',
        'coverage_amount': 30000
    }
    
    print("User Info:", json.dumps(user_info_3, indent=2))
    print("Policy Details:", json.dumps(policy_details_3, indent=2))
    
    result_3 = policy_agent.invoke(user_info_3, policy_details_3)
    
    print("\nRecommendation Result:")
    print(f"Recommended Policy: {result_3['policy_recommendation']['recommended_policy']['name']}")
    print(f"Policy Type: {result_3['policy_recommendation']['recommended_policy'].get('policy_type', 'Not specified')}")
    print(f"Coverage: {result_3['policy_recommendation']['recommended_policy'].get('coverage_amount', 'Not specified')}")
    print(f"Term: {result_3['policy_recommendation']['recommended_policy'].get('term_length', 'Not specified')}")
    print(f"Premium: {result_3['policy_recommendation']['recommended_policy'].get('premium', 'Not specified')}")
    
    print("\nAlternative Policies:")
    for alt in result_3['policy_recommendation'].get('alternative_policies', []):
        print(f"- {alt.get('name', 'Not specified')}: {alt.get('coverage_amount', 'Not specified')} for {alt.get('term_length', 'Not specified')} at {alt.get('premium', 'Not specified')}")
    
    print("\nExplanation:")
    print(result_3['policy_recommendation'].get('explanation', 'No explanation provided.'))

if __name__ == "__main__":
    main() 