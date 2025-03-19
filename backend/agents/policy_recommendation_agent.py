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

# Available policies
AVAILABLE_POLICIES = [
    {
        "name": "Term Life Insurance - 10 Years",
        "type": "Life",
        "sub_type": "Term",
        "policy_term": "10 years",
        "death_benefit": "$250,000",
        "maturity_benefit": "None",
        "premium": "$15/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old non-smoker. 30-day grace period. 2-year contestability period."
    },
    {
        "name": "Term Life Insurance - 20 Years",
        "type": "Life",
        "sub_type": "Term",
        "policy_term": "20 years",
        "death_benefit": "$500,000",
        "maturity_benefit": "None",
        "premium": "$25/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old non-smoker. 30-day grace period. 2-year contestability period."
    },
    {
        "name": "Whole Life Insurance",
        "type": "Life",
        "sub_type": "Whole",
        "policy_term": "Lifetime",
        "death_benefit": "$100,000",
        "maturity_benefit": "Cash value",
        "premium": "$150/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old non-smoker. Builds cash value. 30-day grace period. 2-year contestability period."
    },
    {
        "name": "Universal Life Insurance",
        "type": "Life",
        "sub_type": "Universal",
        "policy_term": "Lifetime",
        "death_benefit": "$200,000",
        "maturity_benefit": "Cash value",
        "premium": "$200/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old non-smoker. Flexible premiums and death benefits. Cash value earns interest. 30-day grace period. 2-year contestability period."
    },
    {
        "name": "HMO Health Insurance",
        "type": "Health",
        "sub_type": "HMO",
        "policy_term": "1 year, renewable",
        "coverage": "Medical expenses up to $20,000/year",
        "premium": "$150/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old. Requires use of network providers. Low copays. 30-day grace period. Waiting period for pre-existing conditions: 12 months."
    },
    {
        "name": "PPO Health Insurance",
        "type": "Health",
        "sub_type": "PPO",
        "policy_term": "1 year, renewable",
        "coverage": "Medical expenses up to $30,000/year",
        "premium": "$250/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old. More provider choices. Higher copays. 30-day grace period. Waiting period for pre-existing conditions: 6 months."
    },
    {
        "name": "HDHP with HSA",
        "type": "Health",
        "sub_type": "HDHP",
        "policy_term": "1 year, renewable",
        "coverage": "Medical expenses with $5,000 deductible, up to $50,000/year",
        "premium": "$100/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old. Eligible for HSA. 30-day grace period. No waiting period for pre-existing conditions."
    },
    {
        "name": "Critical Illness Insurance",
        "type": "Health",
        "sub_type": "Critical Illness",
        "policy_term": "10 years",
        "coverage": "Lump sum payout of $50,000 upon diagnosis of specified critical illnesses",
        "premium": "$50/month",
        "payment_frequency": "Monthly",
        "additional_details": "For a 30-year-old. 30-day grace period. Waiting period: 90 days from policy start."
    }
]

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
            """You are a policy recommendation agent for an insurance company.
            Your job is to recommend the most appropriate policy to the user from a predefined list of available policies.
            You will be provided with the user's information, risk assessment, premium calculation, and a list of available policies.
            You need to recommend the most suitable policy for the user based on these factors.
            Provide a detailed explanation of why you are recommending this policy.
            """
        )
        self.recommendation_history = {}  # Store recommendation history by user ID
        
        # Create a memory saver for checkpointing
        self.memory_saver = MemorySaver()
        
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
            
            # Format the available policies for the LLM
            policies_text = ""
            for i, policy in enumerate(AVAILABLE_POLICIES, 1):
                policies_text += f"Policy {i}: {policy['name']}\n"
                for key, value in policy.items():
                    if key != "name":
                        policies_text += f"  - {key}: {value}\n"
                policies_text += "\n"
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                Please recommend a policy for this user from the list of available policies:
                
                User Information:
                - Age: {user_info.get('age', 'Unknown')}
                - Gender: {user_info.get('gender', 'Unknown')}
                - Health: {user_info.get('health', 'Unknown')}
                - Smoking Status: {user_info.get('smoking', 'Unknown')}
                - Occupation: {user_info.get('occupation', 'Unknown')}
                - Income: {user_info.get('income', 'Unknown')}
                
                Risk Assessment:
                - Risk Score: {risk_assessment.get('risk_score', 'Unknown')}
                - Risk Factors: {risk_assessment.get('risk_factors', [])}
                - Assessment: {risk_assessment.get('assessment', 'Unknown')}
                
                Premium Calculation:
                - Annual Premium: {premium_calculation.get('annual_premium', 'Unknown')}
                - Monthly Premium: {premium_calculation.get('monthly_premium', 'Unknown')}
                - Breakdown: {premium_calculation.get('breakdown', {})}
                - Explanation: {premium_calculation.get('explanation', 'Unknown')}
                
                Available Policies:
                {policies_text}
                
                Based on the user's information, risk assessment, and premium calculation, recommend the most suitable policy from the available options.
                Also suggest 1-2 alternative policies that might be good secondary options.
                
                Format your response as JSON with the following structure:
                {{
                    "recommended_policy": {{
                        "name": "exact name of the recommended policy",
                        "policy_type": "Life or Health",
                        "sub_type": "Term, Whole, Universal, HMO, PPO, etc.",
                        "coverage_amount": "coverage amount with $ sign",
                        "term_length": "term length",
                        "premium": "premium amount with $ sign",
                        "recommended_riders": ["rider1", "rider2", ...] (optional)
                    }},
                    "alternative_policies": [
                        {{
                            "name": "exact name of alternative policy",
                            "policy_type": "Life or Health",
                            "sub_type": "Term, Whole, Universal, HMO, PPO, etc.",
                            "coverage_amount": "coverage amount with $ sign",
                            "term_length": "term length",
                            "premium": "premium amount with $ sign"
                        }}
                    ],
                    "explanation": "detailed explanation of why this policy is recommended for this user",
                    "additional_notes": "any additional notes or recommendations"
                }}
                
                IMPORTANT: Only recommend policies from the provided list. Do not invent new policies.
                Make sure the policy names exactly match one of the available policies.
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Parse the response to extract policy recommendation
            try:
                import json
                import re
                
                # Try to extract JSON from the response
                json_match = re.search(r'```json\n(.*?)\n```', response.content, re.DOTALL)
                if json_match:
                    policy_recommendation = json.loads(json_match.group(1))
                else:
                    policy_recommendation = json.loads(response.content)
                
                # Validate that the recommended policy exists in our available policies
                recommended_policy_name = policy_recommendation["recommended_policy"]["name"]
                if not any(p["name"] == recommended_policy_name for p in AVAILABLE_POLICIES):
                    # If not found, select a default policy
                    policy_recommendation["recommended_policy"]["name"] = AVAILABLE_POLICIES[0]["name"]
                    policy_recommendation["additional_notes"] = "The originally recommended policy was not found in the available policies. A default policy has been selected."
                
                # Update the state
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "risk_assessment": state["risk_assessment"],
                    "premium_calculation": state["premium_calculation"],
                    "policy_recommendation": policy_recommendation
                }
            except Exception as e:
                print(f"Error parsing policy recommendation: {str(e)}")
                # If parsing fails, return a default policy recommendation
                default_recommendation = {
                    "recommended_policy": {
                        "name": AVAILABLE_POLICIES[1]["name"],  # Term Life Insurance - 20 Years
                        "policy_type": "Life",
                        "sub_type": "Term",
                        "coverage_amount": "$500,000",
                        "term_length": "20 years",
                        "premium": "$25/month",
                        "recommended_riders": ["Accidental Death Benefit", "Disability Waiver of Premium"]
                    },
                    "alternative_policies": [
                        {
                            "name": AVAILABLE_POLICIES[2]["name"],  # Whole Life Insurance
                            "policy_type": "Life",
                            "sub_type": "Whole",
                            "coverage_amount": "$100,000",
                            "term_length": "Lifetime",
                            "premium": "$150/month"
                        }
                    ],
                    "explanation": "Unable to parse the policy recommendation. This is a default recommendation based on the most common policy choices.",
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
    
    def _get_user_history(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get the recommendation history for a user.
        
        Args:
            user_id: The user ID.
            
        Returns:
            The recommendation history.
        """
        # Try to load from checkpoint first
        try:
            checkpoint_key = f"recommendation_history_{user_id}"
            if self.memory_saver.exists(checkpoint_key):
                return self.memory_saver.get(checkpoint_key)
        except Exception as e:
            print(f"Error loading recommendation history from checkpoint: {str(e)}")
        
        # Return from memory if checkpoint doesn't exist or loading fails
        return self.recommendation_history.get(user_id, [])
    
    def _update_user_history(self, user_id: str, recommendation: Dict[str, Any]):
        """
        Update the recommendation history for a user.
        
        Args:
            user_id: The user ID.
            recommendation: The recommendation to add to history.
        """
        if user_id not in self.recommendation_history:
            self.recommendation_history[user_id] = []
        
        # Add timestamp to recommendation
        import datetime
        recommendation_with_timestamp = recommendation.copy()
        recommendation_with_timestamp["timestamp"] = datetime.datetime.now().isoformat()
        
        # Add to history
        self.recommendation_history[user_id].append(recommendation_with_timestamp)
        
        # Keep only the last 5 recommendations to avoid excessive memory usage
        if len(self.recommendation_history[user_id]) > 5:
            self.recommendation_history[user_id] = self.recommendation_history[user_id][-5:]
        
        # Save to checkpoint
        try:
            checkpoint_key = f"recommendation_history_{user_id}"
            self.memory_saver.put(checkpoint_key, self.recommendation_history[user_id])
        except Exception as e:
            print(f"Error saving recommendation history to checkpoint: {str(e)}")
    
    def invoke(self, user_info: Dict[str, Any], policy_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invoke the policy recommendation agent.
        
        Args:
            user_info: The user information.
            policy_details: The policy details.
            
        Returns:
            The policy recommendation result.
        """
        # Extract user_id for history tracking
        user_id = user_info.get("user_id", "unknown")
        
        # Get risk assessment
        risk_assessment = self.risk_agent.invoke(user_info)
        
        # Get premium calculation
        premium_calculation = self.premium_agent.invoke(user_info, risk_assessment, policy_details)
        
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
        
        # Update the recommendation history
        self._update_user_history(user_id, result["policy_recommendation"])
        
        return {
            "risk_assessment": risk_assessment,
            "premium_calculation": premium_calculation,
            "policy_recommendation": result["policy_recommendation"]
        }