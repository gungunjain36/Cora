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
            """You are a friendly, conversational insurance advisor for a life insurance company.
            Your job is to help clients find the right life insurance policy for their needs through natural conversation.
            
            IMPORTANT PROCESS:
            1. ALWAYS collect client information first (age, gender, health status, smoking habits)
            2. Then ask about policy preferences (type, coverage amount)
            3. Only after collecting this information, provide personalized recommendations
            
            CONVERSATION GUIDELINES:
            - Maintain a natural, flowing conversation - refer back to previous things the user has mentioned
            - Remember details the user has shared and don't ask for the same information twice
            - Use the user's name and personalize your responses based on their specific situation
            - Ask follow-up questions that build on previous responses
            - Be conversational, warm, and engaging while remaining professional
            - Respond directly to what the user is asking, don't be repetitive
            
            NEVER skip directly to recommendations without first collecting basic client information.
            If a client asks for recommendations immediately, politely explain that you need some basic information first to provide personalized advice.
            
            Be conversational, professional, and concise in your responses.
            Do not mention internal processes or other agents in your responses.
            """
        )
        
        # Store conversation history by user ID - this will persist across sessions
        self.conversation_history = {}
        
        # Create a persistent user state dictionary to store user information across sessions
        self.user_states = {}
        
        # Create a memory saver for checkpointing conversations
        self.memory_saver = MemorySaver()
        
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
            
            # Check what user information we already have
            user_info = state.get("user_info", {})
            has_basic_info = all(key in user_info for key in ["age", "gender", "smoking", "health"])
            
            # Check if this is a returning user (has user info from previous sessions)
            is_returning_user = bool(user_info) and state.get("step_count", 0) <= 1
            
            # Create a message for the LLM based on available information
            if has_basic_info:
                # We already have all the basic information, so don't ask for it again
                policy_details = state.get("policy_details", {})
                has_policy_info = "policy_type" in policy_details and "coverage_amount" in policy_details
                
                greeting_prompt = f"""
                The user has just started a conversation. Greet them warmly and explain that you'll help them find the right life insurance policy.
                
                We already have the following information about the user:
                - Name: {user_info.get('name', 'Not provided')}
                - Age: {user_info.get('age', 'Not provided')}
                - Gender: {user_info.get('gender', 'Not provided')}
                - Smoking Status: {user_info.get('smoking', 'Not provided')}
                - Health: {user_info.get('health', 'Not provided')}
                - Occupation: {user_info.get('occupation', 'Not provided')}
                - Income: {user_info.get('income', 'Not provided')}
                """
                
                if is_returning_user:
                    greeting_prompt += f"""
                    This appears to be a returning user. Acknowledge that you remember them and their information.
                    Greet them warmly by name if available.
                    """
                else:
                    greeting_prompt += f"""
                    Greet them warmly by name if available. Acknowledge that you already have their basic information.
                    """
                
                if has_policy_info:
                    greeting_prompt += f"""
                    We also have their policy preferences:
                    - Policy Type: {policy_details.get('policy_type', 'Not provided')}
                    - Coverage Amount: {policy_details.get('coverage_amount', 'Not provided')}
                    - Term Length: {policy_details.get('term_length', 'Not provided')}
                    
                    Acknowledge that you understand they're interested in a {policy_details.get('policy_type', 'life insurance')} policy with a coverage of {policy_details.get('coverage_amount', 'Not provided')}.
                    Ask if they'd like to proceed with getting a recommendation based on this information, or if they'd like to explore other options.
                    """
                else:
                    greeting_prompt += f"""
                    Ask about their insurance needs and preferences, such as what type of policy they're interested in and what coverage amount they're looking for.
                    """
                
                greeting_prompt += """
                Be conversational and friendly, but get straight to the point.
                DO NOT ask for information we already have.
                
                User message: {last_message.content}
                """
                
                messages = [
                    self.system_message,
                    HumanMessage(content=greeting_prompt)
                ]
            else:
                # We're missing some basic information, so ask for what's missing
                missing_fields = [field for field in ["age", "gender", "smoking", "health"] if field not in user_info]
                
                greeting_prompt = f"""
                The user has just started a conversation. Greet them warmly and explain that you'll help them find the right life insurance policy.
                
                We already have the following information about the user:
                {user_info}
                
                We're missing the following information: {', '.join(missing_fields) if missing_fields else 'None'}
                """
                
                if is_returning_user and user_info:
                    greeting_prompt += f"""
                    This appears to be a returning user. Acknowledge that you remember them and welcome them back.
                    Greet them warmly by name if available.
                    """
                
                greeting_prompt += f"""
                If we're missing any essential information (age, gender, smoking status, health), ask ONLY for the missing details.
                Be conversational and friendly, but get straight to the point.
                
                IMPORTANT: Do NOT provide any policy recommendations yet - we need to collect their information first.
                Even if the user asks for recommendations immediately, explain that you need some basic information first to provide personalized recommendations.
                
                DO NOT ask for information we already have.
                
                User message: {last_message.content}
                """
                
                messages = [
                    self.system_message,
                    HumanMessage(content=greeting_prompt)
                ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Determine the next stage based on available information
            next_stage = "policy_selection" if has_basic_info else "collecting_info"
            
            # Update the state
            return {
                "messages": state["messages"] + [response],
                "user_info": user_info,
                "policy_details": state.get("policy_details", {}),
                "recommendation_result": state.get("recommendation_result"),
                "conversation_stage": next_stage,
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
            
            # Get previous conversation context (last 3 exchanges)
            conversation_context = self._get_conversation_context(state["messages"], max_exchanges=3)
            
            # Identify what information we already have and what we're missing
            required_fields = ["age", "gender", "smoking", "health"]
            missing_fields = [field for field in required_fields if field not in user_info]
            
            # Check if we already have most of the information
            has_most_info = len(missing_fields) <= 1
            
            # Create a message for the LLM
            prompt = f"""
            You are collecting information from the user to provide a life insurance policy recommendation.
            
            Current information we have:
            """
            
            # Format the user info in a more readable way
            for key, value in user_info.items():
                prompt += f"- {key}: {value}\n"
            
            prompt += f"""
            Recent conversation context:
            {conversation_context}
            
            Extract any new information from the user's message and update our understanding.
            We need ALL of the following information before proceeding:
            - age (numeric)
            - gender (male/female)
            - smoking status (yes/no)
            - health conditions (any major conditions)
            
            Missing information: {', '.join(missing_fields) if missing_fields else 'None - we have all required information'}
            """
            
            if has_most_info:
                prompt += f"""
                We already have most of the required information. Focus ONLY on extracting the missing information: {', '.join(missing_fields)}.
                Be very specific in your questions, asking directly about the missing information.
                """
            
            prompt += f"""
            Pay special attention to smoking status and health information in the message.
            If the user mentions they don't smoke, set smoking = "no".
            If the user mentions they have no health issues, set health = "No significant health issues reported".
            
            If we don't have ALL of this information, ask ONLY for the missing details specifically.
            DO NOT ask for information we already have.
            Be conversational but direct in your questions. Reference previous parts of the conversation to make it feel natural.
            
            User message: {last_message.content}
            
            First, analyze what information we can extract from this message. Then respond to the user.
            Format your analysis as JSON that we can use to update our user_info dictionary.
            """
            
            messages = [
                self.system_message,
                HumanMessage(content=prompt)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Try to extract structured information from the response
            try:
                import json
                import re
                
                # Extract JSON from the response
                json_match = re.search(r'```json\n(.*?)\n```', response.content, re.DOTALL)
                if not json_match:
                    json_match = re.search(r'{.*}', response.content, re.DOTALL)
                
                if json_match:
                    extracted_info = json.loads(json_match.group(1) if '```json' in response.content else json_match.group(0))
                    
                    # Update user_info with extracted information
                    for key, value in extracted_info.items():
                        if key in ["age", "gender", "smoking", "health", "name", "occupation", "income"]:
                            user_info[key] = value
            
                # Extract policy details from the message
                policy_details = state["policy_details"] or {}
                message_lower = last_message.content.lower()
                
                # Check for policy type
                if "policy_type" not in policy_details:
                    if "term" in message_lower and "life" in message_lower:
                        policy_details["policy_type"] = "Term Life"
                    elif "whole" in message_lower and "life" in message_lower:
                        policy_details["policy_type"] = "Whole Life"
                    elif "universal" in message_lower and "life" in message_lower:
                        policy_details["policy_type"] = "Universal Life"
                    elif "life" in message_lower:
                        policy_details["policy_type"] = "Life"
                    elif "health" in message_lower:
                        policy_details["policy_type"] = "Health"
                
                # Check for coverage amount
                if "coverage_amount" not in policy_details:
                    # Look for patterns like "30 lakh", "50,00,000", "5 million", etc.
                    coverage_patterns = [
                        r'(\d+)\s*lakh',
                        r'(\d+),\d+,\d+',
                        r'(\d+)\s*million',
                        r'(\d+)\s*crore'
                    ]
                    
                    for pattern in coverage_patterns:
                        match = re.search(pattern, message_lower)
                        if match:
                            amount = match.group(1)
                            try:
                                if "lakh" in message_lower:
                                    policy_details["coverage_amount"] = int(amount) * 100000
                                elif "crore" in message_lower:
                                    policy_details["coverage_amount"] = int(amount) * 10000000
                                elif "million" in message_lower:
                                    policy_details["coverage_amount"] = int(amount) * 1000000
                                else:
                                    # Assume it's already in the right format
                                    policy_details["coverage_amount"] = int(amount.replace(",", ""))
                            except ValueError:
                                pass
                
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
                
                # If we also have policy details, we can move to recommendation
                has_policy_info = "policy_type" in policy_details and "coverage_amount" in policy_details
                if has_basic_info and has_policy_info:
                    next_stage = "recommendation"
                
                # Debug logging
                if has_basic_info:
                    print(f"User has provided all required information. Moving to {next_stage}")
                    print(f"User info: {user_info}")
                    print(f"Policy details: {policy_details}")
                else:
                    missing = [field for field in required_fields if field not in user_info]
                    print(f"User is missing information: {missing}. Staying in collecting_info stage")
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": user_info,
                    "policy_details": policy_details,
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
            
            # Get previous conversation context (last 3 exchanges)
            conversation_context = self._get_conversation_context(state["messages"], max_exchanges=3)
            
            # Identify what policy information we already have and what we're missing
            required_policy_fields = ["policy_type", "coverage_amount"]
            missing_policy_fields = [field for field in required_policy_fields if field not in policy_details]
            
            # Check if we already have most of the policy information
            has_most_policy_info = len(missing_policy_fields) <= 1
            
            # Create a message for the LLM
            prompt = f"""
            You are helping the user select a policy type and coverage amount.
            
            Current user information:
            """
            
            # Format the user info in a more readable way
            user_info = state.get("user_info", {})
            for key, value in user_info.items():
                prompt += f"- {key}: {value}\n"
            
            prompt += f"""
            Current policy details:
            """
            
            # Format the policy details in a more readable way
            for key, value in policy_details.items():
                prompt += f"- {key}: {value}\n"
            
            prompt += f"""
            Recent conversation context:
            {conversation_context}
            
            Missing policy information: {', '.join(missing_policy_fields) if missing_policy_fields else 'None - we have all required policy information'}
            
            Extract any policy preferences from the user's message and update our understanding.
            """
            
            if not missing_policy_fields:
                prompt += f"""
                We have all the necessary policy information. Confirm the details with the user and suggest getting a recommendation.
                Ask if they'd like to proceed with getting a recommendation based on this information, or if they'd like to explore other options.
                """
            elif has_most_policy_info:
                prompt += f"""
                We already have most of the required policy information. Focus ONLY on extracting the missing information: {', '.join(missing_policy_fields)}.
                Be very specific in your questions, asking directly about the missing information.
                """
                
                if "policy_type" in missing_policy_fields:
                    prompt += f"""
                    Explain the different policy types in detail:
                    
                    1. Term Life Insurance:
                       - Provides coverage for a specific period (10, 20, 30 years)
                       - Lower premiums compared to permanent insurance
                       - No cash value component
                       - Ideal for: Young families, people with temporary financial obligations
                    
                    2. Whole Life Insurance:
                       - Provides lifetime coverage
                       - Builds cash value over time
                       - Fixed premiums
                       - Ideal for: Estate planning, long-term financial security
                    
                    3. Universal Life Insurance:
                       - Flexible premium payments and death benefits
                       - Builds cash value that can earn interest
                       - Ideal for: People who want flexibility in their policy
                    """
                
                if "coverage_amount" in missing_policy_fields:
                    prompt += f"""
                    Explain how to determine an appropriate coverage amount:
                    
                    - Typically 10-15 times annual income is recommended
                    - Consider outstanding debts (mortgage, loans)
                    - Consider future expenses (children's education)
                    - Consider funeral and end-of-life expenses
                    
                    Based on the user's age ({user_info.get('age', 'unknown')}) and income ({user_info.get('income', 'unknown')}), suggest an appropriate coverage range.
                    """
            else:
                prompt += f"""
                If we don't have enough information (policy_type, coverage_amount), explain the different policy types in detail:
                
                1. Term Life Insurance:
                   - Provides coverage for a specific period (10, 20, 30 years)
                   - Lower premiums compared to permanent insurance
                   - No cash value component
                   - Ideal for: Young families, people with temporary financial obligations
                
                2. Whole Life Insurance:
                   - Provides lifetime coverage
                   - Builds cash value over time
                   - Fixed premiums
                   - Ideal for: Estate planning, long-term financial security
                
                3. Universal Life Insurance:
                   - Flexible premium payments and death benefits
                   - Builds cash value that can earn interest
                   - Ideal for: People who want flexibility in their policy
                """
            
            prompt += f"""
            Ask ONLY about the missing policy information. DO NOT ask for information we already have.
            Be conversational but direct in your explanations and questions. Reference previous parts of the conversation to make it feel natural.
            
            User message: {last_message.content}
            
            First, analyze what policy information we can extract from this message. Then respond to the user.
            Format your analysis as JSON that we can use to update our policy_details dictionary.
            """
            
            messages = [
                self.system_message,
                HumanMessage(content=prompt)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Try to extract structured information from the response
            try:
                import json
                import re
                
                # Extract JSON from the response
                json_match = re.search(r'```json\n(.*?)\n```', response.content, re.DOTALL)
                if not json_match:
                    json_match = re.search(r'{.*}', response.content, re.DOTALL)
                
                if json_match:
                    extracted_info = json.loads(json_match.group(1) if '```json' in response.content else json_match.group(0))
                    
                    # Update policy_details with extracted information
                    for key, value in extracted_info.items():
                        if key in ["policy_type", "coverage_amount", "term_length", "sub_type"]:
                            policy_details[key] = value
            
                # Check if we have enough information to move to recommendation
                has_policy_info = "policy_type" in policy_details and "coverage_amount" in policy_details
                
                # Determine the next stage
                next_stage = "recommendation" if has_policy_info else "policy_selection"
                
                # Debug logging
                if has_policy_info:
                    print(f"User has provided all required policy information. Moving to recommendation stage")
                    print(f"Policy details: {policy_details}")
                else:
                    missing = [field for field in required_policy_fields if field not in policy_details]
                    print(f"User is missing policy information: {missing}. Staying in policy_selection stage")
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": policy_details,
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": next_stage,
                    "step_count": state.get("step_count", 0) + 1
                }
            except Exception as e:
                # If parsing fails, continue with policy selection
                print(f"Error parsing policy information: {str(e)}")
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
            # Log that we're calling the policy agent
            print(f"Calling policy recommendation agent for user {id(state)}...")
            print(f"User info: {state['user_info']}")
            print(f"Policy details: {state['policy_details']}")
            
            try:
                # Get recommendation from policy agent
                recommendation_result = self.policy_agent.invoke(
                    state["user_info"],
                    state["policy_details"]
                )
                
                # Log the successful recommendation
                print(f"Received recommendation from policy agent: {recommendation_result['policy_recommendation']['recommended_policy'].get('name', 'Not specified')}")
                print(f"Risk assessment: Risk score = {recommendation_result['risk_assessment'].get('risk_score')}")
                print(f"Premium calculation: Monthly premium = ${recommendation_result['premium_calculation'].get('monthly_premium')}")
                
                # Get previous conversation context (last 3 exchanges)
                conversation_context = self._get_conversation_context(state["messages"], max_exchanges=3)
                
                # Create a message for the LLM to format the recommendation
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    Based on the user's information and policy preferences, we have the following comprehensive recommendation:
                    
                    Risk Assessment:
                    - Risk Score: {recommendation_result["risk_assessment"].get("risk_score")}
                    - Risk Factors: {recommendation_result["risk_assessment"].get("risk_factors")}
                    - Assessment: {recommendation_result["risk_assessment"].get("assessment", "Not provided")}
                    
                    Premium Calculation:
                    - Annual Premium: ${recommendation_result["premium_calculation"].get("annual_premium")}
                    - Monthly Premium: ${recommendation_result["premium_calculation"].get("monthly_premium")}
                    - Premium Breakdown: {recommendation_result["premium_calculation"].get("breakdown", {})}
                    - Premium Explanation: {recommendation_result["premium_calculation"].get("explanation", "Not provided")}
                    
                    Policy Recommendation:
                    - Recommended Policy: {recommendation_result["policy_recommendation"]["recommended_policy"].get("name", "Not specified")}
                    - Policy Type: {recommendation_result["policy_recommendation"]["recommended_policy"].get("policy_type", "Not specified")}
                    - Sub Type: {recommendation_result["policy_recommendation"]["recommended_policy"].get("sub_type", "Not specified")}
                    - Coverage Amount: {recommendation_result["policy_recommendation"]["recommended_policy"].get("coverage_amount", "Not specified")}
                    - Term Length: {recommendation_result["policy_recommendation"]["recommended_policy"].get("term_length", "Not specified")}
                    - Premium: {recommendation_result["policy_recommendation"]["recommended_policy"].get("premium", "Not specified")}
                    - Recommended Riders: {recommendation_result["policy_recommendation"]["recommended_policy"].get("recommended_riders", [])}
                    
                    Alternative Policies:
                    {[f"- {alt.get('name', 'Not specified')} ({alt.get('policy_type', 'Not specified')} - {alt.get('sub_type', 'Not specified')}): {alt.get('coverage_amount', 'Not specified')} for {alt.get('term_length', 'Not specified')} at {alt.get('premium', 'Not specified')}" for alt in recommendation_result["policy_recommendation"].get("alternative_policies", [])]}
                    
                    Explanation:
                    {recommendation_result["policy_recommendation"].get("explanation", "No explanation provided.")}
                    
                    Additional Notes:
                    {recommendation_result["policy_recommendation"].get("additional_notes", "No additional notes.")}
                    
                    Recent conversation context:
                    {conversation_context}
                    
                    User information:
                    {state["user_info"]}
                    
                    Present this information to the user in a clear, friendly, and professional manner.
                    Provide a DETAILED explanation of the recommendation and why it's suitable for them based on their risk profile and needs.
                    Include specific details about the policy features, benefits, and how it addresses their specific situation.
                    
                    Your response should include:
                    1. A personalized greeting using their name
                    2. A summary of their profile and needs
                    3. The recommended policy with detailed explanation of its features and benefits
                    4. Why this policy is particularly suitable for them based on their age, health, and other factors
                    5. The premium details with a breakdown of costs
                    6. Alternative options they might consider
                    7. Next steps if they want to proceed with this policy
                    
                    Make the response comprehensive and detailed, but still conversational and easy to understand.
                    Personalize the response based on what you know about the user from previous conversation.
                    Ask if they have any questions or if they'd like to proceed with the recommended policy.
                    Do not mention internal processes or other agents in your response.
                    """)
                ]
                
                # Get response from LLM
                response = self.llm.invoke(messages)
                
                # Log successful recommendation
                print(f"Successfully generated detailed recommendation for user {id(state)}")
                
                # Update the state
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": state["policy_details"],
                    "recommendation_result": recommendation_result,
                    "conversation_stage": "followup",
                    "step_count": state.get("step_count", 0) + 1
                }
            except Exception as e:
                # Log the error
                print(f"Error generating recommendation: {str(e)}")
                
                # Create a fallback response
                fallback_response = self.llm.invoke([
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has requested a policy recommendation, but we encountered an issue while generating it.
                    
                    User information:
                    {state["user_info"]}
                    
                    Policy details:
                    {state["policy_details"]}
                    
                    Please provide a helpful response that:
                    1. Acknowledges that we're working on their recommendation
                    2. Explains that we need a bit more time to process their request
                    3. Asks if they have any specific questions about insurance policies in the meantime
                    4. Assures them that we'll provide a detailed recommendation shortly
                    
                    Be conversational, apologetic but professional, and helpful.
                    """)
                ])
                
                # Update the state but stay in the same stage
                return {
                    "messages": state["messages"] + [fallback_response],
                    "user_info": state["user_info"],
                    "policy_details": state["policy_details"],
                    "recommendation_result": None,
                    "conversation_stage": state["conversation_stage"],
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
            
            # Get previous conversation context (last 5 exchanges)
            conversation_context = self._get_conversation_context(state["messages"], max_exchanges=5)
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                The user has received our policy recommendation. Respond to their follow-up question or comment.
                
                Recent conversation context:
                {conversation_context}
                
                User information:
                {state["user_info"]}
                
                Policy details:
                {state["policy_details"]}
                
                Recommendation details:
                {state["recommendation_result"]}
                
                If they want to proceed with the policy, explain the next steps in detail:
                1. Application Process: They'll need to fill out a formal application with their personal and medical information
                2. Medical Examination: Depending on their age and coverage amount, they may need a medical exam
                3. Underwriting: The insurance company will review their application and medical results
                4. Policy Issuance: Once approved, they'll receive their policy documents
                5. First Premium Payment: They'll need to make their first premium payment to activate the policy
                
                If they have questions about the recommendation:
                - Provide detailed answers based on the information we have
                - Explain policy features, benefits, exclusions, and limitations
                - Compare with alternative options if relevant
                - Use specific examples to illustrate concepts
                
                If they want to explore other options:
                - Discuss the alternative policies from our recommendation
                - Explain the key differences between the options
                - Highlight the trade-offs between premium cost and coverage
                
                Be conversational, helpful, and thorough in your response. Reference previous parts of the conversation to maintain continuity.
                Personalize your response based on their specific situation and concerns.
                
                User message: {last_message.content}
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Check if the conversation is complete
            is_complete = "thank you" in last_message.content.lower() or "goodbye" in last_message.content.lower()
            
            # Log the followup response
            if is_complete:
                print(f"User {id(state)} has completed the conversation.")
            else:
                print(f"Continuing followup conversation with user {id(state)}")
            
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
            
            # Check if we have all the necessary information for a recommendation
            user_info = state["user_info"] or {}
            policy_details = state["policy_details"] or {}
            has_basic_info = all(key in user_info for key in ["age", "gender", "smoking", "health"])
            has_policy_info = "policy_type" in policy_details and "coverage_amount" in policy_details
            
            # Get the last user message
            last_message = None
            for msg in reversed(state["messages"]):
                if isinstance(msg, HumanMessage):
                    last_message = msg.content.lower().strip()
                    break
            
            # If the user explicitly asks for a recommendation, move to recommendation stage
            recommendation_phrases = ["suggest", "recommend", "suggest a plan", "recommend a plan", 
                                 "okay now suggest me a proper plan which i should go with.", 
                                 "please suggest a suitable plan for me.",
                                 "what plan should i go with",
                                 "which plan is best for me"]
            
            is_recommendation_request = last_message and any(phrase in last_message for phrase in recommendation_phrases)
            
            # For new conversations, determine the appropriate starting stage based on available information
            if state.get("step_count", 0) <= 1:
                # If this is the first or second step, determine stage based on available info
                if has_basic_info and has_policy_info:
                    print(f"User has all required information. Starting at recommendation stage.")
                    return "recommendation"
                elif has_basic_info:
                    print(f"User has all basic information. Starting at policy_selection stage.")
                    return "policy_selection"
                elif state["conversation_stage"] == "greeting":
                    return "greeting"
                else:
                    return "collecting_info"
            
            # If user explicitly asks for a recommendation and we have all the necessary info, go to recommendation
            if is_recommendation_request and has_basic_info and has_policy_info:
                print(f"User has requested a recommendation and has all required information. Moving to recommendation stage.")
                return "recommendation"
            
            # If user explicitly asks for a recommendation but we're missing policy info, go to policy_selection
            if is_recommendation_request and has_basic_info and not has_policy_info:
                print(f"User has requested a recommendation but is missing policy information. Moving to policy_selection stage.")
                return "policy_selection"
            
            # Check if we're in a potential loop by examining the last few messages
            # If we have more than 10 messages and the last 3 stages are the same, move to the next stage
            messages = state["messages"]
            if len(messages) > 10:
                # Get the current stage
                current_stage = state["conversation_stage"]
                
                # If we've been in the same stage for too long, progress to the next stage
                if current_stage == "greeting":
                    # If we have basic info, skip collecting_info
                    if has_basic_info:
                        return "policy_selection"
                    else:
                        return "collecting_info"
                elif current_stage == "collecting_info":
                    # Check if we have all the necessary information
                    if has_basic_info:
                        return "policy_selection"
                    else:
                        return "collecting_info"
                elif current_stage == "policy_selection":
                    # Check if we have all the necessary policy information
                    if has_policy_info:
                        return "recommendation"
                    else:
                        return "policy_selection"
                elif current_stage == "recommendation":
                    return "followup"
                elif current_stage == "followup":
                    return "completed"
            
            # Normal routing logic
            if state["conversation_stage"] == "greeting":
                # After greeting, go to policy_selection if we already have basic info
                if has_basic_info:
                    print(f"User already has all required basic information. Moving to policy_selection stage.")
                    return "policy_selection"
                else:
                    return "collecting_info"
            elif state["conversation_stage"] == "collecting_info":
                # Check if we have all the necessary information
                if has_basic_info:
                    print(f"User has all required basic information. Moving to policy_selection stage.")
                    return "policy_selection"
                else:
                    missing = [field for field in ["age", "gender", "smoking", "health"] if field not in user_info]
                    print(f"User is missing information: {missing}. Staying in collecting_info stage.")
                    return "collecting_info"
            elif state["conversation_stage"] == "policy_selection":
                # Check if we have all the necessary policy information
                if has_policy_info:
                    print(f"User has all required policy information. Moving to recommendation stage.")
                    return "recommendation"
                else:
                    missing = [field for field in ["policy_type", "coverage_amount"] if field not in policy_details]
                    print(f"User is missing policy information: {missing}. Staying in policy_selection stage.")
                    return "policy_selection"
            elif state["conversation_stage"] == "recommendation":
                return "followup"
            elif state["conversation_stage"] == "followup":
                # Check if the user is asking about a different policy or has new questions
                if is_recommendation_request:
                    return "recommendation"
                return "followup"
            elif state["conversation_stage"] == "completed":
                # If the user comes back with new questions after completion, go to followup
                return "followup" if has_basic_info and has_policy_info else END
            else:
                # Default to greeting for unknown stages
                return "greeting"
        
        # Create the graph with memory
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
        
        # Compile the graph with optimized settings and memory
        return builder.compile()
    
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
        import datetime
        self.user_states[user_id]["last_active"] = datetime.datetime.now()
        
        return self.user_states[user_id]
    
    def _update_user_state(self, user_id: str, state: CommunicationState):
        """
        Update the persistent user state from the conversation state.
        
        Args:
            user_id: The user ID.
            state: The current conversation state.
        """
        user_state = self._get_or_create_user_state(user_id)
        
        # Update user information
        if state.get("user_info"):
            user_state["user_info"].update(state["user_info"])
        
        # Update policy details
        if state.get("policy_details"):
            user_state["policy_details"].update(state["policy_details"])
        
        # Update recommendation result
        if state.get("recommendation_result"):
            user_state["recommendation_result"] = state["recommendation_result"]
        
        # Track completed stages
        if state.get("conversation_stage") and state["conversation_stage"] != "greeting":
            user_state["completed_stages"].add(state["conversation_stage"])
        
        # Update conversation history summary
        if len(state.get("messages", [])) > 2:  # If there are messages to summarize
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
                    user_state["conversation_history"].append({
                        "user": user_message,
                        "assistant": ai_response,
                        "timestamp": datetime.datetime.now().isoformat(),
                        "stage": state.get("conversation_stage", "unknown")
                    })
                    
                    # Keep only the last 10 exchanges to avoid excessive memory usage
                    if len(user_state["conversation_history"]) > 10:
                        user_state["conversation_history"] = user_state["conversation_history"][-10:]
            except Exception as e:
                print(f"Error updating conversation history summary: {str(e)}")
        
        # Save to checkpoint
        try:
            checkpoint_key = f"user_state_{user_id}"
            self.memory_saver.put(checkpoint_key, user_state)
        except Exception as e:
            print(f"Error saving user state to checkpoint: {str(e)}")
    
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
                import re
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
            self.conversation_history[user_id] = self._initialize_conversation_state(user_id, user_details)
        else:
            # If user details are provided, update the existing conversation state
            if user_details:
                print(f"Updating user details for existing user {user_id}")
                self._incorporate_frontend_details(self.conversation_history[user_id], user_details)
        
        # Add user message to history
        user_message = HumanMessage(content=message)
        self.conversation_history[user_id]["messages"].append(user_message)
        
        # Debug: Print current conversation stage
        print(f"Before graph execution - User: {user_id}, Stage: {self.conversation_history[user_id]['conversation_stage']}")
        
        # Get conversation context for better continuity
        conversation_context = self._get_conversation_context(self.conversation_history[user_id]["messages"], max_exchanges=5)
        print(f"Conversation context length: {len(conversation_context.split())}")
        
        # If this is the first message in this session and we already have all the information, 
        # provide a detailed greeting that acknowledges the information we have
        if self.conversation_history[user_id]["step_count"] == 0:
            user_info = self.conversation_history[user_id]["user_info"]
            policy_details = self.conversation_history[user_id]["policy_details"]
            has_basic_info = all(key in user_info for key in ["age", "gender", "smoking", "health"])
            
            if has_basic_info:
                try:
                    # Get user state to check if this is a returning user
                    user_state = self._get_or_create_user_state(user_id)
                    is_returning_user = bool(user_state.get("conversation_history", []))
                    
                    # Generate a detailed greeting that acknowledges the information we have
                    greeting_prompt = f"""
                    The user has just started a conversation with the message: "{message}"
                    
                    We already have comprehensive information about the user:
                    
                    Personal Details:
                    - Name: {user_info.get('name', 'Not provided')}
                    - Age: {user_info.get('age', 'Not provided')}
                    - Gender: {user_info.get('gender', 'Not provided')}
                    - Smoking Status: {user_info.get('smoking', 'Not provided')}
                    - Health: {user_info.get('health', 'Not provided')}
                    - Occupation: {user_info.get('occupation', 'Not provided')}
                    - Income: {user_info.get('income', 'Not provided')}
                    
                    Policy Preferences:
                    - Policy Type: {policy_details.get('policy_type', 'Life')}
                    - Coverage Amount: {policy_details.get('coverage_amount', 'Not provided')}
                    - Term Length: {policy_details.get('term_length', 'Not provided')}
                    """
                    
                    if is_returning_user:
                        greeting_prompt += """
                        This is a returning user. Greet them warmly by name, acknowledge that you remember them and their information.
                        Remind them of where you left off in your previous conversation if applicable.
                        Reference something specific from your previous interactions to personalize the greeting.
                        """
                    else:
                        greeting_prompt += """
                        This is a new user session. Greet them warmly by name, acknowledge that you have their information.
                        """
                    
                    greeting_prompt += f"""
                    If we have policy details (coverage amount and policy type), mention specifically that you understand they're interested in a {policy_details.get('term_length', '20-year')} term life insurance policy with a coverage of {policy_details.get('coverage_amount', 'Not provided')}.
                    
                    If we don't have policy details, ask about their insurance needs and preferences, such as what type of policy they're interested in and what coverage amount they're looking for.
                    
                    Be conversational, warm, and professional. Make them feel that you understand their needs based on the information they've provided.
                    DO NOT ask for information we already have.
                    """
                    
                    greeting_msg = self.llm.invoke([
                        self.system_message,
                        HumanMessage(content=greeting_prompt)
                    ])
                    
                    # Update conversation history with this message
                    self.conversation_history[user_id]["messages"].append(greeting_msg)
                    self.conversation_history[user_id]["step_count"] += 1
                    
                    # Set the appropriate conversation stage
                    has_policy_info = "coverage_amount" in policy_details and "policy_type" in policy_details
                    next_stage = "recommendation" if has_policy_info else "policy_selection"
                    self.conversation_history[user_id]["conversation_stage"] = next_stage
                    
                    # Update persistent user state
                    self._update_user_state(user_id, self.conversation_history[user_id])
                    
                    return {
                        "response": greeting_msg.content,
                        "conversation_stage": next_stage
                    }
                except Exception as inner_e:
                    print(f"Error generating detailed greeting: {str(e)}")
        
        try:
            # Run the graph with increased recursion limit and optimized settings
            result = self.graph.invoke(
                self.conversation_history[user_id],
                options={
                    "recursion_limit": 50,  # Increase recursion limit from default 25 to 50
                    "max_concurrency": MAX_CONCURRENCY  # Limit concurrent operations
                }
            )
            
            # Debug: Print resulting conversation stage
            print(f"After graph execution - User: {user_id}, Stage: {result['conversation_stage']}")
            
            # Update conversation history
            self.conversation_history[user_id] = result
            
            # Update persistent user state
            self._update_user_state(user_id, result)
            
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
            
            # Generate a contextual response based on conversation history
            try:
                # Create a message for the LLM
                contextual_msg = self.llm.invoke([
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has sent a message: "{message}"
                    
                    User details we have:
                    {self.conversation_history[user_id]["user_info"]}
                    
                    Recent conversation context:
                    {conversation_context}
                    
                    Provide a helpful, conversational response that:
                    1. Acknowledges their message
                    2. Maintains the flow of conversation
                    3. If we're missing essential information (age, gender, smoking status, health), ask for it
                    4. If we have all essential information but no policy details, ask about their insurance needs
                    5. If we have all information, help guide them toward a recommendation
                    
                    Be natural and conversational, referencing previous parts of the conversation.
                    DO NOT ask for information we already have.
                    """)
                ])
                
                # Update conversation history with this message
                self.conversation_history[user_id]["messages"].append(contextual_msg)
                self.conversation_history[user_id]["step_count"] += 1
                
                # Update persistent user state
                self._update_user_state(user_id, self.conversation_history[user_id])
                
                return {
                    "response": contextual_msg.content,
                    "conversation_stage": self.conversation_history[user_id]["conversation_stage"]
                }
            except Exception as context_e:
                print(f"Error generating contextual response: {str(context_e)}")
            
            # Default fallback response
            user_info = self.conversation_history[user_id]["user_info"]
            has_basic_info = all(key in user_info for key in ["age", "gender", "smoking", "health"])
            
            if has_basic_info:
                return {
                    "response": f"Hello{' ' + user_info.get('name', '') if 'name' in user_info else ''}! I see I already have your basic information. Could you tell me what type of life insurance policy you're interested in and what coverage amount you're looking for?",
                    "conversation_stage": "policy_selection"
                }
            else:
                missing = [field for field in ["age", "gender", "smoking", "health"] if field not in user_info]
                return {
                    "response": f"Hello{' ' + user_info.get('name', '') if 'name' in user_info else ''}! I'm your friendly insurance advisor. I can help you find the right life insurance policy for your needs. I still need some information from you: {', '.join(missing)}. This will help me provide personalized recommendations.",
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
        
        # Get previous conversation context if available
        previous_messages = self.conversation_history[user_id]["messages"]
        conversation_context = self._get_conversation_context(previous_messages, max_exchanges=3) if len(previous_messages) > 1 else ""
        
        # Create a message for the LLM
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            The user has sent a general message: "{message}"
            
            User details we already have:
            {user_info}
            
            Recent conversation context:
            {conversation_context}
            
            Provide a quick, friendly response that:
            1. Greets them by name if available
            2. Briefly explains that you're an insurance advisor who can help find the right life insurance policy
            3. Mentions 2-3 specific ways you can help (e.g., comparing policies, explaining terms, calculating premiums)
            4. If we don't have their basic information yet, ask for it
            5. If we already have their basic information, ask about their insurance needs
            
            Keep your response conversational, friendly, and helpful. Reference previous parts of the conversation to make it feel natural.
            Don't provide specific policy recommendations yet.
            DO NOT ask for information we already have.
            """)
        ]
        
        # Get response from LLM with a shorter timeout
        response = self.llm.invoke(messages, temperature=0.7)
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
    
    def _get_conversation_context(self, messages, max_exchanges=3):
        """
        Extract recent conversation context from messages.
        
        Args:
            messages: The conversation messages.
            max_exchanges: Maximum number of exchanges to include.
            
        Returns:
            A string containing the recent conversation context.
        """
        # Filter out system messages
        user_assistant_messages = [msg for msg in messages if isinstance(msg, (HumanMessage, AIMessage))]
        
        # Get the most recent messages (up to max_exchanges * 2 messages)
        recent_messages = user_assistant_messages[-min(max_exchanges * 2, len(user_assistant_messages)):]
        
        # Format the context
        context = []
        for i, msg in enumerate(recent_messages):
            if isinstance(msg, HumanMessage):
                context.append(f"User: {msg.content}")
            elif isinstance(msg, AIMessage):
                context.append(f"Assistant: {msg.content}")
        
        return "\n".join(context)

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
            self.conversation_history[user_id] = self._initialize_conversation_state(user_id, user_details)
        else:
            # If user details are provided, update the existing conversation state
            if user_details:
                print(f"Updating user details for existing user {user_id}")
                self._incorporate_frontend_details(self.conversation_history[user_id], user_details)
        
        # Add user message to history
        user_message = HumanMessage(content=message)
        self.conversation_history[user_id]["messages"].append(user_message)
        
        try:
            # Run the graph with increased recursion limit and optimized settings
            result = await self.graph.ainvoke(
                self.conversation_history[user_id],
                options={
                    "recursion_limit": 50,
                    "max_concurrency": MAX_CONCURRENCY
                }
            )
            
            # Update conversation history
            self.conversation_history[user_id] = result
            
            # Update persistent user state
            self._update_user_state(user_id, result)
            
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
            print(f"Error in async communication agent: {str(e)}")
            # Use the synchronous version as fallback
            return self.invoke(message, user_id, user_details)


