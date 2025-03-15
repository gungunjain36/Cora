"""
Simple test script to verify specific imports.
"""

try:
    from agents.premium_calculation_agent import PremiumCalculationAgent
    print("✅ Successfully imported PremiumCalculationAgent")
except ImportError as e:
    print(f"❌ Import error for PremiumCalculationAgent: {str(e)}")

try:
    from agents.policy_recommendation_agent import PolicyRecommendationAgent
    print("✅ Successfully imported PolicyRecommendationAgent")
except ImportError as e:
    print(f"❌ Import error for PolicyRecommendationAgent: {str(e)}") 