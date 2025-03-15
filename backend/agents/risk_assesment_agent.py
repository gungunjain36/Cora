# Risk Agent
#This agent is responsible for assessing the risk of the user based on the information provided by the communication agent.
#It calculates the risk based on the user's age, user's details, and the type of policy selected.
#It then returns the risk assessment to the policy_recommendation agent.
#It is also responsible for keeping track of the user's risk assessment history.
#It is also responsible for providing the user with the risk assessment details.
# This agent sends the result to the recommendation agent to recommend the appropriate policy to the user.

from typing import Dict, List, Any, TypedDict, Annotated, Sequence, Literal, Optional, Tuple
from langchain.schema import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from langgraph.graph.message import add_messages
from langgraph.checkpoint import MemorySaver
from  utils.useLLM import UseLLM

class RiskAssessmentState(TypedDict):
    """State for the risk assessment agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_info: Dict[str, Any]
    risk_score: Optional[float]
    risk_factors: Optional[List[str]]
    risk_assessment: Optional[Dict[str, Any]]

class RiskAssessmentAgent:
    """
    Agent responsible for assessing the risk of a user based on their information.
    """
    
    def __init__(self, llm_utility: UseLLM):
        """
        Initialize the risk assessment agent.
        
        Args:
            llm_utility: The LLM utility to use for interacting with language models.
        """
        self.llm_utility = llm_utility
        self.llm = llm_utility.get_llm()
        self.system_message = llm_utility.create_system_message(
            """You are a risk assessment agent for a life insurance company.
            Your job is to assess the risk of a user based on their information.
            You will be provided with the user's age, details, and the type of policy they are interested in.
            You need to calculate a risk score between 0 and 100, where 0 is the lowest risk and 100 is the highest risk.
            You should also identify key risk factors that contribute to the risk score.
            Provide a detailed assessment of the user's risk profile.
            """
        )
        self.risk_history = {}  # Store risk assessment history by user ID
        
        # Create the graph
        self.graph = self._create_graph()
    
    def _create_graph(self) -> StateGraph:
        """
        Create the graph for the risk assessment agent.
        
        Returns:
            The compiled graph.
        """
        # Define the nodes
        def assess_risk(state: RiskAssessmentState) -> RiskAssessmentState:
            """
            Assess the risk of a user based on their information.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state with risk assessment.
            """
            # Extract user information
            user_info = state["user_info"]
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                Please assess the risk for this user:
                
                Age: {user_info.get('age', 'Unknown')}
                Gender: {user_info.get('gender', 'Unknown')}
                Health Conditions: {user_info.get('health_conditions', [])}
                Smoking Status: {user_info.get('smoking', 'Unknown')}
                Family History: {user_info.get('family_history', [])}
                Occupation: {user_info.get('occupation', 'Unknown')}
                Policy Type: {user_info.get('policy_type', 'Unknown')}
                
                Provide a risk score between 0 and 100, key risk factors, and a detailed assessment.
                Format your response as JSON with the following structure:
                {{
                    "risk_score": <score>,
                    "risk_factors": ["factor1", "factor2", ...],
                    "assessment": "detailed assessment text"
                }}
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Parse the response to extract risk score, factors, and assessment
            # Note: In a real implementation, you would use a proper JSON parser
            # This is a simplified version for demonstration
            try:
                import json
                risk_assessment = json.loads(response.content)
                
                # Update the state
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "risk_score": risk_assessment.get("risk_score"),
                    "risk_factors": risk_assessment.get("risk_factors", []),
                    "risk_assessment": risk_assessment
                }
            except Exception as e:
                # If parsing fails, return a default assessment
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "risk_score": 50.0,  # Default moderate risk
                    "risk_factors": ["Unable to parse assessment"],
                    "risk_assessment": {
                        "risk_score": 50.0,
                        "risk_factors": ["Unable to parse assessment"],
                        "assessment": "Unable to parse the risk assessment. Please try again."
                    }
                }
        
        # Create the graph
        builder = StateGraph(RiskAssessmentState)
        
        # Add nodes
        builder.add_node("assess_risk", assess_risk)
        
        # Add edges
        builder.add_edge("assess_risk", END)
        
        # Set the entry point
        builder.set_entry_point("assess_risk")
        
        # Compile the graph
        return builder.compile()
    
    def invoke(self, user_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Invoke the risk assessment agent.
        
        Args:
            user_info: The user information to assess.
            
        Returns:
            The risk assessment result.
        """
        # Initialize the state
        initial_state = {
            "messages": [self.system_message],
            "user_info": user_info,
            "risk_score": None,
            "risk_factors": None,
            "risk_assessment": None
        }
        
        # Run the graph
        result = self.graph.invoke(initial_state)
        
        # Store the risk assessment in history
        user_id = user_info.get("user_id", "unknown")
        if user_id not in self.risk_history:
            self.risk_history[user_id] = []
        self.risk_history[user_id].append(result["risk_assessment"])
        
        return result["risk_assessment"]