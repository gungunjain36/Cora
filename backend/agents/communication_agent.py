# This is the communication agent that is responsible for handling the communication with the client.
# It is responsible for receiving the client's messages and sending the appropriate responses.
# It is also responsible for keeping track of the conversation history.
# This agent takes the user information and asks the "premium calculation" agent to calculate the premium and "risk assessment" agent to assess the risk.
# The output from these agents is then used to recommend the appropriate policy to the user via the "policy recommendation" agent.
# This agent basically acts as a middleman between the client and the other agents.
# This agent delegates the tasks to the other agents and then sends the appropriate response to the client.

import asyncio
from typing import Dict, List, Any, TypedDict, Annotated, Sequence, Literal, Optional, Tuple, Union, cast
from langchain.schema import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor
from langgraph.graph.message import add_messages
from langgraph.checkpoint import MemorySaver
from utils.useLLM import UseLLM
from agents.policy_recommendation_agent import PolicyRecommendationAgent
from agents.risk_assesment_agent import RiskAssessmentAgent
from agents.premium_calculation_agent import PremiumCalculationAgent
import concurrent.futures
import json
import re
from datetime import datetime
import traceback

# Maximum number of concurrent operations
MAX_CONCURRENCY = 5

class CommunicationState(TypedDict):
    """State for the communication agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_info: Optional[Dict[str, Any]]
    policy_details: Optional[Dict[str, Any]]
    recommendation_result: Optional[Dict[str, Any]]
    conversation_stage: Literal["greeting", "collecting_info", "policy_selection", "recommendation", "followup", "completed"]
    step_count: int  # Track the number of steps to prevent infinite loops
    remaining_steps: int  # Track remaining steps before recursion limit

class CommunicationAgent:
    """
    Agent responsible for handling communication with the client and coordinating with other agents.
    """
    
    def __init__(self, llm_utility: UseLLM):
        """Initialize the communication agent."""
        self.llm_utility = llm_utility
        self.llm = llm_utility.get_llm()
        
        # Create other agents lazily
        self._risk_agent = None
        self._premium_agent = None
        self._policy_agent = None
        
        # Create system message with improved prompt
        self.system_message = llm_utility.create_system_message(
            """You are Cora, an intelligent and empathetic insurance advisor. Your role is to help clients find the perfect insurance policy through natural conversation.

            CORE OBJECTIVES:
            1. Build trust through empathetic, professional communication
            2. Collect essential information naturally
            3. Provide personalized policy recommendations
            4. Explain complex insurance concepts simply
            5. Guide clients through the decision process

            CONVERSATION GUIDELINES:
            - Start with a warm, professional greeting
            - Use the client's name and reference their specific situation
            - Ask follow-up questions that show you understand their needs
            - Explain insurance concepts in simple, relatable terms
            - Be proactive in addressing potential concerns
            - Maintain a natural conversation flow while gathering information

            REQUIRED INFORMATION:
            Basic Info (Required):
            - Age
            - Gender
            - Smoking status
            - Health conditions
            
            Additional Info (Optional):
            - Occupation
            - Income
            - Family status
            - Lifestyle factors

            IMPORTANT RULES:
            1. Never ask for information already provided
            2. Acknowledge and validate client concerns
            3. Provide clear explanations for recommendations
            4. Be transparent about policy terms and conditions
            5. Maintain professionalism while being conversational

            Remember: Your goal is to be a trusted advisor who helps clients make informed insurance decisions."""
        )
        
        # Initialize state management
        self.conversation_history = {}
        self.user_states = {}
        self.memory_saver = MemorySaver()
        
        # Create the conversation graph
        self.graph = self._create_graph()
        
        # Initialize thread pool for concurrent operations
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENCY)
    
    @property
    def risk_agent(self):
        """Lazy initialization of risk agent"""
        if self._risk_agent is None:
            self._risk_agent = RiskAssessmentAgent(self.llm_utility)
        return self._risk_agent
    
    @property
    def premium_agent(self):
        """Lazy initialization of premium agent"""
        if self._premium_agent is None:
            self._premium_agent = PremiumCalculationAgent(self.llm_utility)
        return self._premium_agent
    
    @property
    def policy_agent(self):
        """Lazy initialization of policy agent"""
        if self._policy_agent is None:
            self._policy_agent = PolicyRecommendationAgent(self.llm_utility, self.risk_agent, self.premium_agent)
        return self._policy_agent
    
    def _create_graph(self) -> StateGraph:
        """Create the conversation graph."""
        # Create graph with state type
        builder = StateGraph(CommunicationState)
        
        # Add nodes for each conversation stage
        builder.add_node("greeting", self._greeting_node)
        builder.add_node("collecting_info", self._collecting_info_node)
        builder.add_node("policy_selection", self._policy_selection_node)
        builder.add_node("recommendation", self._recommendation_node)
        builder.add_node("followup", self._followup_node)
        
        # Set entry point
        builder.set_entry_point("greeting")
        
        # Define edges
        edges = {
            "greeting": "greeting",
            "collecting_info": "collecting_info",
            "policy_selection": "policy_selection",
            "recommendation": "recommendation",
            "followup": "followup",
            "completed": END
        }
        
        # Add edges for each node
        for node in ["greeting", "collecting_info", "policy_selection", "recommendation", "followup"]:
            builder.add_conditional_edges(
                node,
                self._router,
                edges
            )
        
        return builder.compile()

    def _greeting_node(self, state: CommunicationState) -> CommunicationState:
        """Handle the greeting stage of the conversation."""
        user_info = state.get("user_info", {})
        has_basic_info = all(key in user_info for key in ["age", "gender", "smoking", "health"])
        is_returning_user = bool(user_info) and state.get("step_count", 0) <= 1

        # Create personalized greeting
        greeting_prompt = self._create_greeting_prompt(user_info, has_basic_info, is_returning_user)
        response = self.llm.invoke([self.system_message, HumanMessage(content=greeting_prompt)])

        # Determine next stage
        next_stage = "policy_selection" if has_basic_info else "collecting_info"

        return {
            "messages": state["messages"] + [response],
            "user_info": user_info,
            "policy_details": state.get("policy_details", {}),
            "recommendation_result": state.get("recommendation_result"),
            "conversation_stage": next_stage,
            "step_count": state.get("step_count", 0) + 1
        }

    def _collecting_info_node(self, state: CommunicationState) -> CommunicationState:
        """Handle the information collection stage."""
        user_info = state.get("user_info", {})
        missing_fields = [field for field in ["age", "gender", "smoking", "health"] if field not in user_info]
        
        # Create information collection prompt
        collection_prompt = self._create_collection_prompt(user_info, missing_fields)
        response = self.llm.invoke([self.system_message, HumanMessage(content=collection_prompt)])
        
        # Extract new information from response
        updated_info = self._extract_user_info(response.content, user_info)
        
        # Determine next stage
        has_basic_info = all(key in updated_info for key in ["age", "gender", "smoking", "health"])
        next_stage = "policy_selection" if has_basic_info else "collecting_info"
        
        return {
            "messages": state["messages"] + [response],
            "user_info": updated_info,
            "policy_details": state.get("policy_details", {}),
            "recommendation_result": state.get("recommendation_result"),
            "conversation_stage": next_stage,
            "step_count": state.get("step_count", 0) + 1
        }

    def _policy_selection_node(self, state: CommunicationState) -> CommunicationState:
        """Handle the policy selection stage."""
        policy_details = state.get("policy_details", {})
        user_info = state.get("user_info", {})
        
        # Create policy selection prompt
        selection_prompt = self._create_policy_selection_prompt(user_info, policy_details)
        response = self.llm.invoke([self.system_message, HumanMessage(content=selection_prompt)])
        
        # Extract policy preferences
        updated_policy_details = self._extract_policy_details(response.content, policy_details)
        
        # Determine next stage
        has_policy_info = "policy_type" in updated_policy_details and "coverage_amount" in updated_policy_details
        next_stage = "recommendation" if has_policy_info else "policy_selection"
        
        return {
            "messages": state["messages"] + [response],
            "user_info": user_info,
            "policy_details": updated_policy_details,
            "recommendation_result": state.get("recommendation_result"),
            "conversation_stage": next_stage,
            "step_count": state.get("step_count", 0) + 1
        }

    def _recommendation_node(self, state: CommunicationState) -> CommunicationState:
        """Handle the recommendation stage."""
        try:
            # Get recommendation from policy agent
            recommendation = self.policy_agent.invoke(
                state["user_info"],
                state["policy_details"]
            )
            
            # Create recommendation prompt
            recommendation_prompt = self._create_recommendation_prompt(state["user_info"], recommendation)
            response = self.llm.invoke([self.system_message, HumanMessage(content=recommendation_prompt)])
            
            return {
                "messages": state["messages"] + [response],
                "user_info": state["user_info"],
                "policy_details": state["policy_details"],
                "recommendation_result": recommendation,
                "conversation_stage": "followup",
                "step_count": state.get("step_count", 0) + 1
            }
        except Exception as e:
            print(f"Error in recommendation node: {str(e)}")
            # Create fallback response
            fallback_prompt = self._create_fallback_prompt(state["user_info"])
            response = self.llm.invoke([self.system_message, HumanMessage(content=fallback_prompt)])
            
            return {
                "messages": state["messages"] + [response],
                "user_info": state["user_info"],
                "policy_details": state["policy_details"],
                "recommendation_result": None,
                "conversation_stage": "policy_selection",
                "step_count": state.get("step_count", 0) + 1
            }

    def _followup_node(self, state: CommunicationState) -> CommunicationState:
        """Handle the follow-up stage."""
        # Create follow-up prompt
        followup_prompt = self._create_followup_prompt(
            state["user_info"],
            state["policy_details"],
            state["recommendation_result"]
        )
        response = self.llm.invoke([self.system_message, HumanMessage(content=followup_prompt)])
        
        # Check if conversation should end
        last_message = state["messages"][-1].content.lower()
        is_complete = any(word in last_message for word in ["thank", "goodbye", "bye"])
        
        return {
            "messages": state["messages"] + [response],
            "user_info": state["user_info"],
            "policy_details": state["policy_details"],
            "recommendation_result": state["recommendation_result"],
            "conversation_stage": "completed" if is_complete else "followup",
            "step_count": state.get("step_count", 0) + 1
        }

    def _router(self, state: CommunicationState) -> Literal["greeting", "collecting_info", "policy_selection", "recommendation", "followup", "completed", END]:
        """Route the conversation to the appropriate stage."""
        # Decrement remaining steps
        state["remaining_steps"] = state.get("remaining_steps", 50) - 1
        
        # Check for remaining steps
        if state["remaining_steps"] <= 0:
            print("Reached maximum steps, ending conversation")
            return "completed"
        
        # Get current stage and user state
        current_stage = state["conversation_stage"]
        user_info = state.get("user_info", {})
        policy_details = state.get("policy_details", {})
        
        # Check information completeness
        has_basic_info = all(key in user_info for key in ["age", "gender", "smoking", "health"])
        has_policy_info = "policy_type" in policy_details and "coverage_amount" in policy_details
        
        # Check for recommendation request
        last_message = None
        for msg in reversed(state["messages"]):
            if isinstance(msg, HumanMessage):
                last_message = msg.content.lower()
                break
        
        is_recommendation_request = last_message and any(
            phrase in last_message for phrase in [
                "recommend", "suggest", "what plan", "which plan",
                "best plan", "suitable plan"
            ]
        )
        
        # Routing logic
        if current_stage == "greeting":
            return "collecting_info" if not has_basic_info else "policy_selection"
        elif current_stage == "collecting_info":
            return "policy_selection" if has_basic_info else "collecting_info"
        elif current_stage == "policy_selection":
            return "recommendation" if has_policy_info else "policy_selection"
        elif current_stage == "recommendation":
            return "followup"
        elif current_stage == "followup":
            if is_recommendation_request:
                return "recommendation"
            elif "goodbye" in last_message or "thank" in last_message:
                return "completed"
            return "followup"
        elif current_stage == "completed":
            return END
        
        return "greeting"

    def _get_or_create_user_state(self, user_id: str) -> Dict[str, Any]:
        """
        Get or create a persistent user state.
        
        Args:
            user_id: The user ID.
            
        Returns:
            The user state dictionary.
        """
        if user_id not in self.user_states:
            # Try to load from checkpoint first
            try:
                checkpoint_key = f"user_state_{user_id}"
                if self.memory_saver.exists(checkpoint_key):
                    saved_state = self.memory_saver.get(checkpoint_key)
                    self.user_states[user_id] = saved_state
                    print(f"Loaded user state from checkpoint for user {user_id}")
                else:
                    # Initialize new state if no checkpoint exists
                    self.user_states[user_id] = {
                        "user_info": {},
                        "policy_details": {},
                        "last_active": None,
                        "completed_stages": set(),
                        "recommendation_result": None,
                        "conversation_history": []  # Store a summary of past conversations
                    }
            except Exception as e:
                print(f"Error loading user state from checkpoint: {str(e)}")
                # Initialize new state if loading fails
                self.user_states[user_id] = {
                    "user_info": {},
                    "policy_details": {},
                    "last_active": None,
                    "completed_stages": set(),
                    "recommendation_result": None,
                    "conversation_history": []  # Store a summary of past conversations
                }
        
        # Update last active timestamp
        self.user_states[user_id]["last_active"] = datetime.now()
        
        return self.user_states[user_id]
    
    def _update_user_state(self, user_id: str, state: Dict[str, Any]):
        """Update the user state with the latest conversation state."""
        try:
            # Initialize user state if it doesn't exist
            if user_id not in self.user_states:
                self.user_states[user_id] = {
                    "user_info": {},
                    "policy_details": {},
                    "last_active": None,
                    "conversation_stage": None,
                    "recommendation_result": None,
                    "conversation_history": []
                }
            
            # Update user state with new information
            if isinstance(state, dict):
                if "user_info" in state:
                    self.user_states[user_id]["user_info"].update(state["user_info"] or {})
                
                if "policy_details" in state:
                    self.user_states[user_id]["policy_details"].update(state["policy_details"] or {})
                
                if "recommendation_result" in state:
                    self.user_states[user_id]["recommendation_result"] = state["recommendation_result"]
                
                if "conversation_stage" in state:
                    self.user_states[user_id]["conversation_stage"] = state["conversation_stage"]
                
                # Update last active timestamp
                self.user_states[user_id]["last_active"] = datetime.now().isoformat()
                
                # Update conversation history if there are messages
                if "messages" in state and len(state["messages"]) > 2:
                    try:
                        # Get the last exchange
                        last_messages = state["messages"][-2:]  # Get the last user message and AI response
                        user_message = None
                        ai_response = None
                        
                        for msg in last_messages:
                            if isinstance(msg, HumanMessage):
                                user_message = msg.content
                            elif isinstance(msg, AIMessage):
                                ai_response = msg.content
                        
                        if user_message and ai_response:
                            # Add to conversation history
                            self.user_states[user_id]["conversation_history"].append({
                                "user": user_message,
                                "assistant": ai_response,
                                "timestamp": datetime.now().isoformat(),
                                "stage": state.get("conversation_stage", "unknown")
                            })
                            
                            # Keep only the last 10 exchanges
                            if len(self.user_states[user_id]["conversation_history"]) > 10:
                                self.user_states[user_id]["conversation_history"] = self.user_states[user_id]["conversation_history"][-10:]
                    except Exception as e:
                        print(f"Error updating conversation history: {str(e)}")
            else:
                print(f"Warning: State is not a dictionary. Type: {type(state)}")
        
        except Exception as e:
            print(f"Error updating user state: {str(e)}")
            print(f"State type: {type(state)}")
            print(f"State content: {state}")
    
    def _initialize_conversation_state(self, user_id: str, user_details: Dict[str, Any] = None) -> CommunicationState:
        """
        Initialize the conversation state for a user, incorporating persistent user state and frontend details.
        
        Args:
            user_id: The user ID.
            user_details: Optional user details from the frontend onboarding form.
            
        Returns:
            The initialized conversation state.
        """
        # Get persistent user state
        user_state = self._get_or_create_user_state(user_id)
        
        # Initialize conversation state
        state = {
            "messages": [self.system_message],
            "user_info": user_state["user_info"].copy(),
            "policy_details": user_state["policy_details"].copy(),
            "recommendation_result": user_state["recommendation_result"],
            "conversation_stage": "greeting",
            "step_count": 0
        }
        
        # If user details are provided from the frontend, incorporate them
        if user_details:
            print(f"Incorporating user details from frontend for user {user_id}")
            self._incorporate_frontend_details(state, user_details)
        
        # Add context from previous conversations if available
        if user_state["conversation_history"]:
            try:
                # Create a context message summarizing previous interactions
                context_summary = "Previous conversation summary:\n"
                for i, exchange in enumerate(user_state["conversation_history"][-3:], 1):  # Get last 3 exchanges
                    context_summary += f"{i}. User: {exchange['user'][:50]}...\n   Assistant: {exchange['assistant'][:50]}...\n"
                
                # Add a system message with the context
                context_message = SystemMessage(content=f"""
                This user has interacted with you before. Here's a summary of your previous conversations:
                {context_summary}
                
                Remember to reference this history when appropriate to create a more personalized experience.
                Don't explicitly mention that you're recalling previous conversations unless the user asks.
                """)
                
                state["messages"].append(context_message)
                print(f"Added conversation history context for user {user_id}")
            except Exception as e:
                print(f"Error adding conversation history context: {str(e)}")
        
        # Determine the appropriate starting stage based on available information
        has_basic_info = all(key in state["user_info"] for key in ["age", "gender", "smoking", "health"])
        has_policy_info = "policy_type" in state["policy_details"] and "coverage_amount" in state["policy_details"]
        
        if has_basic_info and has_policy_info:
            print(f"User {user_id} has all required information. Starting at recommendation stage.")
            state["conversation_stage"] = "recommendation"
        elif has_basic_info:
            print(f"User {user_id} has all basic information. Starting at policy_selection stage.")
            state["conversation_stage"] = "policy_selection"
        
        return state
    
    def _incorporate_frontend_details(self, state: Dict[str, Any], user_details: Dict[str, Any]):
        """
        Incorporate user details from the frontend into the conversation state.
        
        Args:
            state: The conversation state to update.
            user_details: User details from the frontend onboarding form.
        """
        user_info = state["user_info"]
        policy_details = state["policy_details"]
        
        # Map frontend fields to our internal user_info structure
        if "age" in user_details:
            try:
                user_info["age"] = int(user_details["age"])
            except (ValueError, TypeError):
                user_info["age"] = user_details["age"]
        
        if "gender" in user_details:
            user_info["gender"] = user_details["gender"]
        
        if "smoker" in user_details:
            user_info["smoking"] = "no" if user_details["smoker"] == "No" else "yes"
        
        if "preExistingConditions" in user_details or "familyHistory" in user_details:
            health_conditions = []
            if user_details.get("preExistingConditions") == "Yes":
                health_conditions.append("Has pre-existing conditions")
            if user_details.get("familyHistory") == "Yes":
                health_conditions.append("Has family history of serious illnesses")
            
            if health_conditions:
                user_info["health"] = ", ".join(health_conditions)
            else:
                user_info["health"] = "No significant health issues reported"
        
        # Additional information that might be useful for personalization
        if "name" in user_details:
            user_info["name"] = user_details["name"]
        
        if "income" in user_details:
            user_info["income"] = user_details["income"]
        
        if "occupation" in user_details:
            user_info["occupation"] = user_details["occupation"]
        
        if "email" in user_details:
            user_info["email"] = user_details["email"]
        
        if "phone" in user_details:
            user_info["phone"] = user_details["phone"]
        
        # Extract policy details from user_details
        if "coverageAmount" in user_details:
            # Convert coverage amount to numeric value for the policy agent
            coverage_str = user_details["coverageAmount"]
            # Remove currency symbol and commas
            coverage_str = coverage_str.replace('₹', '').replace(',', '')
            try:
                # Try to extract numeric value
                coverage_match = re.search(r'(\d+)', coverage_str)
                if coverage_match:
                    coverage_amount = int(coverage_match.group(1))
                    policy_details["coverage_amount"] = coverage_amount
                    print(f"Successfully extracted coverage amount: {coverage_amount} from {user_details['coverageAmount']}")
            except (ValueError, TypeError) as e:
                # If conversion fails, store as is
                policy_details["coverage_amount"] = coverage_str
                print(f"Failed to convert coverage amount: {e}. Using as is: {coverage_str}")
        
        if "policyTerm" in user_details:
            try:
                policy_details["term_length"] = f"{int(user_details['policyTerm'])} years"
                print(f"Successfully extracted policy term: {policy_details['term_length']}")
            except (ValueError, TypeError) as e:
                policy_details["term_length"] = user_details["policyTerm"]
                print(f"Failed to convert policy term: {e}. Using as is: {user_details['policyTerm']}")
        
        # Default to Life insurance if not specified
        policy_details["policy_type"] = "Life"
        
        # Log the collected information
        print(f"User info collected from frontend: {user_info}")
        print(f"Policy details collected from frontend: {policy_details}")
    
    def invoke(self, message: str, user_id: str = "default_user", user_details: Dict[str, Any] = None) -> Dict[str, Any]:
        """Synchronously invoke the communication agent."""
        try:
            # Initialize or get conversation state
            state = self._get_or_create_conversation_state(user_id, user_details)
            
            # Add user message
            state["messages"].append(HumanMessage(content=message))
            
            # Run the graph with recursion limit
            try:
                result = self.graph.invoke(state)
            except Exception as e:
                if "recursion limit" in str(e).lower():
                    # Return the current state if we hit recursion limit
                    result = state
                else:
                    raise e
            
            # Update conversation history
            self.conversation_history[user_id] = result
            
            # Update user state
            self._update_user_state(user_id, result)
            
            # Return the last AI message
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage):
                    return {
                        "response": msg.content,
                        "conversation_stage": result["conversation_stage"]
                    }
            
            return {
                "response": "I apologize, but I couldn't generate a proper response. Please try again.",
                "conversation_stage": result["conversation_stage"]
            }
        
        except Exception as e:
            print(f"Error in synchronous invocation: {str(e)}")
            return {
                "response": "I apologize, but I encountered an error. Please try again.",
                "conversation_stage": "error"
            }

    def get_conversation_history(self, user_id: str) -> List[Dict[str, str]]:
        """Get the conversation history for a user."""
        if user_id not in self.conversation_history:
            return []
        
        history = []
        for msg in self.conversation_history[user_id]["messages"]:
            if isinstance(msg, (HumanMessage, AIMessage)):
                history.append({
                    "role": "user" if isinstance(msg, HumanMessage) else "assistant",
                    "content": msg.content
                })
        
        return history

    def _get_or_create_conversation_state(self, user_id: str, user_details: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get or create a conversation state for a user."""
        if user_id not in self.conversation_history:
            state = {
                "messages": [self.system_message],
                "user_info": {},
                "policy_details": {},
                "recommendation_result": None,
                "conversation_stage": "greeting",
                "step_count": 0,
                "remaining_steps": 50  # Initialize with maximum steps allowed
            }
            
            # Try to load from previous state
            try:
                if user_id in self.user_states:
                    saved_state = self.user_states[user_id]
                    state.update(saved_state)
                    state["remaining_steps"] = 50  # Reset remaining steps for new conversation
            except Exception as e:
                print(f"Error loading previous state: {str(e)}")
            
            self.conversation_history[user_id] = state
        
        # Update with user details if provided
        if user_details:
            self._incorporate_user_details(self.conversation_history[user_id], user_details)
        
        return self.conversation_history[user_id]

    def _incorporate_user_details(self, state: Dict[str, Any], user_details: Dict[str, Any]):
        """Incorporate user details from external sources into the conversation state."""
        user_info = state["user_info"]
        policy_details = state["policy_details"]
        
        # Map user details to internal format
        field_mapping = {
            "age": "age",
            "gender": "gender",
            "smoker": ("smoking", lambda x: "yes" if x == "Yes" else "no"),
            "preExistingConditions": ("health", lambda x: "Has pre-existing conditions" if x == "Yes" else "No significant health issues"),
            "occupation": "occupation",
            "income": "income",
            "name": "name",
            "email": "email",
            "phone": "phone"
        }
        
        for external_key, internal_key in field_mapping.items():
            if external_key in user_details:
                if isinstance(internal_key, tuple):
                    key, transform = internal_key
                    user_info[key] = transform(user_details[external_key])
                else:
                    user_info[internal_key] = user_details[external_key]
        
        # Handle policy details
        if "coverageAmount" in user_details:
            try:
                amount = user_details["coverageAmount"].replace("₹", "").replace(",", "")
                policy_details["coverage_amount"] = int(amount)
            except ValueError:
                policy_details["coverage_amount"] = user_details["coverageAmount"]
        
        if "policyTerm" in user_details:
            policy_details["term_length"] = f"{user_details['policyTerm']} years"

    async def invoke_async(self, message: str, user_id: str = "default_user", user_details: Dict[str, Any] = None) -> Dict[str, Any]:
        """Asynchronously invoke the communication agent."""
        try:
            print(f"Starting async invocation for user {user_id}")
            print(f"Processing message: {message}")
            print(f"User details: {user_details}")
            
            # Convert user_details to match expected format
            if user_details:
                formatted_details = {
                    "name": user_details.get("name"),
                    "age": user_details.get("age"),
                    "smoking": "yes" if user_details.get("smoking_status") == "smoker" else "no",
                    "health": user_details.get("health_status", "unknown"),
                    "occupation": user_details.get("occupation"),
                    "income": user_details.get("income"),
                    "email": user_details.get("email"),
                    "phone": user_details.get("phone")
                }
                print(f"Formatted user details: {formatted_details}")
            else:
                formatted_details = None
            
            # Initialize or get conversation state
            state = self._get_or_create_conversation_state(user_id, formatted_details)
            print(f"Initial state: {state}")
            
            # Add user message
            state["messages"].append(HumanMessage(content=message))
            
            # Run the graph with recursion limit
            try:
                print("Invoking conversation graph")
                result = await self.graph.ainvoke(state)
                print(f"Graph result: {result}")
            except Exception as e:
                print(f"Error in graph invocation: {str(e)}")
                if "recursion limit" in str(e).lower():
                    print("Hit recursion limit, using current state")
                    result = state
                else:
                    raise e
            
            # Update conversation history
            self.conversation_history[user_id] = result
            
            # Update user state
            self._update_user_state(user_id, result)
            
            # Return the last AI message
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage):
                    response = {
                        "response": msg.content,
                        "conversation_stage": result.get("conversation_stage", "greeting")
                    }
                    print(f"Returning response: {response}")
                    return response
            
            print("No AI message found in result, returning default response")
            return {
                "response": "I apologize, but I couldn't generate a proper response. Please try again.",
                "conversation_stage": result.get("conversation_stage", "greeting")
            }
        
        except Exception as e:
            print(f"Error in async invocation: {str(e)}")
            print(f"Full traceback: {traceback.format_exc()}")
            return {
                "response": "I apologize, but I encountered an error. Please try again.",
                "conversation_stage": "error"
            }

    def _create_greeting_prompt(self, user_info: Dict[str, Any], has_basic_info: bool, is_returning_user: bool) -> str:
        """Create a personalized greeting prompt."""
        prompt = f"""
        The user has just started a conversation. Create a warm, professional greeting that:
        1. Uses their name if available ({user_info.get('name', 'the user')})
        2. Acknowledges their return if applicable (Returning user: {is_returning_user})
        3. References any information we already have:
        {json.dumps(user_info, indent=2)}
        
        If we have basic information ({has_basic_info}), mention we can proceed to policy selection.
        If we're missing information, explain we'll need some basic details first.
        
        Keep the tone professional but conversational, showing you understand their insurance needs.
        """
        return prompt

    def _create_collection_prompt(self, user_info: Dict[str, Any], missing_fields: List[str]) -> str:
        """Create a prompt for collecting missing information."""
        prompt = f"""
        We need to collect some essential information. Current user info:
        {json.dumps(user_info, indent=2)}
        
        Missing fields: {', '.join(missing_fields)}
        
        Create a response that:
        1. Acknowledges information we already have
        2. Naturally asks for missing information
        3. Explains why this information is important
        4. Maintains a conversational flow
        
        DO NOT ask for information we already have.
        """
        return prompt

    def _create_policy_selection_prompt(self, user_info: Dict[str, Any], policy_details: Dict[str, Any]) -> str:
        """Create a prompt for policy selection."""
        prompt = f"""
        Help the user select an appropriate policy type and coverage amount.
        
        User Information:
        {json.dumps(user_info, indent=2)}
        
        Current Policy Preferences:
        {json.dumps(policy_details, indent=2)}
        
        Create a response that:
        1. Explains different policy types clearly
        2. Suggests appropriate coverage amounts based on their profile
        3. Asks about specific preferences
        4. Maintains a helpful, advisory tone
        """
        return prompt

    def _create_recommendation_prompt(self, user_info: Dict[str, Any], recommendation: Dict[str, Any]) -> str:
        """Create a prompt for presenting recommendations."""
        prompt = f"""
        Present the policy recommendation to the user.
        
        User Profile:
        {json.dumps(user_info, indent=2)}
        
        Recommendation Details:
        {json.dumps(recommendation, indent=2)}
        
        Create a response that:
        1. Clearly presents the recommended policy
        2. Explains why it's suitable for their needs
        3. Highlights key benefits and features
        4. Mentions alternative options
        5. Invites questions about the recommendation
        """
        return prompt

    def _create_followup_prompt(self, user_info: Dict[str, Any], policy_details: Dict[str, Any], recommendation: Dict[str, Any]) -> str:
        """Create a prompt for follow-up discussion."""
        prompt = f"""
        Continue the discussion about the recommended policy.
        
        Context:
        - User Info: {json.dumps(user_info, indent=2)}
        - Policy Details: {json.dumps(policy_details, indent=2)}
        - Recommendation: {json.dumps(recommendation, indent=2)}
        
        Create a response that:
        1. Addresses any questions or concerns
        2. Provides additional relevant information
        3. Explains next steps if they're interested
        4. Maintains an engaging conversation
        """
        return prompt

    def _create_fallback_prompt(self, user_info: Dict[str, Any]) -> str:
        """Create a prompt for fallback responses."""
        prompt = f"""
        We encountered an issue while generating recommendations.
        
        User Information:
        {json.dumps(user_info, indent=2)}
        
        Create a response that:
        1. Acknowledges the situation professionally
        2. Explains we need a moment to process
        3. Asks if they have specific questions
        4. Maintains trust and professionalism
        """
        return prompt

    def _extract_user_info(self, message: str, current_info: Dict[str, Any]) -> Dict[str, Any]:
        """Extract user information from messages."""
        updated_info = current_info.copy()
        
        try:
            # Look for JSON in the message
            json_match = re.search(r'```json\n(.*?)\n```', message, re.DOTALL)
            if json_match:
                extracted_info = json.loads(json_match.group(1))
                updated_info.update(extracted_info)
            
            # Extract specific patterns
            patterns = {
                'age': r'age[:\s]+(\d+)',
                'gender': r'gender[:\s]+(male|female)',
                'smoking': r'smok(er|ing)[:\s]+(yes|no)',
                'health': r'health[:\s]+(excellent|good|fair|poor)',
            }
            
            for key, pattern in patterns.items():
                match = re.search(pattern, message.lower())
                if match and key not in updated_info:
                    updated_info[key] = match.group(1)
        
        except Exception as e:
            print(f"Error extracting user info: {str(e)}")
        
        return updated_info

    def _extract_policy_details(self, message: str, current_details: Dict[str, Any]) -> Dict[str, Any]:
        """Extract policy details from messages."""
        updated_details = current_details.copy()
        
        try:
            # Look for JSON in the message
            json_match = re.search(r'```json\n(.*?)\n```', message, re.DOTALL)
            if json_match:
                extracted_details = json.loads(json_match.group(1))
                updated_details.update(extracted_details)
            
            # Extract specific patterns
            patterns = {
                'policy_type': r'(term|whole|universal) life',
                'coverage_amount': r'(\d+(?:,\d+)*) (?:lakhs?|crores?|million)',
                'term_length': r'(\d+) years?',
            }
            
            for key, pattern in patterns.items():
                match = re.search(pattern, message.lower())
                if match and key not in updated_details:
                    updated_details[key] = match.group(1)
            
            # Convert coverage amount to standard format
            if 'coverage_amount' in updated_details:
                amount = updated_details['coverage_amount']
                if 'lakh' in str(amount):
                    amount = float(str(amount).replace('lakh', '')) * 100000
                elif 'crore' in str(amount):
                    amount = float(str(amount).replace('crore', '')) * 10000000
                updated_details['coverage_amount'] = int(amount)
        
        except Exception as e:
            print(f"Error extracting policy details: {str(e)}")
        
        return updated_details


