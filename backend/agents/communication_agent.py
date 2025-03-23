import asyncio
import os
import json
import re
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
from functools import partial

# Maximum number of concurrent operations
MAX_CONCURRENCY = 5

class CommunicationState(TypedDict):
    """State for the communication agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_info: Optional[Dict[str, Any]]
    policy_details: Optional[Dict[str, Any]]
    recommendation_result: Optional[Dict[str, Any]]
    conversation_stage: Literal["greeting", "general_conversation", "collecting_info", "policy_selection", "recommendation", "followup", "completed", "policy_acceptance"]
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

        # Lazy initialization of other agents
        self._risk_agent = None
        self._premium_agent = None
        self._policy_agent = None

        self.system_message = llm_utility.create_system_message(
            """You are Cora, a friendly and versatile AI assistant that can handle both general conversations and specialized insurance-related inquiries.

            For general conversations:
            - Answer questions on various topics clearly and helpfully
            - Engage in friendly chit-chat about any subject the user brings up
            - Provide thoughtful responses about technology, news, entertainment, general knowledge, etc.
            - Be conversational, professional, and concise in your responses

            For insurance-related conversations, follow this IMPORTANT PROCESS only AFTER the user brings up life insurance or health insurance:
            1. NEVER ask for personal information from the user - all user details are already stored in their profile from onboarding
            2. When the user asks about insurance, use ONLY their existing profile information - DO NOT ask for age, gender, health status, etc.
            3. Provide the user's existing profile information to the "risk assessment" agent and the "premium calculation" agent
            4. Provide the results to the "policy recommendation" agent to recommend the best policy
            5. Ask the client to accept or decline the recommended policy
            6. Follow up with the client after they make their decision

            CRITICAL: NEVER ask the user for personal information like age, gender, smoking status, health conditions, etc.
            This information is ALREADY in their profile from onboarding. Always use the existing profile data.

            For insurance conversations:
            - ONLY use the client information already provided during onboarding
            - Help clients understand policy options (term life, whole life, etc.)
            - Explain coverage amounts and terms
            - Process recommendations based on client risk profile from existing data

            Always refer to the user history to maintain context and continuity in the conversation.
            Be conversational, professional, and concise in your responses.
            """
        )

        self.conversation_history = {}  # Store conversation history by user ID
        self.graph = None  # Initialize graph lazily
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=MAX_CONCURRENCY)

        # Initialize the graph during construction
        try:
            print("Initializing graph during agent initialization...")
            self.graph = self._create_graph()
            print(f"Graph initialization {'successful' if self.graph else 'failed'}")
        except Exception as e:
            print(f"Error initializing graph during __init__: {str(e)}")
            self.graph = None

    @property
    def risk_agent(self):
        """Lazy initialization of risk agent."""
        if self._risk_agent is None:
            self._risk_agent = RiskAssessmentAgent(self.llm_utility)
        return self._risk_agent

    @property
    def premium_agent(self):
        """Lazy initialization of premium agent."""
        if self._premium_agent is None:
            self._premium_agent = PremiumCalculationAgent(self.llm_utility)
        return self._premium_agent

    @property
    def policy_agent(self):
        """Lazy initialization of policy agent."""
        if self._policy_agent is None:
            self._policy_agent = PolicyRecommendationAgent(self.llm_utility, self.risk_agent, self.premium_agent)
        return self._policy_agent

    ### Node Functions Defined as Class Methods ###

    def greeting_node(self, state: CommunicationState) -> CommunicationState:
        """Handle the initial greeting or response to the user's first message."""
        messages = state.get("messages", [])
        if not messages:
            return {
                "messages": [HumanMessage(content="Hello! How can I assist you today?")],
                "user_info": state.get("user_info", {}),
                "policy_details": state.get("policy_details", {}),
                "recommendation_result": state.get("recommendation_result", None),
                "conversation_stage": "general_conversation",
                "step_count": state.get("step_count", 0) + 1
            }
        last_message = messages[-1]
        is_insurance_request = any(term in last_message.content.lower() for term in [
            "suggest", "recommend", "insurance", "policy", "coverage",
            "protection", "life insurance", "need policy", "want insurance",
            "yes please", "yes", "recommend policy", "get started", "go ahead"
        ])
        llm_messages = [
            self.system_message,
            HumanMessage(content=f"""
            The user has just started a conversation with: "{last_message.content}"

            User information we have:
            {state.get("user_info", {})}

            Respond naturally to their message as a helpful AI assistant called Cora. Be conversational and friendly.

            If they've mentioned insurance, policies, coverage, or said "yes" to recommendations,
            acknowledge that you'll help with insurance recommendations using their existing profile information.

            If the user hasn't mentioned insurance at all, just respond to their message naturally without bringing up
            insurance topics. Be helpful about whatever subject they're discussing.

            IMPORTANT: NEVER ask for personal information - we already have it from their onboarding profile.
            If we don't have their profile information, DO NOT ask for it - just respond to their current message.
            """)
        ]
        if not self.llm:
            self.llm = self.llm_utility.get_llm()
        response = self.llm.invoke(llm_messages)
        next_stage = "collecting_info" if is_insurance_request else "general_conversation"
        return {
            "messages": messages + [response],
            "user_info": state.get("user_info", {}),
            "policy_details": state.get("policy_details", {}),
            "recommendation_result": state.get("recommendation_result", None),
            "conversation_stage": next_stage,
            "step_count": state.get("step_count", 0) + 1
        }

    def collect_info_node(self, state: CommunicationState) -> CommunicationState:
        """Load user information from profile and prepare for policy selection."""
        last_message = state["messages"][-1]
        user_info = state["user_info"] or {}
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            The user is interested in life insurance policy recommendations.

            User profile information we have:
            {user_info}

            IMPORTANT: DO NOT ask the user for ANY personal information. We already have their profile data.

            If we have their profile information, acknowledge that you'll use it to provide personalized recommendations.
            If we don't have their profile information, apologize and explain that you need their profile data to provide recommendations.

            Ask ONLY about their insurance preferences (policy type, coverage amount) if needed.

            User message: {last_message.content}
            """)
        ]
        if not self.llm:
            self.llm = self.llm_utility.get_llm()
        response = self.llm.invoke(messages)
        if "diet" in user_info and "health" not in user_info:
            user_info["health"] = f"Diet: {user_info['diet']}"
        required_fields = ["age", "gender", "smoking", "health"]
        has_basic_info = all(key in user_info for key in required_fields)
        next_stage = "policy_selection" if has_basic_info else "collecting_info"
        return {
            "messages": state["messages"] + [response],
            "user_info": user_info,
            "policy_details": state["policy_details"],
            "recommendation_result": state["recommendation_result"],
            "conversation_stage": next_stage,
            "step_count": state.get("step_count", 0) + 1
        }

    def policy_selection_node(self, state: CommunicationState) -> CommunicationState:
        """Help the user select a policy type and coverage amount."""
        last_message = state["messages"][-1]
        policy_details = state["policy_details"] or {}
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            You are helping the user select a policy type and coverage amount.

            User profile information:
            {state["user_info"]}

            Current policy preferences:
            {policy_details}

            Extract any policy preferences from the user's message and update our understanding.
            If we have enough information (policy_type, coverage_amount), we'll proceed to generate recommendations.
            If we don't have enough information, explain the different policy types (Term Life, Whole Life, Universal Life)
            and ask about their coverage needs.

            IMPORTANT: DO NOT ask for personal information like age, gender, health status, etc.
            We already have this from their profile.

            User message: {last_message.content}
            """)
        ]
        if not self.llm:
            self.llm = self.llm_utility.get_llm()
        response = self.llm.invoke(messages)
        has_policy_info = all(key in policy_details for key in ["policy_type", "coverage_amount"])
        affirmative_responses = ["yes please", "yes", "sure", "ok", "okay", "go ahead"]
        if any(term in last_message.content.lower() for term in affirmative_responses) and not has_policy_info:
            policy_details["policy_type"] = "Term Life"
            policy_details["coverage_amount"] = 2000000
            policy_details["term_length"] = 20
            has_policy_info = True
        return {
            "messages": state["messages"] + [response],
            "user_info": state["user_info"],
            "policy_details": policy_details,
            "recommendation_result": state["recommendation_result"],
            "conversation_stage": "recommendation" if has_policy_info else "policy_selection",
            "step_count": state.get("step_count", 0) + 1
        }

    def recommendation_node(self, state: CommunicationState) -> CommunicationState:
        """Generate policy recommendations using other agents."""
        risk_assessment_result = self.risk_agent.invoke(state["user_info"])
        premium_calculation_result = self.premium_agent.invoke(state["user_info"], risk_assessment_result, state["policy_details"])
        policy_recommendation = self.policy_agent.invoke_with_results(state["user_info"], risk_assessment_result, premium_calculation_result)
        recommendation_result = {
            "risk_assessment": risk_assessment_result,
            "premium_calculation": premium_calculation_result,
            "policy_recommendation": policy_recommendation
        }
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            Based on the user's profile information and policy preferences, we have the following recommendation:

            Risk Assessment:
            - Risk Score: {recommendation_result["risk_assessment"].get("risk_score")}
            - Risk Factors: {recommendation_result["risk_assessment"].get("risk_factors")}

            Premium Calculation:
            - Annual Premium: ${recommendation_result["premium_calculation"].get("annual_premium")}
            - Monthly Premium: ${recommendation_result["premium_calculation"].get("monthly_premium")}

            Policy Recommendation:
            - Recommended Policy: {recommendation_result["policy_recommendation"]["recommended_policy"]["policy_type"]}
            - Coverage Amount: ${recommendation_result["policy_recommendation"]["recommended_policy"]["coverage_amount"]}
            - Term Length: {recommendation_result["policy_recommendation"]["recommended_policy"].get("term_length", "N/A")} years
            - Premium: ${recommendation_result["policy_recommendation"]["recommended_policy"]["premium"]}

            Respond to the user with this recommendation. Ask if they would like to accept this policy.
            """)
        ]
        if not self.llm:
            self.llm = self.llm_utility.get_llm()
        response = self.llm.invoke(messages)
        return {
            "messages": state["messages"] + [response],
            "user_info": state["user_info"],
            "policy_details": state["policy_details"],
            "recommendation_result": recommendation_result,
            "conversation_stage": "policy_acceptance",
            "step_count": state.get("step_count", 0) + 1
        }

    def policy_acceptance_node(self, state: CommunicationState) -> CommunicationState:
        """Handle the user's acceptance or rejection of the recommended policy."""
        last_message = state["messages"][-1]
        message_lower = last_message.content.lower()
        accepted = any(term in message_lower for term in ["accept", "i accept", "yes", "agree", "approved"])
        declined = any(term in message_lower for term in ["decline", "i decline", "no", "reject", "don't want"])
        if accepted:
            content = f"""
            The user has ACCEPTED the policy recommendation with this message: "{last_message.content}"

            Thank them for accepting and explain next steps.
            """
        elif declined:
            content = f"""
            The user has DECLINED the policy recommendation with this message: "{last_message.content}"

            Acknowledge their decision and offer alternatives.
            """
        else:
            content = f"""
            The user has responded but hasn't clearly accepted or declined: "{last_message.content}"

            Ask for clarification if they accept or decline the policy.
            """
        messages = [
            self.system_message,
            HumanMessage(content=content)
        ]
        if not self.llm:
            self.llm = self.llm_utility.get_llm()
        response = self.llm.invoke(messages)
        next_stage = "followup" if (accepted or declined) else "policy_acceptance"
        return {
            "messages": state["messages"] + [response],
            "user_info": state["user_info"],
            "policy_details": state["policy_details"],
            "recommendation_result": state["recommendation_result"],
            "conversation_stage": next_stage,
            "step_count": state.get("step_count", 0) + 1
        }

    def followup_node(self, state: CommunicationState) -> CommunicationState:
        """Follow up with the user after a decision."""
        last_message = state["messages"][-1]
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            The user has received our policy recommendation and has made a decision. We are now in the follow-up phase.

            Respond to their question or comment about the policy.
            Be conversational, helpful, and concise.

            User message: {last_message.content}
            """)
        ]
        if not self.llm:
            self.llm = self.llm_utility.get_llm()
        response = self.llm.invoke(messages)
        is_complete = any(term in last_message.content.lower() for term in ["thank you", "goodbye", "bye", "thanks", "that's all"])
        return {
            "messages": state["messages"] + [response],
            "user_info": state["user_info"],
            "policy_details": state["policy_details"],
            "recommendation_result": state["recommendation_result"],
            "conversation_stage": "completed" if is_complete else "followup",
            "step_count": state.get("step_count", 0) + 1
        }

    def general_conversation_node(self, state: CommunicationState) -> CommunicationState:
        """Handle general conversation not related to insurance."""
        last_message = state["messages"][-1]
        messages = [
            self.system_message,
            HumanMessage(content=f"""
            The user has sent a general message: "{last_message.content}"

            User details we already have:
            {state.get("user_info", {})}

            Respond in a helpful, conversational manner.
            If they ask about insurance, offer to help with recommendations.
            Otherwise, just be helpful about whatever they're asking.

            NEVER ask for personal information.
            """)
        ]
        if not self.llm:
            self.llm = self.llm_utility.get_llm()
        response = self.llm.invoke(messages)
        is_insurance_related = self._is_insurance_related(last_message.content)
        next_stage = "collecting_info" if is_insurance_related else "general_conversation"
        return {
            "messages": state["messages"] + [response],
            "user_info": state.get("user_info", {}),
            "policy_details": state.get("policy_details", {}),
            "recommendation_result": state["recommendation_result"],
            "conversation_stage": next_stage,
            "step_count": state.get("step_count", 0) + 1
        }

    def completed_node(self, state: CommunicationState) -> CommunicationState:
        """Handle completed conversations."""
        return state

    ### Graph Creation ###

    def _create_graph(self) -> StateGraph:
        """
        Create the graph for the communication agent.
        
        Returns:
            The compiled graph.
        """
        try:
            from langgraph.graph import StateGraph

            # Define node functions
            def greeting_node(state: CommunicationState) -> CommunicationState:
                """
                Greet the user and engage in general conversation.
                """
                # Get the last user message
                last_message = state["messages"][-1]
                
                # Check if user is requesting insurance recommendations
                is_insurance_request = any(term in last_message.content.lower() for term in [
                    "suggest", "recommend", "insurance", "policy", "coverage", 
                    "protection", "life insurance", "need policy", "want insurance",
                    "yes please", "yes", "recommend policy", "get started", "go ahead"
                ])
                
                # Create a message for the LLM
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has just started a conversation with: "{last_message.content}"
                    
                    User information we have:
                    {state.get("user_info", {})}
                    
                    Respond naturally to their message as a helpful AI assistant called Cora. Be conversational and friendly.
                    
                    If they've mentioned insurance, policies, coverage, or said "yes" to recommendations,
                    acknowledge that you'll help with insurance recommendations using their existing profile information.
                    
                    If the user hasn't mentioned insurance at all, just respond to their message naturally without bringing up 
                    insurance topics. Be helpful about whatever subject they're discussing.
                    
                    IMPORTANT: NEVER ask for personal information - we already have it from their onboarding profile.
                    If we don't have their profile information, DO NOT ask for it - just respond to their current message.
                    """)
                ]
                
                # Get response from LLM
                if not self.llm:
                    self.llm = self.llm_utility.get_llm()
                response = self.llm.invoke(messages)
                
                # If the message indicates interest in insurance, move to collecting_info
                next_stage = "collecting_info" if is_insurance_request else "general_conversation"
                
                # Update the state
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state.get("user_info", {}),
                    "policy_details": state.get("policy_details", {}),
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": next_stage,
                    "step_count": state.get("step_count", 0) + 1
                }
                
            def collect_info_node(state: CommunicationState) -> CommunicationState:
                """
                Load user information from profile and prepare for policy selection.
                """
                last_message = state["messages"][-1]
                user_info = state["user_info"] or {}
                
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user is interested in life insurance policy recommendations.
                    
                    User profile information we have:
                    {user_info}
                    
                    IMPORTANT: DO NOT ask the user for ANY personal information. We already have their profile data.
                    
                    If we have their profile information, acknowledge that you'll use it to provide personalized recommendations.
                    If we don't have their profile information, apologize and explain that you need their profile data to provide recommendations.
                    
                    Ask ONLY about their insurance preferences (policy type, coverage amount) if needed.
                    
                    User message: {last_message.content}
                    """)
                ]
                
                if not self.llm:
                    self.llm = self.llm_utility.get_llm()
                response = self.llm.invoke(messages)
                
                # Check if diet info exists but health doesn't
                if "diet" in user_info and "health" not in user_info:
                    user_info["health"] = f"Diet: {user_info['diet']}"
                
                # Check if all required fields are available
                required_fields = ["age", "gender", "smoking", "health"]
                has_basic_info = all(key in user_info for key in required_fields)
                
                # Determine next stage
                next_stage = "policy_selection" if has_basic_info else "collecting_info"
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": user_info,
                    "policy_details": state["policy_details"],
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": next_stage,
                    "step_count": state.get("step_count", 0) + 1
                }
                
            def policy_selection_node(state: CommunicationState) -> CommunicationState:
                """
                Help the user select a policy type and coverage amount.
                """
                last_message = state["messages"][-1]
                policy_details = state["policy_details"] or {}
                
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    You are helping the user select a policy type and coverage amount.
                    
                    User profile information:
                    {state["user_info"]}
                    
                    Current policy preferences:
                    {policy_details}
                    
                    Extract any policy preferences from the user's message and update our understanding.
                    If we have enough information (policy_type, coverage_amount), we'll proceed to generate recommendations.
                    If we don't have enough information, explain the different policy types (Term Life, Whole Life, Universal Life)
                    and ask about their coverage needs.
                    
                    IMPORTANT: DO NOT ask for personal information like age, gender, health status, etc.
                    We already have this from their profile.
                    
                    User message: {last_message.content}
                    """)
                ]
                
                if not self.llm:
                    self.llm = self.llm_utility.get_llm()
                response = self.llm.invoke(messages)
                
                # Check if we have enough policy information
                has_policy_info = all(key in policy_details for key in ["policy_type", "coverage_amount"])
                
                # Handle affirmative responses
                affirmative_responses = ["yes please", "yes", "sure", "ok", "okay", "go ahead"]
                if any(term in last_message.content.lower() for term in affirmative_responses) and not has_policy_info:
                    policy_details["policy_type"] = "Term Life"
                    policy_details["coverage_amount"] = 2000000
                    policy_details["term_length"] = 20
                    has_policy_info = True
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": policy_details,
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": "recommendation" if has_policy_info else "policy_selection",
                    "step_count": state.get("step_count", 0) + 1
                }
                
            def recommendation_node(state: CommunicationState) -> CommunicationState:
                """
                Generate policy recommendations using other agents.
                """
                # Get risk assessment
                risk_assessment_result = self.risk_agent.invoke(state["user_info"])
                
                # Calculate premium
                premium_calculation_result = self.premium_agent.invoke(
                    state["user_info"], 
                    risk_assessment_result, 
                    state["policy_details"]
                )
                
                # Get policy recommendation
                policy_recommendation = self.policy_agent.invoke_with_results(
                    state["user_info"], 
                    risk_assessment_result, 
                    premium_calculation_result
                )
                
                # Compile recommendation results
                recommendation_result = {
                    "risk_assessment": risk_assessment_result,
                    "premium_calculation": premium_calculation_result,
                    "policy_recommendation": policy_recommendation
                }
                
                # Create message for the LLM
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    Based on the user's profile information and policy preferences, we have the following recommendation:
                    
                    Risk Assessment:
                    - Risk Score: {recommendation_result["risk_assessment"].get("risk_score")}
                    - Risk Factors: {recommendation_result["risk_assessment"].get("risk_factors")}
                    
                    Premium Calculation:
                    - Annual Premium: ${recommendation_result["premium_calculation"].get("annual_premium")}
                    - Monthly Premium: ${recommendation_result["premium_calculation"].get("monthly_premium")}
                    
                    Policy Recommendation:
                    - Recommended Policy: {recommendation_result["policy_recommendation"]["recommended_policy"]["policy_type"]}
                    - Coverage Amount: ${recommendation_result["policy_recommendation"]["recommended_policy"]["coverage_amount"]}
                    - Term Length: {recommendation_result["policy_recommendation"]["recommended_policy"].get("term_length", "N/A")} years
                    - Premium: ${recommendation_result["policy_recommendation"]["recommended_policy"]["premium"]}
                    
                    Respond to the user with this recommendation. Ask if they would like to accept this policy.
                    """)
                ]
                
                if not self.llm:
                    self.llm = self.llm_utility.get_llm()
                response = self.llm.invoke(messages)
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": state["policy_details"],
                    "recommendation_result": recommendation_result,
                    "conversation_stage": "policy_acceptance",
                    "step_count": state.get("step_count", 0) + 1
                }
                
            def policy_acceptance_node(state: CommunicationState) -> CommunicationState:
                """
                Handle the user's acceptance or rejection of the recommended policy.
                """
                last_message = state["messages"][-1]
                message_lower = last_message.content.lower()
                
                # Check if the user has accepted or declined
                accepted = any(term in message_lower for term in ["accept", "i accept", "yes", "agree", "approved"])
                declined = any(term in message_lower for term in ["decline", "i decline", "no", "reject", "don't want"])
                
                # Create content for LLM based on user response
                if accepted:
                    content = f"""
                    The user has ACCEPTED the policy recommendation with this message: "{last_message.content}"
                    
                    Thank them for accepting and explain next steps.
                    """
                elif declined:
                    content = f"""
                    The user has DECLINED the policy recommendation with this message: "{last_message.content}"
                    
                    Acknowledge their decision and offer alternatives.
                    """
                else:
                    content = f"""
                    The user has responded but hasn't clearly accepted or declined: "{last_message.content}"
                    
                    Ask for clarification if they accept or decline the policy.
                    """
                
                messages = [
                    self.system_message,
                    HumanMessage(content=content)
                ]
                
                if not self.llm:
                    self.llm = self.llm_utility.get_llm()
                response = self.llm.invoke(messages)
                
                # Determine next stage
                next_stage = "followup" if (accepted or declined) else "policy_acceptance"
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": state["policy_details"],
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": next_stage,
                    "step_count": state.get("step_count", 0) + 1
                }
                
            def followup_node(state: CommunicationState) -> CommunicationState:
                """
                Follow up with the user after a decision.
                """
                last_message = state["messages"][-1]
                
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has received our policy recommendation and has made a decision. We are now in the follow-up phase.
                    
                    Respond to their question or comment about the policy.
                    Be conversational, helpful, and concise.
                    
                    User message: {last_message.content}
                    """)
                ]
                
                if not self.llm:
                    self.llm = self.llm_utility.get_llm()
                response = self.llm.invoke(messages)
                
                # Check if the conversation is complete
                is_complete = any(term in last_message.content.lower() for term in ["thank you", "goodbye", "bye", "thanks", "that's all"])
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state["user_info"],
                    "policy_details": state["policy_details"],
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": "completed" if is_complete else "followup",
                    "step_count": state.get("step_count", 0) + 1
                }
                
            def general_conversation_node(state: CommunicationState) -> CommunicationState:
                """
                Handle general conversation not related to insurance.
                """
                last_message = state["messages"][-1]
                
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has sent a general message: "{last_message.content}"
                    
                    User details we already have:
                    {state.get("user_info", {})}
                    
                    Respond in a helpful, conversational manner.
                    If they ask about insurance, offer to help with recommendations.
                    Otherwise, just be helpful about whatever they're asking.
                    
                    NEVER ask for personal information.
                    """)
                ]
                
                if not self.llm:
                    self.llm = self.llm_utility.get_llm()
                response = self.llm.invoke(messages)
                
                # Check if the message is insurance related
                is_insurance_related = self._is_insurance_related(last_message.content)
                next_stage = "collecting_info" if is_insurance_related else "general_conversation"
                
                return {
                    "messages": state["messages"] + [response],
                    "user_info": state.get("user_info", {}),
                    "policy_details": state.get("policy_details", {}),
                    "recommendation_result": state["recommendation_result"],
                    "conversation_stage": next_stage,
                    "step_count": state.get("step_count", 0) + 1
                }
                
            def completed_node(state: CommunicationState) -> CommunicationState:
                """
                Handle completed conversations.
                """
                return state

            # Create the graph
            workflow = StateGraph(CommunicationState)
            
            # Add all the nodes
            workflow.add_node("greeting", greeting_node)
            workflow.add_node("collecting_info", collect_info_node)
            workflow.add_node("policy_selection", policy_selection_node)
            workflow.add_node("recommendation", recommendation_node)
            workflow.add_node("policy_acceptance", policy_acceptance_node)
            workflow.add_node("followup", followup_node)
            workflow.add_node("general_conversation", general_conversation_node)
            workflow.add_node("completed", completed_node)
            
            # Define the edges
            # Set the entry point for the workflow
            workflow.set_entry_point("greeting")
            
            # Define the edges
            workflow.add_edge("greeting", "general_conversation")
            workflow.add_edge("greeting", "collecting_info")
            workflow.add_edge("greeting", "policy_selection")
            
            workflow.add_edge("general_conversation", "general_conversation")
            workflow.add_edge("general_conversation", "collecting_info")
            workflow.add_edge("general_conversation", "policy_selection")
            
            workflow.add_edge("collecting_info", "collecting_info")
            workflow.add_edge("collecting_info", "policy_selection")
            
            workflow.add_edge("policy_selection", "policy_selection")
            workflow.add_edge("policy_selection", "recommendation")
            
            workflow.add_edge("recommendation", "policy_acceptance")
            
            workflow.add_edge("policy_acceptance", "policy_acceptance")
            workflow.add_edge("policy_acceptance", "followup")
            
            workflow.add_edge("followup", "followup")
            workflow.add_edge("followup", "completed")
            
            # Compile the graph
            return workflow.compile()
        except Exception as e:
            print(f"Error creating graph: {str(e)}")
            return None

    ### Remaining Methods (Unchanged from Original) ###

    def _direct_recommendation(self, state: CommunicationState) -> CommunicationState:
        """Get policy recommendations directly without running the full graph."""
        print(f"Step 1: Getting risk assessment from risk assessment agent")
        risk_assessment_result = self.risk_agent.invoke(state["user_info"])
        print(f"Risk assessment completed with score: {risk_assessment_result.get('risk_score')}")

        print(f"Step 2: Getting premium calculation from premium calculation agent")
        premium_calculation_result = self.premium_agent.invoke(
            state["user_info"],
            risk_assessment_result,
            state["policy_details"]
        )
        print(f"Premium calculation completed with annual premium: ${premium_calculation_result.get('annual_premium')}")

        print(f"Step 3: Getting policy recommendation from policy recommendation agent")
        policy_recommendation = self.policy_agent.invoke_with_results(
            state["user_info"],
            risk_assessment_result,
            premium_calculation_result
        )
        print(f"Policy recommendation completed with recommended policy: {policy_recommendation['recommended_policy']['policy_type']}")

        recommendation_result = {
            "risk_assessment": risk_assessment_result,
            "premium_calculation": premium_calculation_result,
            "policy_recommendation": policy_recommendation
        }

        response = None
        try:
            if self.llm is None:
                self.llm = self.llm_utility.get_llm()
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
                - Term Length: {recommendation_result["policy_recommendation"]["recommended_policy"].get("term_length", "N/A")} years
                - Premium: ${recommendation_result["policy_recommendation"]["recommended_policy"]["premium"]}
                - Recommended Riders: {recommendation_result["policy_recommendation"]["recommended_policy"]["recommended_riders"]}

                Alternative Policies:
                {recommendation_result["policy_recommendation"]["alternative_policies"]}

                Explanation:
                {recommendation_result["policy_recommendation"]["explanation"]}

                Respond to the user by summarizing this recommendation in a clear, friendly, and professional manner.
                Address the user by name if available.
                Explain the recommendation and why it's suitable based on their risk profile and needs.
                Ask if they have any questions or if they'd like to proceed with the recommended policy.
                Mention that we are moving to the follow-up phase to address any questions they might have.
                """)
            ]
            response = self.llm.invoke(messages)
        except Exception as e:
            print(f"Error generating recommendation response: {str(e)}")
            response = AIMessage(content=f"""
            Based on your profile, I've analyzed several policy options for you.

            Our recommendation is a {recommendation_result["policy_recommendation"]["recommended_policy"]["policy_type"]} policy with
            ${recommendation_result["policy_recommendation"]["recommended_policy"]["coverage_amount"]} coverage.

            The premium would be approximately ${recommendation_result["policy_recommendation"]["recommended_policy"]["premium"]} per month.

            Would you like more details about this policy or would you prefer to explore other options?
            """)

        return {
            "messages": state["messages"] + [response],
            "user_info": state["user_info"],
            "policy_details": state["policy_details"],
            "recommendation_result": recommendation_result,
            "conversation_stage": "followup",
            "step_count": state.get("step_count", 0) + 1
        }

    def invoke(self, message: str, user_id: str = "default_user", user_details: Dict[str, Any] = None) -> Dict[str, Any]:
        """Invoke the communication agent synchronously."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            result = loop.run_until_complete(self.invoke_async(message, user_id, user_details))
            if asyncio.get_event_loop() != loop:
                loop.close()
            return result
        except Exception as e:
            print(f"Error in invoke: {str(e)}")
            return {"response": "I'm sorry, I encountered an error. Please try again.", "conversation_stage": "greeting"}

    def _process_json_input(self, message: str, user_id: str) -> bool:
        """Process JSON input from the user and update conversation history."""
        try:
            json_data = json.loads(message)
            if not isinstance(json_data, dict):
                return False
        except json.JSONDecodeError:
            return False

        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = {
                "messages": [self.system_message],
                "user_info": {},
                "policy_details": {},
                "recommendation_result": None,
                "conversation_stage": "greeting",
                "step_count": 0
            }

        if "user_info" in json_data and json_data["user_info"]:
            self.conversation_history[user_id]["user_info"].update(json_data["user_info"])
            print(f"Updated user info from JSON: {self.conversation_history[user_id]['user_info']}")
            if "diet" in json_data["user_info"] and "health" not in self.conversation_history[user_id]["user_info"]:
                self.conversation_history[user_id]["user_info"]["health"] = f"Diet: {json_data['user_info']['diet']}"

        if "policy_details" in json_data and json_data["policy_details"]:
            self.conversation_history[user_id]["policy_details"].update(json_data["policy_details"])
            print(f"Updated policy details from JSON: {self.conversation_history[user_id]['policy_details']}")

        return "user_info" in json_data or "policy_details" in json_data

    def _is_general_question(self, message: str) -> bool:
        """Check if the message is a general question."""
        message = message.lower().strip()
        insurance_terms = [
            "insurance", "policy", "coverage", "premium", "claim", "beneficiary",
            "underwriting", "death benefit", "term", "whole life", "universal",
            "rider", "quote", "risk", "application", "health", "medical",
            "recommend", "suggest", "option", "plan"
        ]
        affirmative_responses = [
            "yes please", "yes", "sure", "ok", "okay", "go ahead",
            "please do", "i'd like that", "sounds good", "that would be great"
        ]
        is_affirmative = any(resp in message for resp in affirmative_responses)
        contains_insurance_terms = any(term in message for term in insurance_terms)
        if is_affirmative:
            return False
        is_greeting = len(message.split()) <= 7 and any(
            greeting in message for greeting in [
                "hi", "hello", "hey", "good morning", "good afternoon",
                "good evening", "what's up", "how are you"
            ]
        )
        is_about_capabilities = "what can you" in message or "help me with" in message or "how do you" in message
        return (is_greeting or is_about_capabilities) and not contains_insurance_terms

    def _load_user_data(self, user_id: str) -> Dict[str, Any]:
        """Load user data from the Users folder."""
        possible_paths = [
            os.path.join("users", f"{user_id}.json"),
            os.path.join("Users", f"{user_id}.json"),
            os.path.join("users", f"{user_id.split('_')[0]}.json"),
            os.path.join("Users", f"{user_id.split('_')[0]}.json")
        ]
        for user_file_path in possible_paths:
            if os.path.exists(user_file_path):
                try:
                    with open(user_file_path, "r") as file:
                        user_data = json.load(file)
                        print(f"Loaded user data from {user_file_path}: {user_data}")
                        return user_data
                except Exception as e:
                    print(f"Error loading user data from {user_file_path}: {str(e)}")
        print(f"No user file found for user {user_id} in any of these paths: {possible_paths}")
        return None

    async def _generate_quick_response(self, message: str, user_id: str) -> AIMessage:
        """Generate a quick response for general questions."""
        user_info = self.conversation_history[user_id].get("user_info", {}) or {}
        user_name = user_info.get("name", "")
        is_about_self = any(pattern in message.lower() for pattern in [
            "tell me about myself", "who am i", "what do you know about me",
            "my information", "my details", "my profile", "what information do you have"
        ])
        if is_about_self and (not user_info or len(user_info) == 0):
            loaded_user_data = self._load_user_data(user_id)
            if loaded_user_data:
                print(f"Loaded user data on demand for personal info query: {user_id}")
                user_info = {}
                if "age" in loaded_user_data:
                    try:
                        user_info["age"] = int(loaded_user_data["age"])
                    except (ValueError, TypeError):
                        user_info["age"] = loaded_user_data["age"]
                if "gender" in loaded_user_data:
                    user_info["gender"] = loaded_user_data["gender"]
                if "name" in loaded_user_data:
                    user_info["name"] = loaded_user_data["name"]
                if "smoker" in loaded_user_data:
                    user_info["smoking"] = "yes" if loaded_user_data["smoker"] == "Yes" else "no"
                if "preExistingConditions" in loaded_user_data or "familyHistory" in loaded_user_data:
                    health_conditions = []
                    if loaded_user_data.get("preExistingConditions") == "Yes":
                        health_conditions.append("Has pre-existing conditions")
                    if loaded_user_data.get("familyHistory") == "Yes":
                        health_conditions.append("Has family history of serious illnesses")
                    if health_conditions:
                        user_info["health"] = ", ".join(health_conditions)
                if "income" in loaded_user_data:
                    user_info["income"] = loaded_user_data["income"]
                if "maritalStatus" in loaded_user_data:
                    user_info["marital_status"] = loaded_user_data["maritalStatus"]
                if "occupation" in loaded_user_data:
                    user_info["occupation"] = loaded_user_data["occupation"]
                self.conversation_history[user_id]["user_info"] = user_info

        is_insurance_education = any(pattern in message.lower() for pattern in [
            "what is life insurance", "what is insurance", "what is a policy",
            "how does life insurance work", "explain life insurance", "tell me about life insurance",
            "types of insurance", "types of life insurance", "different policies",
            "difference between", "explain the difference", "what's the difference",
            "no, just tell me", "just explain"
        ])

        if is_insurance_education:
            messages = [
                SystemMessage(content="""You are Cora, a knowledgeable AI assistant specializing in insurance topics.
                Provide educational, informative responses about insurance concepts.
                Focus on explaining the topic clearly without asking for personal information.
                Be helpful, concise, and informative. Don't try to collect user details or promote specific policies.
                """),
                HumanMessage(content=f"""
                The user has asked an educational question about insurance: "{message}"

                Provide a helpful, educational explanation about the requested insurance topic.
                Focus on being informative and educational rather than trying to sell a policy.
                Don't ask for personal information - just explain the concept they're asking about.

                After explaining, you can mention that if they're interested in personalized recommendations later,
                you'd be happy to help, but don't pressure them for information.
                """)
            ]
        elif is_about_self:
            if user_info and len(user_info) > 0:
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has asked about their personal information: "{message}"

                    User details we have:
                    {user_info}

                    Provide a friendly summary of the information we have about them. Use their name
                    if available. Mention key details like their age, gender, health status, etc.
                    Be conversational and friendly. If there are gaps in our information, you can acknowledge that.

                    Don't ask for additional information - just summarize what we already know.
                    """)
                ]
            else:
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has asked about their personal information: "{message}"

                    We don't have any user information stored yet.

                    Explain that you don't have their information yet, but that you can help them with other questions.
                    Invite them to complete the onboarding process if they'd like to share their details for personalized
                    insurance recommendations. Be conversational and friendly.
                    """)
                ]
        else:
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                The user has sent a general message: "{message}"

                User details we already have:
                {user_info}

                Provide a quick, friendly response that:
                1. Greets them by name if available
                2. Addresses their specific question directly
                3. If the question is about your capabilities, explain that you're a versatile assistant who can discuss many topics and also help with insurance questions if they're interested
                4. Be conversational and helpful without pushing for personal information unless they specifically ask for insurance recommendations

                Keep your response concise, friendly, and helpful. Focus on answering their immediate question.
                """)
            ]

        try:
            if not hasattr(self, 'llm_utility') or self.llm_utility is None:
                print(f"LLM utility not available for async invocation. Using direct response.")
                return AIMessage(content="Hello! I'm here to help with any questions you have about insurance or general topics. How can I assist you today?")
            response = await self.llm_utility.ainvoke(messages, temperature=0.7, max_tokens=400)
            return response
        except Exception as e:
            print(f"Error generating quick response: {str(e)}")
            return AIMessage(content="Hello! I'm here to help with any questions you have about insurance or general topics. How can I assist you today?")

    def _generate_quick_response_sync(self, message: str, user_id: str) -> AIMessage:
        """Generate a quick response synchronously."""
        user_info = self.conversation_history[user_id]["user_info"]
        user_name = user_info.get("name", "")
        is_about_self = any(pattern in message.lower() for pattern in [
            "tell me about myself", "who am i", "what do you know about me",
            "my information", "my details", "my profile", "what information do you have"
        ])
        if is_about_self and (not user_info or len(user_info) == 0):
            loaded_user_data = self._load_user_data(user_id)
            if loaded_user_data:
                print(f"Loaded user data on demand for personal info query: {user_id}")
                user_info = {}
                if "age" in loaded_user_data:
                    try:
                        user_info["age"] = int(loaded_user_data["age"])
                    except (ValueError, TypeError):
                        user_info["age"] = loaded_user_data["age"]
                if "gender" in loaded_user_data:
                    user_info["gender"] = loaded_user_data["gender"]
                if "name" in loaded_user_data:
                    user_info["name"] = loaded_user_data["name"]
                if "smoker" in loaded_user_data:
                    user_info["smoking"] = "yes" if loaded_user_data["smoker"] == "Yes" else "no"
                if "diet" in loaded_user_data:
                    user_info["health"] = f"Diet: {loaded_user_data['diet']}"
                if "preExistingConditions" in loaded_user_data or "familyHistory" in loaded_user_data:
                    health_conditions = []
                    if loaded_user_data.get("preExistingConditions") == "Yes":
                        health_conditions.append("Has pre-existing conditions")
                    if loaded_user_data.get("familyHistory") == "Yes":
                        health_conditions.append("Has family history of serious illnesses")
                    if health_conditions:
                        if "health" in user_info:
                            user_info["health"] += ", " + ", ".join(health_conditions)
                        else:
                            user_info["health"] = ", ".join(health_conditions)
                if "income" in loaded_user_data:
                    user_info["income"] = loaded_user_data["income"]
                if "maritalStatus" in loaded_user_data:
                    user_info["marital_status"] = loaded_user_data["maritalStatus"]
                if "occupation" in loaded_user_data:
                    user_info["occupation"] = loaded_user_data["occupation"]
                self.conversation_history[user_id]["user_info"] = user_info

        is_insurance_education = any(pattern in message.lower() for pattern in [
            "what is life insurance", "what is insurance", "what is a policy",
            "how does life insurance work", "explain life insurance", "tell me about life insurance",
            "types of insurance", "types of life insurance", "different policies",
            "difference between", "explain the difference", "what's the difference",
            "no, just tell me", "just explain"
        ])

        if is_insurance_education:
            messages = [
                SystemMessage(content="""You are Cora, a knowledgeable AI assistant specializing in insurance topics.
                Provide educational, informative responses about insurance concepts.
                Focus on explaining the topic clearly without asking for personal information.
                Be helpful, concise, and informative. Don't try to collect user details or promote specific policies.
                """),
                HumanMessage(content=f"""
                The user has asked an educational question about insurance: "{message}"

                Provide a helpful, educational explanation about the requested insurance topic.
                Focus on being informative and educational rather than trying to sell a policy.
                Don't ask for personal information - just explain the concept they're asking about.

                After explaining, you can mention that if they're interested in personalized recommendations later,
                you'd be happy to help, but don't pressure them for information.
                """)
            ]
        elif is_about_self:
            if user_info and len(user_info) > 0:
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has asked about their personal information: "{message}"

                    User details we have:
                    {user_info}

                    Provide a friendly summary of the information we have about them. Use their name
                    if available. Mention key details like their age, gender, health status, etc.
                    Be conversational and friendly. If there are gaps in our information, you can acknowledge that.

                    Don't ask for additional information - just summarize what we already know.
                    """)
                ]
            else:
                messages = [
                    self.system_message,
                    HumanMessage(content=f"""
                    The user has asked about their personal information: "{message}"

                    We don't have any user information stored yet.

                    Explain that you don't have their information yet, but that you can help them with other questions.
                    Invite them to complete the onboarding process if they'd like to share their details for personalized
                    insurance recommendations. Be conversational and friendly.
                    """)
                ]
        else:
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                The user has sent a general message: "{message}"

                User details we already have:
                {user_info}

                Provide a quick, friendly response that:
                1. Greets them by name if available
                2. Addresses their specific question directly
                3. If the question is about your capabilities, explain that you're a versatile assistant who can discuss many topics and also help with insurance questions if they're interested
                4. Be conversational and helpful without pushing for personal information unless they specifically ask for insurance recommendations

                Keep your response concise, friendly, and helpful. Focus on answering their immediate question.
                """)
            ]

        try:
            response = self.llm_utility.invoke(messages, temperature=0.7, max_tokens=400)
            return response
        except Exception as e:
            print(f"Error generating quick response: {str(e)}")
            return AIMessage(content="Hello! I'm here to help with any questions you have about insurance or general topics. How can I assist you today?")

    def get_conversation_history(self, user_id: str) -> List[Dict[str, Any]]:
        """Get the conversation history for a user."""
        if user_id not in self.conversation_history:
            return []
        history = []
        for msg in self.conversation_history[user_id]["messages"]:
            if isinstance(msg, HumanMessage):
                history.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                history.append({"role": "assistant", "content": msg.content})
        return history

    def _is_insurance_related(self, message: str) -> bool:
        """Determine if a message is related to insurance topics."""
        message_lower = message.lower()
        insurance_terms = [
            "insurance", "policy", "coverage", "premium", "term life", "whole life",
            "life insurance", "health insurance", "medical insurance", "risk assessment",
            "insure", "benefits", "claim", "protection", "financial security",
            "death benefit", "beneficiary", "underwriting", "quote", "riders"
        ]
        return any(term in message_lower for term in insurance_terms)

    def _get_or_initialize_conversation(self, user_id: str) -> Dict[str, Any]:
        """Get existing conversation or initialize a new one."""
        if user_id in self.conversation_history:
            return self.conversation_history[user_id]

        print(f"Initializing new conversation for user {user_id}")
        conversation = {
            "messages": [self.system_message],
            "user_info": {},
            "policy_details": {},
            "recommendation_result": None,
            "conversation_stage": "greeting",
            "step_count": 0
        }
        user_data = self._load_user_data(user_id)
        if user_data:
            print(f"Found existing user data for {user_id}: {user_data}")
            if "age" in user_data:
                try:
                    conversation["user_info"]["age"] = int(user_data["age"])
                except (ValueError, TypeError):
                    conversation["user_info"]["age"] = user_data["age"]
            if "gender" in user_data:
                conversation["user_info"]["gender"] = user_data["gender"]
            if "name" in user_data:
                conversation["user_info"]["name"] = user_data["name"]
            if "smoker" in user_data:
                conversation["user_info"]["smoking"] = "yes" if user_data["smoker"] == "Yes" else "no"
            if "diet" in user_data:
                conversation["user_info"]["diet"] = user_data["diet"]
                if "health" not in conversation["user_info"]:
                    conversation["user_info"]["health"] = f"Diet: {user_data['diet']}"
            if "preExistingConditions" in user_data or "familyHistory" in user_data:
                health_conditions = []
                if user_data.get("preExistingConditions") == "Yes":
                    health_conditions.append("Has pre-existing conditions")
                if user_data.get("familyHistory") == "Yes":
                    health_conditions.append("Has family history of serious illnesses")
                if health_conditions:
                    if "health" in conversation["user_info"]:
                        conversation["user_info"]["health"] += ", " + ", ".join(health_conditions)
                    else:
                        conversation["user_info"]["health"] = ", ".join(health_conditions)
            if "income" in user_data:
                conversation["user_info"]["income"] = user_data["income"]
            if "maritalStatus" in user_data:
                conversation["user_info"]["marital_status"] = user_data["maritalStatus"]
            if "occupation" in user_data:
                conversation["user_info"]["occupation"] = user_data["occupation"]
            required_fields = ["age", "gender", "smoking"]
            if all(field in conversation["user_info"] for field in required_fields):
                print(f"User {user_id} has required fields. Setting stage to collecting_info.")
                conversation["conversation_stage"] = "collecting_info"

        self.conversation_history[user_id] = conversation
        return conversation

    async def invoke_async(self, message: str, user_id: str = "default_user", user_details: Dict[str, Any] = None) -> Dict[str, Any]:
        """Invoke the communication agent asynchronously."""
        try:
            conversation = self._get_or_initialize_conversation(user_id)
            if user_details:
                print(f"Received user details from frontend: {user_details}")
                conversation["user_info"].update(user_details)

            user_message = HumanMessage(content=message)
            conversation["messages"].append(user_message)

            print(f"Before async graph execution - User: {user_id}, Stage: {conversation['conversation_stage']}")

            if self.graph is None:
                print(f"Graph not initialized. Creating graph for user: {user_id}")
                self.graph = self._create_graph()

            if self.graph is None:
                print("Graph initialization failed. Using direct message response.")
                current_stage = conversation["conversation_stage"]
                step_count = conversation["step_count"]
                if step_count > 0 and current_stage != "greeting":
                    is_insurance_request = any(term in message.lower() for term in [
                        "insurance", "policy", "recommend", "suggestions", "options",
                        "coverage", "protection", "life insurance", "term life", "whole life"
                    ])
                    user_info = conversation["user_info"]
                    has_user_info = len(user_info) > 2
                    if is_insurance_request and has_user_info and "policy_selection" in current_stage:
                        try:
                            print(f"Attempting direct recommendation for user {user_id} in stage {current_stage}")
                            state = conversation
                            state["policy_details"] = state.get("policy_details", {})
                            if not state["policy_details"]:
                                state["policy_details"] = {
                                    "policy_type": "Term Life",
                                    "coverage_amount": 2000000,
                                    "term_length": 20
                                }
                            updated_state = self._direct_recommendation(state)
                            conversation.update(updated_state)
                            for msg in reversed(updated_state["messages"]):
                                if isinstance(msg, AIMessage):
                                    return {
                                        "response": msg.content,
                                        "conversation_stage": "followup"
                                    }
                        except Exception as e:
                            print(f"Error in direct recommendation: {str(e)}")
                quick_response = await self._generate_quick_response(message, user_id)
                conversation["messages"].append(quick_response)
                conversation["step_count"] += 1
                return {
                    "response": quick_response.content,
                    "conversation_stage": conversation["conversation_stage"]
                }

            is_insurance_request = any(term in message.lower() for term in [
                "suggest", "recommend", "insurance", "policy", "coverage",
                "protection", "life insurance", "need policy", "want insurance",
                "yes please", "yes", "recommend policy", "get started", "go ahead"
            ])
            current_stage = conversation["conversation_stage"]
            if is_insurance_request:
                if current_stage == "greeting" or current_stage == "general_conversation":
                    print(f"Updating stage for user {user_id} from {current_stage} to collecting_info")
                    conversation["conversation_stage"] = "collecting_info"
                elif current_stage == "collecting_info":
                    user_info = conversation["user_info"]
                    required_fields = ["age", "gender", "smoking"]
                    if all(field in user_info for field in required_fields):
                        print(f"Moving user {user_id} from {current_stage} to policy_selection")
                        conversation["conversation_stage"] = "policy_selection"

            print(f"Running graph for user: {user_id}, Stage: {conversation['conversation_stage']}")
            try:
                result = self.graph.invoke(
                    conversation,
                    {
                        "recursion_limit": 50,
                        "max_concurrency": MAX_CONCURRENCY
                    }
                )
                print(f"After graph execution - User: {user_id}, Stage: {result['conversation_stage']}")
                conversation.update(result)
                for msg in reversed(result["messages"]):
                    if isinstance(msg, AIMessage):
                        return {
                            "response": msg.content,
                            "conversation_stage": result["conversation_stage"]
                        }
                return {
                    "response": "I'm sorry, I couldn't process your request. Please try again.",
                    "conversation_stage": result["conversation_stage"]
                }
            except Exception as e:
                print(f"Error running graph: {str(e)}")
                quick_response = await self._generate_quick_response(message, user_id)
                conversation["messages"].append(quick_response)
                conversation["step_count"] += 1
                return {
                    "response": quick_response.content,
                    "conversation_stage": conversation["conversation_stage"]
                }
        except Exception as e:
            print(f"Error in communication agent: {str(e)}")
            if conversation["step_count"] <= 1:
                try:
                    greeting_msg = await self.llm_utility.ainvoke([
                        self.system_message,
                        HumanMessage(content=f"""
                        The user has just started a conversation with the message: "{message}"

                        User details we already have:
                        {conversation["user_info"]}

                        Greet them warmly by name if available, and explain that you'll help them find the right life insurance policy.
                        If we're missing any essential information (age, gender, smoking status, health), ask for it.
                        If we have all the essential information, ask about their insurance needs and preferences.
                        Be conversational and friendly, but get straight to the point.
                        DO NOT provide any policy recommendations yet unless we have all required information.
                        """)
                    ])
                    conversation["messages"].append(greeting_msg)
                    conversation["step_count"] += 1
                    conversation["conversation_stage"] = "collecting_info"
                    return {
                        "response": greeting_msg.content,
                        "conversation_stage": "collecting_info"
                    }
                except Exception as inner_e:
                    print(f"Error generating greeting: {str(inner_e)}")
            current_stage = conversation["conversation_stage"]
            fallback_response = "I'm here to help with your insurance needs. Could you please let me know if you'd like me to recommend a policy based on your profile information?"
            return {
                "response": fallback_response,
                "conversation_stage": current_stage
            }