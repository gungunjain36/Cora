# Premium Calculation Agent
# This agent is responsible for calculating the premium for a given policy.
# It takes the user's information and the policy details as input and calculates the premium based on
# the user's age, user's details, and the type of policy selected.
# It then returns the premium to the recommendation agent.

from typing import Dict, List, Any, TypedDict, Annotated, Sequence, Literal, Optional, Tuple
from langchain.schema import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from langgraph.graph.message import add_messages
from langgraph.checkpoint import MemorySaver
from  utils.useLLM import UseLLM

class PremiumCalculationState(TypedDict):
    """State for the premium calculation agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_info: Dict[str, Any]
    risk_assessment: Dict[str, Any]
    policy_details: Dict[str, Any]
    premium: Optional[Dict[str, Any]]

class PremiumCalculationAgent:
    """
    Agent responsible for calculating the premium for a given policy.
    """
    
    def __init__(self, llm_utility: UseLLM):
        """
        Initialize the premium calculation agent.
        
        Args:
            llm_utility: The LLM utility to use for interacting with language models.
        """
        self.llm_utility = llm_utility
        self.llm = llm_utility.get_llm()
        self.system_message = llm_utility.create_system_message(
            """You are a premium calculation agent for a life insurance company.
            Your job is to calculate the premium for a given policy based on the user's information and risk assessment.
            You will be provided with the user's age, details, risk assessment, and the policy details.
            You need to calculate the premium amount based on these factors.
            Provide a detailed breakdown of the premium calculation.
            """
        )
        self.premium_history = {}  # Store premium calculation history by user ID
        
        # Create the graph
        self.graph = self._create_graph()
    
    def _create_graph(self) -> StateGraph:
        """
        Create the graph for the premium calculation agent.
        
        Returns:
            The compiled graph.
        """
        # Define the nodes
        def calculate_premium(state: PremiumCalculationState) -> PremiumCalculationState:
            """
            Calculate the premium for a given policy.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state with premium calculation.
            """
            # Extract information
            user_info = state["user_info"]
            risk_assessment = state["risk_assessment"]
            policy_details = state["policy_details"]
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                Please calculate the premium for this policy:
                
                User Information:
                - Age: {user_info.get('age', 'Unknown')}
                - Gender: {user_info.get('gender', 'Unknown')}
                - Health Conditions: {user_info.get('health_conditions', [])}
                - Smoking Status: {user_info.get('smoking', 'Unknown')}
                
                Risk Assessment:
                - Risk Score: {risk_assessment.get('risk_score', 'Unknown')}
                - Risk Factors: {risk_assessment.get('risk_factors', [])}
                
                Policy Details:
                - Policy Type: {policy_details.get('policy_type', 'Unknown')}
                - Coverage Amount: {policy_details.get('coverage_amount', 'Unknown')}
                - Term Length: {policy_details.get('term_length', 'Unknown')}
                - Additional Riders: {policy_details.get('riders', [])}
                
                Calculate the premium amount and provide a detailed breakdown.
                Format your response as JSON with the following structure:
                {{
                    "annual_premium": <amount>,
                    "monthly_premium": <amount>,
                    "breakdown": {{
                        "base_premium": <amount>,
                        "risk_adjustment": <amount>,
                        "rider_costs": <amount>,
                        "other_fees": <amount>
                    }},
                    "explanation": "detailed explanation text"
                }}
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Parse the response to extract premium calculation
            try:
                import json
                premium = json.loads(response.content)
                
                # Update the state
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "risk_assessment": state["risk_assessment"],
                    "policy_details": state["policy_details"],
                    "premium": premium
                }
            except Exception as e:
                # If parsing fails, return a default premium calculation
                default_premium = {
                    "annual_premium": 1000.0,
                    "monthly_premium": 83.33,
                    "breakdown": {
                        "base_premium": 800.0,
                        "risk_adjustment": 150.0,
                        "rider_costs": 50.0,
                        "other_fees": 0.0
                    },
                    "explanation": "Unable to parse the premium calculation. This is a default calculation."
                }
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "risk_assessment": state["risk_assessment"],
                    "policy_details": state["policy_details"],
                    "premium": default_premium
                }
        
        # Create the graph
        builder = StateGraph(PremiumCalculationState)
        
        # Add nodes
        builder.add_node("calculate_premium", calculate_premium)
        
        # Add edges
        builder.add_edge("calculate_premium", END)
        
        # Set the entry point
        builder.set_entry_point("calculate_premium")
        
        # Compile the graph
        return builder.compile()
    
    def invoke(self, user_info: Dict[str, Any], risk_assessment: Dict[str, Any], policy_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invoke the premium calculation agent.
        
        Args:
            user_info: The user information.
            risk_assessment: The risk assessment result.
            policy_details: The policy details.
            
        Returns:
            The premium calculation result.
        """
        # Initialize the state
        initial_state = {
            "messages": [self.system_message],
            "user_info": user_info,
            "risk_assessment": risk_assessment,
            "policy_details": policy_details,
            "premium": None
        }
        
        # Run the graph
        result = self.graph.invoke(initial_state)
        
        # Store the premium calculation in history
        user_id = user_info.get("user_id", "unknown")
        if user_id not in self.premium_history:
            self.premium_history[user_id] = []
        self.premium_history[user_id].append(result["premium"])
        
        return result["premium"]