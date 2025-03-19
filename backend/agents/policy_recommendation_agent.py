# Policy recommendation agent 
# This agent is responsible for recommending the appropriate policy to the user based on the risk assessment and premium calculation.
# It takes the risk assessment and premium calculation as input and recommends the appropriate policy to the user.
# It is also responsible for keeping track of the user's policy recommendation history.
# It is also responsible for providing the user with the policy recommendation details.
# This agent sends the result to the communication agent to communicate the recommendation to the user.
# This agent acts as a bridge between the risk assessment agent and the premium calculation agent and returns the results to the communication agent to communicate the recommendation to the user.
# This agent is responsible for recommending the appropriate policy to the user based on the risk assessment and premium calculation.

from typing import Dict, List, Any, TypedDict, Annotated, Sequence, Literal, Optional, Tuple
from langchain.schema import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from langgraph.graph.message import add_messages
from langgraph.checkpoint import MemorySaver
from  utils.useLLM import UseLLM
from  agents.risk_assesment_agent import RiskAssessmentAgent
from  agents.premium_calculation_agent import PremiumCalculationAgent

class PolicyRecommendationState(TypedDict):
    """State for the policy recommendation agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_info: Dict[str, Any]
    risk_assessment: Dict[str, Any]
    premium_calculation: Dict[str, Any]
    policy_recommendation: Optional[Dict[str, Any]]

class PolicyRecommendationAgent:
    """
    Agent responsible for recommending policies based on risk assessment and premium calculation.
    """
    
    def __init__(self, llm_utility: UseLLM, risk_agent: RiskAssessmentAgent, premium_agent: PremiumCalculationAgent):
        """
        Initialize the policy recommendation agent.
        
        Args:
            llm_utility: The LLM utility to use for interacting with language models.
            risk_agent: The risk assessment agent.
            premium_agent: The premium calculation agent.
        """
        self.llm_utility = llm_utility
        self.llm = llm_utility.get_llm()
        self.risk_agent = risk_agent
        self.premium_agent = premium_agent
        self.system_message = llm_utility.create_system_message(
            """You are a policy recommendation agent for a life insurance company.
            Your job is to recommend the appropriate policy to the user based on their risk assessment and premium calculation.
            You will be provided with the user's information, risk assessment, and premium calculation.
            You need to recommend the most suitable policy for the user based on these factors.
            Provide a detailed explanation of why you are recommending this policy.
            """
        )
        self.recommendation_history = {}  # Store recommendation history by user ID
        
        # Create the graph
        self.graph = self._create_graph()
    
    def _create_graph(self) -> StateGraph:
        """
        Create the graph for the policy recommendation agent.
        
        Returns:
            The compiled graph.
        """
        # Define the nodes
        def recommend_policy(state: PolicyRecommendationState) -> PolicyRecommendationState:
            """
            Recommend a policy based on risk assessment and premium calculation.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state with policy recommendation.
            """
            # Extract information
            user_info = state["user_info"]
            risk_assessment = state["risk_assessment"]
            premium_calculation = state["premium_calculation"]
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                Please recommend a policy for this user:
                
                User Information:
                - Age: {user_info.get('age', 'Unknown')}
                - Gender: {user_info.get('gender', 'Unknown')}
                - Health Conditions: {user_info.get('health_conditions', [])}
                - Smoking Status: {user_info.get('smoking', 'Unknown')}
                - Family History: {user_info.get('family_history', [])}
                - Occupation: {user_info.get('occupation', 'Unknown')}
                
                Risk Assessment:
                - Risk Score: {risk_assessment.get('risk_score', 'Unknown')}
                - Risk Factors: {risk_assessment.get('risk_factors', [])}
                - Assessment: {risk_assessment.get('assessment', 'Unknown')}
                
                Premium Calculation:
                - Annual Premium: {premium_calculation.get('annual_premium', 'Unknown')}
                - Monthly Premium: {premium_calculation.get('monthly_premium', 'Unknown')}
                - Breakdown: {premium_calculation.get('breakdown', {})}
                - Explanation: {premium_calculation.get('explanation', 'Unknown')}
                
                Recommend the most suitable policy for this user and provide a detailed explanation.
                Format your response as JSON with the following structure:
                {{
                    "recommended_policy": {{
                        "policy_type": "policy type",
                        "coverage_amount": <amount>,
                        "term_length": <years>,
                        "premium": <amount>,
                        "recommended_riders": ["rider1", "rider2", ...]
                    }},
                    "alternative_policies": [
                        {{
                            "policy_type": "alternative policy type",
                            "coverage_amount": <amount>,
                            "term_length": <years>,
                            "premium": <amount>,
                            "recommended_riders": ["rider1", "rider2", ...]
                        }}
                    ],
                    "explanation": "detailed explanation text",
                    "additional_notes": "any additional notes or recommendations"
                }}
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Parse the response to extract policy recommendation
            try:
                import json
                policy_recommendation = json.loads(response.content)
                
                # Update the state
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "risk_assessment": state["risk_assessment"],
                    "premium_calculation": state["premium_calculation"],
                    "policy_recommendation": policy_recommendation
                }
            except Exception as e:
                # If parsing fails, return a default policy recommendation
                default_recommendation = {
                    "recommended_policy": {
                        "policy_type": "Term Life Insurance",
                        "coverage_amount": 500000,
                        "term_length": 20,
                        "premium": premium_calculation.get("annual_premium", 1000),
                        "recommended_riders": ["Accidental Death Benefit", "Disability Waiver of Premium"]
                    },
                    "alternative_policies": [
                        {
                            "policy_type": "Whole Life Insurance",
                            "coverage_amount": 250000,
                            "term_length": "Lifetime",
                            "premium": premium_calculation.get("annual_premium", 1000) * 2,
                            "recommended_riders": ["Critical Illness Rider"]
                        }
                    ],
                    "explanation": "Unable to parse the policy recommendation. This is a default recommendation.",
                    "additional_notes": "Please consult with an insurance advisor for a more personalized recommendation."
                }
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "risk_assessment": state["risk_assessment"],
                    "premium_calculation": state["premium_calculation"],
                    "policy_recommendation": default_recommendation
                }
        
        # Create the graph
        builder = StateGraph(PolicyRecommendationState)
        
        # Add nodes
        builder.add_node("recommend_policy", recommend_policy)
        
        # Add edges
        builder.add_edge("recommend_policy", END)
        
        # Set the entry point
        builder.set_entry_point("recommend_policy")
        
        # Compile the graph
        return builder.compile()
    
    def invoke_with_results(self, user_info: Dict[str, Any], risk_assessment: Dict[str, Any], premium_calculation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invoke the policy recommendation agent with pre-calculated risk assessment and premium calculation results.
        
        Args:
            user_info: The user information.
            risk_assessment: The pre-calculated risk assessment result.
            premium_calculation: The pre-calculated premium calculation result.
            
        Returns:
            The policy recommendation result.
        """
        print(f"Policy Recommendation Agent - Step 4 in process flow: Recommending policy")
        
        # Initialize the state
        initial_state = {
            "messages": [self.system_message],
            "user_info": user_info,
            "risk_assessment": risk_assessment,
            "premium_calculation": premium_calculation,
            "policy_recommendation": None
        }
        
        # Run the graph
        result = self.graph.invoke(initial_state)
        
        # Store the policy recommendation in history
        user_id = user_info.get("user_id", "unknown")
        if user_id not in self.recommendation_history:
            self.recommendation_history[user_id] = []
        self.recommendation_history[user_id].append(result["policy_recommendation"])
        
        print(f"Policy Recommendation Agent: Completed policy recommendation with policy type {result['policy_recommendation']['recommended_policy']['policy_type']}")
        
        return result["policy_recommendation"]
        
    def invoke(self, user_info: Dict[str, Any], policy_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invoke the policy recommendation agent.
        
        Args:
            user_info: The user information.
            policy_details: The policy details.
            
        Returns:
            The policy recommendation result.
        """
        print(f"Policy Recommendation Agent - Initiating full policy recommendation flow")
        
        # Get risk assessment (Step 2)
        print(f"Policy Recommendation Agent - Calling Step 2: Risk Assessment")
        risk_assessment = self.risk_agent.invoke(user_info)
        
        # Get premium calculation (Step 3)
        print(f"Policy Recommendation Agent - Calling Step 3: Premium Calculation")
        premium_calculation = self.premium_agent.invoke(user_info, risk_assessment, policy_details)
        
        # Get policy recommendation (Step 4)
        print(f"Policy Recommendation Agent - Performing Step 4: Policy Recommendation")
        
        # Initialize the state
        initial_state = {
            "messages": [self.system_message],
            "user_info": user_info,
            "risk_assessment": risk_assessment,
            "premium_calculation": premium_calculation,
            "policy_recommendation": None
        }
        
        # Run the graph
        result = self.graph.invoke(initial_state)
        
        # Store the policy recommendation in history
        user_id = user_info.get("user_id", "unknown")
        if user_id not in self.recommendation_history:
            self.recommendation_history[user_id] = []
        self.recommendation_history[user_id].append(result["policy_recommendation"])
        
        print(f"Policy Recommendation Agent: Completed full recommendation flow")
        
        return {
            "risk_assessment": risk_assessment,
            "premium_calculation": premium_calculation,
            "policy_recommendation": result["policy_recommendation"]
        }