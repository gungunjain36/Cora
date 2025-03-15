"""
Test script to verify that our imports work correctly.
"""

def test_imports():
    """Test that all imports work correctly."""
    try:
        # Import the LLM utility
        from  utils.useLLM import UseLLM
        print("✅ Successfully imported UseLLM")
        
        # Import the agents
        from  agents.risk_assesment_agent import RiskAssessmentAgent
        print("✅ Successfully imported RiskAssessmentAgent")
        
        from  agents.premium_calculation_agent import PremiumCalculationAgent
        print("✅ Successfully imported PremiumCalculationAgent")
        
        from  agents.policy_recommendation_agent import PolicyRecommendationAgent
        print("✅ Successfully imported PolicyRecommendationAgent")
        
        from  agents.communication_agent import CommunicationAgent
        print("✅ Successfully imported CommunicationAgent")
        
        # Import the routes
        from  routes.agent_routes import router
        print("✅ Successfully imported agent_routes")
        
        print("\nAll imports successful! The project structure is correct.")
        return True
    except ImportError as e:
        print(f"❌ Import error: {str(e)}")
        return False

if __name__ == "__main__":
    test_imports() 