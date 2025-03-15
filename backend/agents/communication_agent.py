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
from  utils.useLLM import UseLLM
from  agents.policy_recommendation_agent import PolicyRecommendationAgent
from  agents.risk_assesment_agent import RiskAssessmentAgent
from  agents.premium_calculation_agent import PremiumCalculationAgent
import concurrent.futures

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

class CommunicationAgent:
    """
    Agent responsible for handling communication with the client and coordinating with other agents.
    """
    
    def __init__(self, llm_utility: UseLLM):
        """
        Initialize the communication agent.
        
        Args:
            llm_utility: The LLM utility to use for interacting with language models.
        """
        self.llm_utility = llm_utility
        self.llm = llm_utility.get_llm()
        
        # Create the other agents lazily - only when needed
        self._risk_agent = None
        self._premium_agent = None
        self._policy_agent = None
        
        self.system_message = llm_utility.create_system_message(
            """You are a friendly insurance advisor for a life insurance company.
            Your job is to help clients find the right life insurance policy for their needs.
            
            IMPORTANT PROCESS:
            1. ALWAYS collect client information first (age, gender, health status, smoking habits)
            2. Then ask about policy preferences (type, coverage amount)
            3. Only after collecting this information, provide personalized recommendations
            
            NEVER skip directly to recommendations without first collecting basic client information.
            If a client asks for recommendations immediately, politely explain that you need some basic information first to provide personalized advice.
            
            Be conversational, professional, and concise in your responses.
            Do not mention internal processes or other agents in your responses.
            """
        )
        
        self.conversation_history = {}  # Store conversation history by user ID
        
        # Create the graph
        self.graph = self._create_graph()
        
        # Create a thread pool for parallel operations
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
        """
        Create the graph for the communication agent.
        
        Returns:
            The compiled graph.
        """
        # Define the nodes
        def greeting(state: CommunicationState) -> CommunicationState:
            """
            Greet the user and explain the process.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state.
            """
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                The user has just started a conversation. Greet them warmly and explain that you'll help them find the right life insurance policy.
                Ask for their basic information like age, gender, and whether they smoke.
                Be conversational and friendly, but get straight to the point.
                
                IMPORTANT: Do NOT provide any policy recommendations yet - we need to collect their information first.
                Even if the user asks for recommendations immediately, explain that you need some basic information first to provide personalized recommendations.
                
                User message: {last_message.content}
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Update the state
            return {
                "messages": state["messages"] + [response],
                "user_info": {},
                "policy_details": {},
                "recommendation_result": None,
                "conversation_stage": "collecting_info",
                "step_count": state.get("step_count", 0) + 1
            }
        
        def collect_info(state: CommunicationState) -> CommunicationState:
            """
            Collect information from the user.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state.
            """
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Extract user information from the message
            user_info = state["user_info"] or {}
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                You are collecting information from the user to provide a life insurance policy recommendation.
                
                Current information we have:
                {user_info}
                
                Extract any new information from the user's message and update our understanding.
                We need ALL of the following information before proceeding:
                - age (numeric)
                - gender (male/female)
                - smoking status (yes/no)
                - health conditions (any major conditions)
                
                If we don't have ALL of this information, ask for the missing details specifically.
                Be conversational but direct in your questions.
                
                User message: {last_message.content}
                
                First, analyze what information we can extract from this message. Then respond to the user.
                Format your analysis as JSON that we can use to update our user_info dictionary.
                """
                )
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Try to extract structured information from the response
            try:
                import json
                import re
                
                # Look for JSON in the response
                json_match = re.search(r'```json\n(.*?)\n```', response.content, re.DOTALL)
                if json_match:
                    extracted_info = json.loads(json_match.group(1))
                    # Update user_info with extracted information
                    user_info.update(extracted_info)
                
                # Determine if we have enough information to move to policy selection
                # Require all essential fields
                required_fields = ["age", "gender", "smoking", "health"]
                has_basic_info = all(key in user_info for key in required_fields)
                
                # Additional validation - age should be numeric
                if "age" in user_info and not isinstance(user_info["age"], (int, float)):
                    try:
                        user_info["age"] = int(user_info["age"])
                    except (ValueError, TypeError):
                        has_basic_info = False  # Invalid age format
                
                # Update the state
                next_stage = "policy_selection" if has_basic_info else "collecting_info"
                
                # Debug logging
                if has_basic_info:
                    print(f"User {id(state)} has provided all required information. Moving to {next_stage}")
                else:
                    missing = [field for field in required_fields if field not in user_info]
                    print(f"User {id(state)} is missing information: {missing}. Staying in collecting_info stage")
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": user_info,
                    "policy_details": state["policy_details"],
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": next_stage,
                    "step_count": state.get("step_count", 0) + 1
                }
            except Exception as e:
                # If parsing fails, continue collecting information
                print(f"Error parsing user information: {str(e)}")
                return {
                    "messages": state["messages"] + [response],
                    "user_info": user_info,
                    "policy_details": state["policy_details"],
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": "collecting_info",
                    "step_count": state.get("step_count", 0) + 1
                }
        
        def policy_selection(state: CommunicationState) -> CommunicationState:
            """
            Help the user select a policy type and coverage amount.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state.
            """
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Extract policy details from the message
            policy_details = state["policy_details"] or {}
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                You are helping the user select a policy type and coverage amount.
                
                Current user information:
                {state["user_info"]}
                
                Current policy details:
                {policy_details}
                
                Extract any policy preferences from the user's message and update our understanding.
                If we have enough information (policy_type, coverage_amount), suggest getting a recommendation.
                If we don't have enough information, explain the different policy types (Term Life, Whole Life, Universal Life)
                and ask about their coverage needs.
                Be conversational but direct in your explanations and questions.
                
                User message: {last_message.content}
                
                First, analyze what policy information we can extract from this message. Then respond to the user.
                Format your analysis as JSON that we can use to update our policy_details dictionary.
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Try to extract structured information from the response
            try:
                import json
                import re
                
                # Look for JSON in the response
                json_match = re.search(r'```json\n(.*?)\n```', response.content, re.DOTALL)
                if json_match:
                    extracted_info = json.loads(json_match.group(1))
                    # Update policy_details with extracted information
                    policy_details.update(extracted_info)
                
                # Determine if we have enough information to move to recommendation
                has_policy_info = all(key in policy_details for key in ["policy_type", "coverage_amount"])
                
                # Update the state
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": policy_details,
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": "recommendation" if has_policy_info else "policy_selection",
                    "step_count": state.get("step_count", 0) + 1
                }
            except Exception as e:
                # If parsing fails, continue policy selection
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": policy_details,
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": "policy_selection",
                    "step_count": state.get("step_count", 0) + 1
                }
        
        def get_recommendation(state: CommunicationState) -> CommunicationState:
            """
            Get policy recommendations from the policy recommendation agent.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state.
            """
            # Get recommendation from policy agent
            recommendation_result = self.policy_agent.invoke(
                state["user_info"],
                state["policy_details"]
            )
            
            # Create a message for the LLM to format the recommendation
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                Based on the user's information and policy preferences, we have the following recommendation:
                
                Risk Assessment:
                - Risk Score: {recommendation_result["risk_assessment"].get("risk_score")}
                - Risk Factors: {recommendation_result["risk_assessment"].get("risk_factors")}
                
                Premium Calculation:
                - Annual Premium: ${recommendation_result["premium_calculation"].get("annual_premium")}
                - Monthly Premium: ${recommendation_result["premium_calculation"].get("monthly_premium")}
                
                Policy Recommendation:
                - Recommended Policy: {recommendation_result["policy_recommendation"]["recommended_policy"]["policy_type"]}
                - Coverage Amount: ${recommendation_result["policy_recommendation"]["recommended_policy"]["coverage_amount"]}
                - Term Length: {recommendation_result["policy_recommendation"]["recommended_policy"]["term_length"]} years
                - Premium: ${recommendation_result["policy_recommendation"]["recommended_policy"]["premium"]}
                - Recommended Riders: {recommendation_result["policy_recommendation"]["recommended_policy"]["recommended_riders"]}
                
                Alternative Policies:
                {recommendation_result["policy_recommendation"]["alternative_policies"]}
                
                Explanation:
                {recommendation_result["policy_recommendation"]["explanation"]}
                
                Present this information to the user in a clear, friendly, and professional manner.
                Explain the recommendation and why it's suitable for them based on their risk profile and needs.
                Ask if they have any questions or if they'd like to proceed with the recommended policy.
                Do not mention internal processes or other agents in your response.
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Update the state
            return {
                "messages": state["messages"] + [response],
                "user_info": state["user_info"],
                "policy_details": state["policy_details"],
                "recommendation_result": recommendation_result,
                "conversation_stage": "followup",
                "step_count": state.get("step_count", 0) + 1
            }
        
        def followup(state: CommunicationState) -> CommunicationState:
            """
            Follow up with the user after providing recommendations.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state.
            """
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                The user has received our policy recommendation. Respond to their follow-up question or comment.
                
                If they want to proceed with the policy, explain the next steps (e.g., application process, medical exam if needed).
                If they have questions about the recommendation, answer them based on the information we have.
                If they want to explore other options, suggest alternatives from our recommendation.
                Be conversational, helpful, and concise in your response.
                
                User message: {last_message.content}
                
                Our recommendation details:
                {state["recommendation_result"]}
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Check if the conversation is complete
            is_complete = "thank you" in last_message.content.lower() or "goodbye" in last_message.content.lower()
            
            # Update the state
            return {
                "messages": state["messages"] + [response],
                "user_info": state["user_info"],
                "policy_details": state["policy_details"],
                "recommendation_result": state["recommendation_result"],
                "conversation_stage": "completed" if is_complete else "followup",
                "step_count": state.get("step_count", 0) + 1
            }
        
        # Define the router function
        def router(state: CommunicationState) -> Literal["greeting", "collecting_info", "policy_selection", "recommendation", "followup", "completed", END]:
            """
            Route the conversation to the appropriate stage.
            
            Args:
                state: The current state.
                
            Returns:
                The next stage to route to.
            """
            # Check if we've exceeded a reasonable number of steps
            if state.get("step_count", 0) > 20:
                return END
            
            # For new conversations, ensure we don't skip stages
            if state.get("step_count", 0) <= 1:
                # If this is the first or second step, we should be in greeting or collecting_info
                current_stage = state["conversation_stage"]
                if current_stage == "greeting":
                    return "greeting"
                else:
                    return "collecting_info"
                
            # Check if we're in a potential loop by examining the last few messages
            # If we have more than 10 messages and the last 3 stages are the same, move to the next stage
            messages = state["messages"]
            if len(messages) > 10:
                # Get the current stage
                current_stage = state["conversation_stage"]
                
                # If we've been in the same stage for too long, progress to the next stage
                if current_stage == "greeting":
                    return "collecting_info"
                elif current_stage == "collecting_info":
                    return "policy_selection"
                elif current_stage == "policy_selection":
                    return "recommendation"
                elif current_stage == "recommendation":
                    return "followup"
                elif current_stage == "followup":
                    return "completed"
            
            # Normal routing logic
            if state["conversation_stage"] == "greeting":
                return "greeting"
            elif state["conversation_stage"] == "collecting_info":
                return "collecting_info"
            elif state["conversation_stage"] == "policy_selection":
                return "policy_selection"
            elif state["conversation_stage"] == "recommendation":
                return "recommendation"
            elif state["conversation_stage"] == "followup":
                return "followup"
            elif state["conversation_stage"] == "completed":
                return END
            else:
                return "greeting"
        
        # Create the graph
        builder = StateGraph(CommunicationState)
        
        # Add nodes
        builder.add_node("greeting", greeting)
        builder.add_node("collecting_info", collect_info)
        builder.add_node("policy_selection", policy_selection)
        builder.add_node("recommendation", get_recommendation)
        builder.add_node("followup", followup)
        
        # Set the entry point
        builder.set_entry_point("greeting")
        
        # Add conditional edges
        builder.add_conditional_edges(
            "greeting",
            router,
            {
                "greeting": "greeting",
                "collecting_info": "collecting_info",
                "policy_selection": "policy_selection",
                "recommendation": "recommendation",
                "followup": "followup",
                "completed": END
            }
        )
        
        builder.add_conditional_edges(
            "collecting_info",
            router,
            {
                "greeting": "greeting",
                "collecting_info": "collecting_info",
                "policy_selection": "policy_selection",
                "recommendation": "recommendation",
                "followup": "followup",
                "completed": END
            }
        )
        
        builder.add_conditional_edges(
            "policy_selection",
            router,
            {
                "greeting": "greeting",
                "collecting_info": "collecting_info",
                "policy_selection": "policy_selection",
                "recommendation": "recommendation",
                "followup": "followup",
                "completed": END
            }
        )
        
        builder.add_conditional_edges(
            "recommendation",
            router,
            {
                "greeting": "greeting",
                "collecting_info": "collecting_info",
                "policy_selection": "policy_selection",
                "recommendation": "recommendation",
                "followup": "followup",
                "completed": END
            }
        )
        
        builder.add_conditional_edges(
            "followup",
            router,
            {
                "greeting": "greeting",
                "collecting_info": "collecting_info",
                "policy_selection": "policy_selection",
                "recommendation": "recommendation",
                "followup": "followup",
                "completed": END
            }
        )
        
        # Compile the graph with optimized settings
        return builder.compile()
    
    async def invoke_async(self, message: str, user_id: str = "default_user", user_details: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Asynchronously invoke the communication agent with a user message.
        
        Args:
            message: The user message.
            user_id: The user ID.
            user_details: Optional user details from the frontend onboarding form.
            
        Returns:
            The response from the agent.
        """
        # Get or initialize conversation history
        if user_id not in self.conversation_history:
            print(f"Initializing new conversation for user {user_id}")
            self.conversation_history[user_id] = {
                "messages": [self.system_message],
                "user_info": {},  # Initialize as empty dict instead of None
                "policy_details": {},  # Initialize as empty dict instead of None
                "recommendation_result": None,
                "conversation_stage": "greeting",
                "step_count": 0  # Initialize step count
            }
            
            # If user details are provided from the frontend, incorporate them
            if user_details:
                print(f"Incorporating user details from frontend for user {user_id}")
                user_info = self.conversation_history[user_id]["user_info"]
                
                # Map frontend fields to our internal user_info structure
                if "age" in user_details:
                    try:
                        user_info["age"] = int(user_details["age"])
                    except (ValueError, TypeError):
                        user_info["age"] = user_details["age"]
                
                if "gender" in user_details:
                    user_info["gender"] = user_details["gender"]
                
                if "smoker" in user_details:
                    user_info["smoking"] = "yes" if user_details["smoker"] == "Yes" else "no"
                
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
                
                # Log the collected information
                print(f"User info collected from frontend: {user_info}")
        
        # Check if this is a general question that needs a quick response
        is_general_question = self._is_general_question(message)
        
        # Add user message to history
        user_message = HumanMessage(content=message)
        self.conversation_history[user_id]["messages"].append(user_message)
        
        # Debug: Print current conversation stage
        print(f"Before async graph execution - User: {user_id}, Stage: {self.conversation_history[user_id]['conversation_stage']}")
        
        # For general questions, provide a quick response without running the full graph
        if is_general_question and self.conversation_history[user_id]["step_count"] <= 1:
            try:
                # Generate a quick response directly
                quick_response = await self._generate_quick_response(message, user_id)
                
                # Update conversation history
                self.conversation_history[user_id]["messages"].append(quick_response)
                self.conversation_history[user_id]["step_count"] += 1
                
                return {
                    "response": quick_response.content,
                    "conversation_stage": "collecting_info"
                }
            except Exception as e:
                print(f"Error generating quick response: {str(e)}")
                # Continue with normal flow if quick response fails
        
        try:
            # Run the graph with increased recursion limit and optimized settings
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                lambda: self.graph.invoke(
                    self.conversation_history[user_id],
                    {
                        "recursion_limit": 50,  # Increase recursion limit from default 25 to 50
                        "max_concurrency": MAX_CONCURRENCY  # Limit concurrent operations
                    }
                )
            )
            
            # Debug: Print resulting conversation stage
            print(f"After async graph execution - User: {user_id}, Stage: {result['conversation_stage']}")
            
            # Ensure proper conversation flow - don't skip stages for new conversations
            if (self.conversation_history[user_id]["step_count"] <= 1 and 
                result["conversation_stage"] not in ["greeting", "collecting_info"]):
                print(f"Warning: Conversation jumped to {result['conversation_stage']} too quickly. Resetting to collecting_info.")
                result["conversation_stage"] = "collecting_info"
                
                # Force a proper greeting/info collection response
                for msg in reversed(result["messages"]):
                    if isinstance(msg, AIMessage):
                        # Replace the last AI message with a proper greeting
                        greeting_msg = self.llm.invoke([
                            self.system_message,
                            HumanMessage(content=f"""
                            The user has just started a conversation with the message: "{message}"
                            
                            User details we already have:
                            {self.conversation_history[user_id]["user_info"]}
                            
                            Greet them warmly by name if available, and explain that you'll help them find the right life insurance policy.
                            If we're missing any essential information (age, gender, smoking status, health), ask for it.
                            If we have all the essential information, ask about their insurance needs and preferences.
                            Be conversational and friendly, but get straight to the point.
                            DO NOT provide any policy recommendations yet unless we have all required information.
                            """)
                        ])
                        
                        # Replace the last message
                        result["messages"] = list(result["messages"])
                        result["messages"][-1] = greeting_msg
                        break
            
            # Update conversation history
            self.conversation_history[user_id] = result
            
            # Return the last AI message
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage):
                    return {
                        "response": msg.content,
                        "conversation_stage": result["conversation_stage"]
                    }
            
            # Fallback if no AI message is found
            return {
                "response": "I'm sorry, I couldn't process your request. Please try again.",
                "conversation_stage": result["conversation_stage"]
            }
        except Exception as e:
            # Handle any errors, including recursion limit errors and '__end__' errors
            print(f"Error in communication agent: {str(e)}")
            
            # For new conversations, provide a proper greeting response
            if self.conversation_history[user_id]["step_count"] <= 1:
                try:
                    # Generate a greeting response directly
                    greeting_msg = self.llm.invoke([
                        self.system_message,
                        HumanMessage(content=f"""
                        The user has just started a conversation with the message: "{message}"
                        
                        User details we already have:
                        {self.conversation_history[user_id]["user_info"]}
                        
                        Greet them warmly by name if available, and explain that you'll help them find the right life insurance policy.
                        If we're missing any essential information (age, gender, smoking status, health), ask for it.
                        If we have all the essential information, ask about their insurance needs and preferences.
                        Be conversational and friendly, but get straight to the point.
                        DO NOT provide any policy recommendations yet unless we have all required information.
                        """)
                    ])
                    
                    # Update conversation history with this message
                    self.conversation_history[user_id]["messages"].append(greeting_msg)
                    self.conversation_history[user_id]["step_count"] += 1
                    self.conversation_history[user_id]["conversation_stage"] = "collecting_info"
                    
                    return {
                        "response": greeting_msg.content,
                        "conversation_stage": "collecting_info"
                    }
                except Exception as inner_e:
                    print(f"Error generating greeting: {str(inner_e)}")
            
            # Default fallback response
            return {
                "response": "Hello! I'm your friendly insurance advisor. I can help you find the right life insurance policy for your needs. To get started, could you please tell me a bit about yourself? I'd like to know your age, gender, and whether you smoke. This information will help me provide personalized recommendations for you.",
                "conversation_stage": "collecting_info"
            }
    
    def invoke(self, message: str, user_id: str = "default_user", user_details: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Invoke the communication agent with a user message.
        
        Args:
            message: The user message.
            user_id: The user ID.
            user_details: Optional user details from the frontend onboarding form.
            
        Returns:
            The response from the agent.
        """
        # Get or initialize conversation history
        if user_id not in self.conversation_history:
            print(f"Initializing new conversation for user {user_id}")
            self.conversation_history[user_id] = {
                "messages": [self.system_message],
                "user_info": {},  # Initialize as empty dict instead of None
                "policy_details": {},  # Initialize as empty dict instead of None
                "recommendation_result": None,
                "conversation_stage": "greeting",
                "step_count": 0  # Initialize step count
            }
            
            # If user details are provided from the frontend, incorporate them
            if user_details:
                print(f"Incorporating user details from frontend for user {user_id}")
                user_info = self.conversation_history[user_id]["user_info"]
                
                # Map frontend fields to our internal user_info structure
                if "age" in user_details:
                    try:
                        user_info["age"] = int(user_details["age"])
                    except (ValueError, TypeError):
                        user_info["age"] = user_details["age"]
                
                if "gender" in user_details:
                    user_info["gender"] = user_details["gender"]
                
                if "smoker" in user_details:
                    user_info["smoking"] = "yes" if user_details["smoker"] == "Yes" else "no"
                
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
                
                # Log the collected information
                print(f"User info collected from frontend: {user_info}")
        
        # Check if this is a general question that needs a quick response
        is_general_question = self._is_general_question(message)
        
        # Add user message to history
        user_message = HumanMessage(content=message)
        self.conversation_history[user_id]["messages"].append(user_message)
        
        # Debug: Print current conversation stage
        print(f"Before graph execution - User: {user_id}, Stage: {self.conversation_history[user_id]['conversation_stage']}")
        
        # For general questions, provide a quick response without running the full graph
        if is_general_question and self.conversation_history[user_id]["step_count"] <= 1:
            try:
                # Generate a quick response directly
                quick_response = self._generate_quick_response_sync(message, user_id)
                
                # Update conversation history
                self.conversation_history[user_id]["messages"].append(quick_response)
                self.conversation_history[user_id]["step_count"] += 1
                
                return {
                    "response": quick_response.content,
                    "conversation_stage": "collecting_info"
                }
            except Exception as e:
                print(f"Error generating quick response: {str(e)}")
                # Continue with normal flow if quick response fails
        
        try:
            # Run the graph with increased recursion limit and optimized settings
            result = self.graph.invoke(
                self.conversation_history[user_id],
                {
                    "recursion_limit": 50,  # Increase recursion limit from default 25 to 50
                    "max_concurrency": MAX_CONCURRENCY  # Limit concurrent operations
                }
            )
            
            # Debug: Print resulting conversation stage
            print(f"After graph execution - User: {user_id}, Stage: {result['conversation_stage']}")
            
            # Ensure proper conversation flow - don't skip stages for new conversations
            if (self.conversation_history[user_id]["step_count"] <= 1 and 
                result["conversation_stage"] not in ["greeting", "collecting_info"]):
                print(f"Warning: Conversation jumped to {result['conversation_stage']} too quickly. Resetting to collecting_info.")
                result["conversation_stage"] = "collecting_info"
                
                # Force a proper greeting/info collection response
                for msg in reversed(result["messages"]):
                    if isinstance(msg, AIMessage):
                        # Replace the last AI message with a proper greeting
                        greeting_msg = self.llm.invoke([
                            self.system_message,
                            HumanMessage(content=f"""
                            The user has just started a conversation with the message: "{message}"
                            
                            User details we already have:
                            {self.conversation_history[user_id]["user_info"]}
                            
                            Greet them warmly by name if available, and explain that you'll help them find the right life insurance policy.
                            If we're missing any essential information (age, gender, smoking status, health), ask for it.
                            If we have all the essential information, ask about their insurance needs and preferences.
                            Be conversational and friendly, but get straight to the point.
                            DO NOT provide any policy recommendations yet unless we have all required information.
                            """)
                        ])
                        
                        # Replace the last message
                        result["messages"] = list(result["messages"])
                        result["messages"][-1] = greeting_msg
                        break
            
            # Update conversation history
            self.conversation_history[user_id] = result
            
            # Return the last AI message
            for msg in reversed(result["messages"]):
                if isinstance(msg, AIMessage):
                    return {
                        "response": msg.content,
                        "conversation_stage": result["conversation_stage"]
                    }
            
            # Fallback if no AI message is found
            return {
                "response": "I'm sorry, I couldn't process your request. Please try again.",
                "conversation_stage": result["conversation_stage"]
            }
        except Exception as e:
            # Handle any errors, including recursion limit errors and '__end__' errors
            print(f"Error in communication agent: {str(e)}")
            
            # For new conversations, provide a proper greeting response
            if self.conversation_history[user_id]["step_count"] <= 1:
                try:
                    # Generate a greeting response directly
                    greeting_msg = self.llm.invoke([
                        self.system_message,
                        HumanMessage(content=f"""
                        The user has just started a conversation with the message: "{message}"
                        
                        User details we already have:
                        {self.conversation_history[user_id]["user_info"]}
                        
                        Greet them warmly by name if available, and explain that you'll help them find the right life insurance policy.
                        If we're missing any essential information (age, gender, smoking status, health), ask for it.
                        If we have all the essential information, ask about their insurance needs and preferences.
                        Be conversational and friendly, but get straight to the point.
                        DO NOT provide any policy recommendations yet unless we have all required information.
                        """)
                    ])
                    
                    # Update conversation history with this message
                    self.conversation_history[user_id]["messages"].append(greeting_msg)
                    self.conversation_history[user_id]["step_count"] += 1
                    self.conversation_history[user_id]["conversation_stage"] = "collecting_info"
                    
                    return {
                        "response": greeting_msg.content,
                        "conversation_stage": "collecting_info"
                    }
                except Exception as inner_e:
                    print(f"Error generating greeting: {str(inner_e)}")
            
            # Default fallback response
            return {
                "response": "Hello! I'm your friendly insurance advisor. I can help you find the right life insurance policy for your needs. To get started, could you please tell me a bit about yourself? I'd like to know your age, gender, and whether you smoke. This information will help me provide personalized recommendations for you.",
                "conversation_stage": "collecting_info"
            }
    
    def _is_general_question(self, message: str) -> bool:
        """
        Determine if a message is a general question that should get a quick response.
        
        Args:
            message: The user message.
            
        Returns:
            True if the message is a general question, False otherwise.
        """
        # Convert to lowercase for case-insensitive matching
        message_lower = message.lower()
        
        # List of common greetings and general questions
        general_patterns = [
            "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening",
            "what can you do", "how can you help", "what do you do", "who are you",
            "what is this", "how does this work", "tell me about", "explain",
            "thanks", "thank you", "appreciate it"
        ]
        
        # Check if the message contains any of the general patterns
        for pattern in general_patterns:
            if pattern in message_lower:
                return True
        
        # Check if the message is very short (likely a greeting)
        if len(message_lower.split()) <= 5:
            return True
        
        return False
    
    async def _generate_quick_response(self, message: str, user_id: str) -> AIMessage:
        """
        Generate a quick response for general questions without running the full graph.
        
        Args:
            message: The user message.
            user_id: The user ID.
            
        Returns:
            An AI message with the quick response.
        """
        user_info = self.conversation_history[user_id]["user_info"]
        user_name = user_info.get("name", "")
        
        # Create a message for the LLM
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            The user has sent a general message: "{message}"
            
            User details we already have:
            {user_info}
            
            Provide a quick, friendly response that:
            1. Greets them by name if available
            2. Briefly explains that you're an insurance advisor who can help find the right life insurance policy
            3. Mentions 2-3 specific ways you can help (e.g., comparing policies, explaining terms, calculating premiums)
            4. If we don't have their basic information yet, ask for it
            5. If we already have their basic information, ask about their insurance needs
            
            Keep your response concise, friendly, and helpful. Don't provide specific policy recommendations yet.
            """)
        ]
        
        # Get response from LLM with a shorter timeout
        response = await self.llm_utility.ainvoke(messages, temperature=0.7, max_tokens=300)
        return response
    
    def _generate_quick_response_sync(self, message: str, user_id: str) -> AIMessage:
        """
        Generate a quick response for general questions without running the full graph (synchronous version).
        
        Args:
            message: The user message.
            user_id: The user ID.
            
        Returns:
            An AI message with the quick response.
        """
        user_info = self.conversation_history[user_id]["user_info"]
        user_name = user_info.get("name", "")
        
        # Create a message for the LLM
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            The user has sent a general message: "{message}"
            
            User details we already have:
            {user_info}
            
            Provide a quick, friendly response that:
            1. Greets them by name if available
            2. Briefly explains that you're an insurance advisor who can help find the right life insurance policy
            3. Mentions 2-3 specific ways you can help (e.g., comparing policies, explaining terms, calculating premiums)
            4. If we don't have their basic information yet, ask for it
            5. If we already have their basic information, ask about their insurance needs
            
            Keep your response concise, friendly, and helpful. Don't provide specific policy recommendations yet.
            """)
        ]
        
        # Get response from LLM with a shorter timeout
        response = self.llm_utility.invoke(messages, temperature=0.7, max_tokens=300)
        return response
    
    def get_conversation_history(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get the conversation history for a user.
        
        Args:
            user_id: The user ID.
            
        Returns:
            The conversation history.
        """
        if user_id not in self.conversation_history:
            return []
        
        # Convert messages to a more readable format
        history = []
        for msg in self.conversation_history[user_id]["messages"]:
            if isinstance(msg, HumanMessage):
                history.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                history.append({"role": "assistant", "content": msg.content})
        
        return history


