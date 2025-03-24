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
    conversation_stage: Literal["greeting", "general_conversation", "collecting_info", "policy_selection", "recommendation", "followup", "completed"]
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
            """You are Cora, a friendly and versatile AI assistant that can handle both general conversations and specialized insurance-related inquiries.

            For general conversations:
            - Answer questions on various topics clearly and helpfully
            - Engage in friendly chit-chat about any subject the user brings up
            - Provide thoughtful responses about technology, news, entertainment, general knowledge, etc.
            - Be conversational, professional, and concise in your responses
            
            For insurance-related conversations, follow this IMPORTANT PROCESS only AFTER the user brings up life insurance or health insurance:
            1. Collect the client information only after the user has started the conversation about life insurance or health insurance.
            2. Only after collecting this information, provide the details to the "risk assessment" agent to calculate the risk and the "premium calculation" agent to calculate the premium.
            3. Only after the risk and premium are calculated, provide the details to the "policy recommendation" agent to recommend the best policy.
            4. Only after the policy is recommended, provide the details to the "follow up" agent to follow up with the client. 
            5. Only after the follow up is completed, the conversation is over.

            ALWAYS follow this sequence exactly as described, but ONLY initiate it when the user explicitly asks about insurance policies or coverage. Do not proactively bring up insurance topics unless the user shows interest first.
            
            For insurance conversations:
            - Collect all necessary client information (age, gender, health status, smoking habits, etc.)
            - Help clients understand policy options (term life, whole life, etc.)
            - Explain coverage amounts and terms
            - Process recommendations based on client risk profile
            
            Always refer to the user history to maintain context and continuity in the conversation.
            Refer to the details provided by the user earlier in the conversation to maintain context and don't ask for the details always.
            Be conversational, professional, and concise in your responses.
            You should mention the current stage of the process to the client only when engaged in insurance discussions.
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
            print("Creating risk agent    mardav chtiya")
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
            Greet the user and engage in general conversation.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state.
            """
            # Initial greeting - General conversation
            print(f"Initial greeting - Starting general conversation")
            
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                The user has just started a conversation with: "{last_message.content}"
                
                Respond naturally to their message as a helpful AI assistant called Cora. Be conversational and friendly.
                
                If they've mentioned insurance, policies, coverage, or similar topics, 
                you can acknowledge that you can help with insurance inquiries and can collect their information to provide 
                personalized recommendations when they're ready.
                
                If the user hasn't mentioned insurance at all, just respond to their message naturally without bringing up 
                insurance topics. Be helpful about whatever subject they're discussing.
                
                Do not proactively ask for personal information unless they've explicitly mentioned interest in insurance.
                """)
            ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # Determine if we should move to collecting insurance info or stay in general conversation
            is_insurance_related = self._is_insurance_related(last_message.content)
            next_stage = "collecting_info" if is_insurance_related else "general_conversation"
            
            # Update the state
            return {
                "messages": state["messages"] + [response],
                "user_info": state.get("user_info", {}),
                "policy_details": state.get("policy_details", {}),
                "recommendation_result": state["recommendation_result"],
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
            print(state)
            # Step 1: Collect user information
            print(f"Step 1: Collecting user information")
            
            # Get the last user message
            last_message = state["messages"][-1]
            
            
            # Extract user information from the message
            user_info = state["user_info"] or {}
            print(f"User info: {user_info}")
            
            # Check if this is the first time we're collecting info (transition from greeting)
            is_first_time = state.get("step_count", 0) <= 1 or len(user_info) == 0
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                You are collecting information from the user to provide a life insurance policy recommendation.
                This is step 1 of our process - information collection.
                
                Current information we have:
                {user_info}
                
                {"Since this is the first time the user has expressed interest in insurance, acknowledge their interest and explain that you'll need some information to provide personalized recommendations. Be conversational and friendly." if is_first_time else ""}
                
                Extract any new information from the user's message and update our understanding.
                We need ALL of the following information before proceeding to step 2 (risk assessment):
                - age (numeric)
                - gender (male/female)
                - smoking status (yes/no)
                - health conditions (any major conditions)
                
                If we don't have ALL of this information, ask for the missing details specifically.
                Be conversational but direct in your questions.
                Remind the user that after collecting this information, we will assess their risk profile and calculate premium options.
                
                User message: {last_message.content}
                
                First, analyze what information we can extract from this message. Then respond to the user.
                Format your analysis as JSON that we can use to update our user_info dictionary.
                Even if the User has provided details in Json format, parse the Json and update the user_info dictionary.
                Don't ask for the same information again and again.
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
            # Step 1 (continued): Policy selection - still part of information collection
            print(f"Step 1 (continued): Policy selection - collecting policy preferences")
            
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Extract policy details from the message
            policy_details = state["policy_details"] or {}
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                You are helping the user select a policy type and coverage amount.
                This is still part of step 1 - collecting information, but focusing on policy preferences.
                
                Current user information:
                {state["user_info"]}
                
                Current policy details:
                {policy_details}
                
                Extract any policy preferences from the user's message and update our understanding.
                If we have enough information (policy_type, coverage_amount), we'll proceed to step 2: risk assessment.
                If we don't have enough information, explain the different policy types (Term Life, Whole Life, Universal Life)
                and ask about their coverage needs.
                
                Be conversational but direct in your explanations and questions.
                Remind the user that once we have this information, we will proceed to assess their risk and calculate premiums.
                
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
            # Step 1: Get risk assessment from risk assessment agent
            print(f"Step 1: Getting risk assessment from risk assessment agent")
            risk_assessment_result = self.risk_agent.invoke(state["user_info"])
            print(f"Risk assessment completed with score: {risk_assessment_result.get('risk_score')}")
            
            # Step 2: Get premium calculation from premium calculation agent
            print(f"Step 2: Getting premium calculation from premium calculation agent")
            premium_calculation_result = self.premium_agent.invoke(
                state["user_info"], 
                risk_assessment_result, 
                state["policy_details"]
            )
            print(f"Premium calculation completed with annual premium: ${premium_calculation_result.get('annual_premium')}")
            
            # Step 3: Get policy recommendation from policy recommendation agent
            print(f"Step 3: Getting policy recommendation from policy recommendation agent")
            policy_recommendation = self.policy_agent.invoke_with_results(
                state["user_info"],
                risk_assessment_result,
                premium_calculation_result
            )
            print(f"Policy recommendation completed with recommended policy: {policy_recommendation['recommended_policy']['policy_type']}")
            
            # Combine all results for the recommendation
            recommendation_result = {
                "risk_assessment": risk_assessment_result,
                "premium_calculation": premium_calculation_result,
                "policy_recommendation": policy_recommendation
            }
            
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
            # Step 4: Follow up with the client
            print(f"Step 4: Following up with the client")
            
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Create a message for the LLM
            messages = [
                self.system_message,
                HumanMessage(content=f"""
                The user has received our policy recommendation. We are now in the follow-up phase.
                
                Respond to their follow-up question or comment.
                
                If they want to proceed with the policy, explain the next steps (e.g., application process, medical exam if needed).
                If they have questions about the recommendation, answer them based on the information we have.
                If they want to explore other options, suggest alternatives from our recommendation.
                
                Be conversational, helpful, and concise in your response.
                Remind them that this is the follow-up phase of our conversation where we address their questions and concerns.
                
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
            if is_complete:
                print(f"Step 5: Conversation completed")
                completion_message = "Thank you for using our service. Your conversation is now complete."
            else:
                completion_message = ""
                
            return {
                "messages": state["messages"] + [response],
                "user_info": state["user_info"],
                "policy_details": state["policy_details"],
                "recommendation_result": state["recommendation_result"],
                "conversation_stage": "completed" if is_complete else "followup",
                "step_count": state.get("step_count", 0) + 1
            }
        
        def general_conversation(state: CommunicationState) -> CommunicationState:
            """
            Handle general conversation with the user that isn't related to insurance.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state.
            """
            print(f"General conversation - responding to user query")
            
            # Get the last user message
            last_message = state["messages"][-1]
            
            # Check if this is an educational question about insurance rather than a request for personal coverage
            is_insurance_education = any(pattern in last_message.content.lower() for pattern in [
                "what is life insurance", "what is insurance", "what is a policy", 
                "how does life insurance work", "explain life insurance", "tell me about life insurance",
                "types of insurance", "types of life insurance", "different policies",
                "difference between", "explain the difference", "what's the difference",
                "no, just tell me", "just explain"
            ])
            
            # Create a message for the LLM
            if is_insurance_education:
                messages = [
                    SystemMessage(content="""You are Cora, a knowledgeable AI assistant specializing in insurance topics.
                    Provide educational, informative responses about insurance concepts.
                    Focus on explaining the topic clearly without asking for personal information.
                    Be helpful, concise, and informative. Don't try to collect user details or promote specific policies.
                    """),
                    HumanMessage(content=f"""
                    The user has asked an educational question about insurance: "{last_message.content}"
                    
                    Provide a helpful, educational explanation about the requested insurance topic.
                    Focus on being informative and educational rather than trying to sell a policy.
                    Don't ask for personal information - just explain the concept they're asking about.
                    
                    After explaining, you can mention that if they're interested in personalized recommendations later,
                    you'd be happy to help, but don't pressure them for information.
                    """)
                ]
            else:
                messages = [
                    SystemMessage(content="""You are Cora, a helpful AI assistant who can discuss a wide range of topics.
                    
                    Respond knowledgeably and helpfully to questions about:
                    - Technology and science
                    - Entertainment and culture
                    - News and current events
                    - Personal advice and guidance
                    - Health and wellness (general topics)
                    - Finance and economics (general information)
                    - History, geography, and general knowledge
                    
                    If the user mentions anything related to insurance, health insurance, life policies, coverage, or financial protection, 
                    acknowledge their interest and indicate you can help with life insurance recommendations by collecting some information.
                    
                    Otherwise, be helpful, friendly, and informative about whatever topic they're discussing.
                    Keep your responses concise, engaging, and tailored to their specific query.
                    
                    Don't proactively bring up insurance unless the user expresses interest first.
                    """),
                    HumanMessage(content=f"User message: {last_message.content}")
                ]
            
            # Get response from LLM
            response = self.llm.invoke(messages)
            
            # For educational questions about insurance, don't transition to insurance info collection
            if is_insurance_education:
                next_stage = "general_conversation"
            else:
                # Check if the response mentions insurance (in case the user's message was actually insurance-related)
                is_insurance_related = self._is_insurance_related(last_message.content) and not is_insurance_education
                is_insurance_request = is_insurance_related and any(term in last_message.content.lower() for term in [
                    "need insurance", "want insurance", "get insurance", "buy insurance", 
                    "recommend", "looking for", "need coverage", "want coverage",
                    "need policy", "want policy", "quotes", "rates", "plans for me"
                ])
                
                # Only transition to collecting info if they're asking for personal coverage, not just information
                next_stage = "collecting_info" if is_insurance_request else "general_conversation"
            
            return {
                "messages": state["messages"] + [response],
                "user_info": state.get("user_info", {}),
                "policy_details": state.get("policy_details", {}),
                "recommendation_result": state["recommendation_result"],
                "conversation_stage": next_stage,
                "step_count": state.get("step_count", 0) + 1
            }
            
        def router(state: CommunicationState) -> Union[CommunicationState, str]:
            """
            Route the conversation to the appropriate stage.
            
            Args:
                state: The current state.
                
            Returns:
                The updated state or "END" to end the conversation.
            """
            # End the conversation if we've gone too many steps
            if state.get("step_count", 0) > 20:
                print(f"Hit maximum number of steps, ending conversation")
                return "END"
            
            # Get the last user message if available
            last_message = state["messages"][-1] if state["messages"] else None
            
            # Check if this is an educational question about insurance
            is_insurance_education = last_message and any(pattern in last_message.content.lower() for pattern in [
                "what is life insurance", "what is insurance", "what is a policy", 
                "how does life insurance work", "explain life insurance", "tell me about life insurance",
                "types of insurance", "types of life insurance", "different policies",
                "difference between", "explain the difference", "what's the difference",
                "no, just tell me", "just explain"
            ])
            
            # Check if we need to transition from general conversation to insurance
            if state["conversation_stage"] == "greeting" or state["conversation_stage"] == "general_conversation":
                if last_message:
                    # Is it actually requesting personal insurance rather than just education about insurance?
                    is_insurance_related = self._is_insurance_related(last_message.content) and not is_insurance_education
                    is_insurance_request = is_insurance_related and any(term in last_message.content.lower() for term in [
                        "need insurance", "want insurance", "get insurance", "buy insurance", 
                        "recommend", "looking for", "need coverage", "want coverage",
                        "need policy", "want policy", "quotes", "rates", "plans for me"
                    ])
                    
                    if is_insurance_request:
                        print(f"User requested personal insurance, transitioning to collecting info")
                        state["conversation_stage"] = "collecting_info"
                        return collect_info(state)
                    elif is_insurance_education:
                        print(f"User asked educational question about insurance, staying in general conversation")
                        return general_conversation(state)
                    else:
                        print(f"User did not mention insurance or asked general question, continuing general conversation")
                        return general_conversation(state)
            
            # Check if we can transition to recommendation
            if (state["conversation_stage"] == "policy_selection" and
                state["user_info"] and len(state["user_info"]) >= 4 and
                state["policy_details"] and len(state["policy_details"]) >= 2):
                print(f"User {id(state)} has provided all required information. Starting recommendation")
                return get_recommendation(state)
            
            # New conversations should not skip stages
            if state["conversation_stage"] == "greeting" and len(state["messages"]) <= 2:
                return greeting(state)
                
            # Route based on the current stage
            if state["conversation_stage"] == "greeting":
                return greeting(state)
            elif state["conversation_stage"] == "general_conversation":
                return general_conversation(state)
            elif state["conversation_stage"] == "collecting_info":
                return collect_info(state)
            elif state["conversation_stage"] == "policy_selection":
                return policy_selection(state)
            elif state["conversation_stage"] == "recommendation":
                return followup(state)
            elif state["conversation_stage"] == "followup":
                return followup(state)
            else:
                print(f"Unknown stage: {state['conversation_stage']}")
                return greeting(state)
        
        # Create the graph
        builder = StateGraph(CommunicationState)
        
        # Add nodes
        builder.add_node("greeting", greeting)
        builder.add_node("collecting_info", collect_info)
        builder.add_node("policy_selection", policy_selection)
        builder.add_node("recommendation", get_recommendation)
        builder.add_node("followup", followup)
        builder.add_node("general_conversation", general_conversation)
        
        # Set the entry point
        builder.set_entry_point("greeting")
        
        # Add conditional edges
        builder.add_conditional_edges(
            "greeting",
            router,
            {
                "greeting": "greeting",
                "general_conversation": "general_conversation",
                "collecting_info": "collecting_info",
                "policy_selection": "policy_selection",
                "recommendation": "recommendation",
                "followup": "followup",
                "completed": END
            }
        )
        
        builder.add_conditional_edges(
            "general_conversation",
            router,
            {
                "greeting": "greeting",
                "general_conversation": "general_conversation",
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
                "general_conversation": "general_conversation",
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
                "general_conversation": "general_conversation",
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
                "general_conversation": "general_conversation",
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
                "general_conversation": "general_conversation",
                "collecting_info": "collecting_info",
                "policy_selection": "policy_selection",
                "recommendation": "recommendation",
                "followup": "followup",
                "completed": END
            }
        )
        
        # Compile the graph with optimized settings
        return builder.compile()
    
    def _process_json_input(self, message: str, user_id: str) -> bool:
        """
        Process JSON input from the user and update user_info and policy_details accordingly.
        
        Args:
            message: The user message that might contain JSON.
            user_id: The user ID.
            
        Returns:
            True if JSON was successfully processed, False otherwise.
        """
        try:
            import json
            import re
            
            # Check if the message contains JSON
            json_match = re.search(r'({.*})', message, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(1))
                
                # Map the JSON fields to our internal user_info structure
                user_info = self.conversation_history[user_id]["user_info"]
                
                # Basic user information
                if "name" in data:
                    user_info["name"] = data["name"]
                if "age" in data:
                    try:
                        user_info["age"] = int(data["age"])
                    except (ValueError, TypeError):
                        user_info["age"] = data["age"]
                if "gender" in data:
                    user_info["gender"] = data["gender"]
                if "smoker" in data:
                    user_info["smoking"] = "yes" if data["smoker"] == "Yes" else "no"
                if "email" in data:
                    user_info["email"] = data["email"]
                if "phone" in data:
                    user_info["phone"] = data["phone"]
                
                # Health information
                health_issues = []
                if data.get("preExistingConditions") == "Yes":
                    health_issues.append("Has pre-existing conditions")
                if data.get("familyHistory") == "Yes":
                    health_issues.append("Has family history of serious illnesses")
                
                if health_issues:
                    user_info["health"] = ", ".join(health_issues)
                else:
                    user_info["health"] = "No significant health issues reported"
                
                # Additional user information
                if "occupation" in data:
                    user_info["occupation"] = data["occupation"]
                if "income" in data:
                    user_info["income"] = data["income"]
                if "maritalStatus" in data:
                    user_info["marital_status"] = data["maritalStatus"]
                if "height" in data and "weight" in data:
                    user_info["height"] = data["height"]
                    user_info["weight"] = data["weight"]
                if "alcoholConsumption" in data:
                    user_info["alcohol"] = data["alcoholConsumption"]
                if "exerciseFrequency" in data:
                    user_info["exercise"] = data["exerciseFrequency"]
                if "riskyHobbies" in data:
                    user_info["risky_hobbies"] = data["riskyHobbies"]
                
                # Policy details
                policy_details = self.conversation_history[user_id]["policy_details"]
                
                if "coverageAmount" in data:
                    policy_details["coverage_amount"] = data["coverageAmount"]
                if "policyTerm" in data:
                    policy_details["term_length"] = data["policyTerm"]
                if "paymentFrequency" in data:
                    policy_details["payment_frequency"] = data["paymentFrequency"]
                if "riders" in data:
                    policy_details["riders"] = data["riders"]
                
                # Try to determine policy type (if specific policy type was mentioned)
                if "policyType" in data:
                    policy_details["policy_type"] = data["policyType"]
                else:
                    # Default to Term Life if not specified but we have term length
                    if "policyTerm" in data:
                        policy_details["policy_type"] = "Term Life Insurance"
                        policy_details["term_length"] = data["policyTerm"]
                
                # Ensure we set term_length from policyTerm if available
                if "policyTerm" in data and "term_length" not in policy_details:
                    policy_details["term_length"] = data["policyTerm"]
                
                # Determine if we have enough information to proceed to recommendation
                required_user_fields = ["age", "gender", "smoking", "health"]
                required_policy_fields = ["coverage_amount", "policy_type"]
                
                has_user_info = all(field in user_info for field in required_user_fields)
                has_policy_info = all(field in policy_details for field in required_policy_fields)
                
                if has_user_info and has_policy_info:
                    # If we have all required information, update the conversation stage
                    self.conversation_history[user_id]["conversation_stage"] = "recommendation"
                    return True
                elif has_user_info:
                    # If we have user info but not policy info
                    self.conversation_history[user_id]["conversation_stage"] = "policy_selection"
                    return True
                elif any(field in user_info for field in required_user_fields):
                    # If we have some but not all user info
                    self.conversation_history[user_id]["conversation_stage"] = "collecting_info"
                    return True
            
            return False
        except Exception as e:
            print(f"Error processing JSON input: {str(e)}")
            return False
            
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
                policy_details = self.conversation_history[user_id]["policy_details"]
                
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
                
                # Policy details
                if "coverageAmount" in user_details:
                    policy_details["coverage_amount"] = user_details["coverageAmount"]
                
                if "policyTerm" in user_details:
                    policy_details["term_length"] = user_details["policyTerm"]
                    # Default to Term Life if we have term length
                    policy_details["policy_type"] = "Term Life Insurance"
                
                if "paymentFrequency" in user_details:
                    policy_details["payment_frequency"] = user_details["paymentFrequency"]
                
                if "riders" in user_details:
                    policy_details["riders"] = user_details["riders"]
                
                # Check if we have all required information to start with recommendations
                required_user_fields = ["age", "gender", "smoking", "health"]
                required_policy_fields = ["coverage_amount", "policy_type"]
                
                has_user_info = all(field in user_info for field in required_user_fields)
                has_policy_info = all(field in policy_details for field in required_policy_fields)
                
                if has_user_info and has_policy_info:
                    # If we have all required information, set the conversation stage to recommendation
                    self.conversation_history[user_id]["conversation_stage"] = "recommendation"
                    print(f"Complete user_details provided. Setting stage to recommendation for user {user_id}")
                
                # Log the collected information
                print(f"User info collected from frontend: {user_info}")
                print(f"Policy details collected from frontend: {policy_details}")
        
        # Process JSON input if provided
        json_processed = self._process_json_input(message, user_id)
        
        # Add user message to history
        user_message = HumanMessage(content=message)
        self.conversation_history[user_id]["messages"].append(user_message)
        
        # Debug: Print current conversation stage
        print(f"Before async graph execution - User: {user_id}, Stage: {self.conversation_history[user_id]['conversation_stage']}")
        
        # Check if we have all required information to skip directly to recommendations
        user_info = self.conversation_history[user_id]["user_info"]
        policy_details = self.conversation_history[user_id]["policy_details"]
        
        required_user_fields = ["age", "gender", "smoking", "health"]
        required_policy_fields = ["coverage_amount", "policy_type"]
        
        has_user_info = all(field in user_info for field in required_user_fields)
        has_policy_info = all(field in policy_details for field in required_policy_fields)
        
        # If we are in recommendation stage or have complete info, generate recommendation directly
        if self.conversation_history[user_id]["conversation_stage"] == "recommendation" or (has_user_info and has_policy_info):
            print(f"Complete info available. Generating recommendation for user {user_id}")
            
            try:
                # Directly run the recommendation node
                state = self.conversation_history[user_id]
                # Run in executor to avoid blocking
                loop = asyncio.get_event_loop()
                updated_state = await loop.run_in_executor(
                    self.executor,
                    lambda: self._direct_recommendation(state)
                )
                self.conversation_history[user_id] = updated_state
                
                # Return the last AI message
                for msg in reversed(updated_state["messages"]):
                    if isinstance(msg, AIMessage):
                        return {
                            "response": msg.content,
                            "conversation_stage": "followup"
                        }
            except Exception as e:
                print(f"Error generating direct recommendation: {str(e)}")
                # Continue with normal flow if direct recommendation fails
        
        # Check if this is a general question that needs a quick response
        is_general_question = self._is_general_question(message)
        
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
                result["conversation_stage"] not in ["greeting", "general_conversation", "collecting_info"] and
                not json_processed):  # Skip this check if JSON was successfully processed
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
    
    def _direct_recommendation(self, state: CommunicationState) -> CommunicationState:
        """
        Get policy recommendations directly without running the full graph.
        
        Args:
            state: The current state.
            
        Returns:
            The updated state.
        """
        # Step 1: Get risk assessment from risk assessment agent
        print(f"Step 1: Getting risk assessment from risk assessment agent")
        risk_assessment_result = self.risk_agent.invoke(state["user_info"])
        print(f"Risk assessment completed with score: {risk_assessment_result.get('risk_score')}")
        
        # Step 2: Get premium calculation from premium calculation agent
        print(f"Step 2: Getting premium calculation from premium calculation agent")
        premium_calculation_result = self.premium_agent.invoke(
            state["user_info"], 
            risk_assessment_result, 
            state["policy_details"]
        )
        print(f"Premium calculation completed with annual premium: ${premium_calculation_result.get('annual_premium')}")
        
        # Step 3: Get policy recommendation from policy recommendation agent
        print(f"Step 3: Getting policy recommendation from policy recommendation agent")
        policy_recommendation = self.policy_agent.invoke_with_results(
            state["user_info"],
            risk_assessment_result,
            premium_calculation_result
        )
        print(f"Policy recommendation completed with recommended policy: {policy_recommendation['recommended_policy']['policy_type']}")
        
        # Combine all results for the recommendation
        recommendation_result = {
            "risk_assessment": risk_assessment_result,
            "premium_calculation": premium_calculation_result,
            "policy_recommendation": policy_recommendation
        }
        
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
                policy_details = self.conversation_history[user_id]["policy_details"]
                
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
                
                # Policy details
                if "coverageAmount" in user_details:
                    policy_details["coverage_amount"] = user_details["coverageAmount"]
                
                if "policyTerm" in user_details:
                    policy_details["term_length"] = user_details["policyTerm"]
                    # Default to Term Life if we have term length
                    policy_details["policy_type"] = "Term Life Insurance"
                
                if "paymentFrequency" in user_details:
                    policy_details["payment_frequency"] = user_details["paymentFrequency"]
                
                if "riders" in user_details:
                    policy_details["riders"] = user_details["riders"]
                
                # Check if we have all required information to start with recommendations
                required_user_fields = ["age", "gender", "smoking", "health"]
                required_policy_fields = ["coverage_amount", "policy_type"]
                
                has_user_info = all(field in user_info for field in required_user_fields)
                has_policy_info = all(field in policy_details for field in required_policy_fields)
                
                if has_user_info and has_policy_info:
                    # If we have all required information, set the conversation stage to recommendation
                    self.conversation_history[user_id]["conversation_stage"] = "recommendation"
                    print(f"Complete user_details provided. Setting stage to recommendation for user {user_id}")
                
                # Log the collected information
                print(f"User info collected from frontend: {user_info}")
                print(f"Policy details collected from frontend: {policy_details}")
        
        # Process JSON input if provided
        json_processed = self._process_json_input(message, user_id)
        
        # Add user message to history
        user_message = HumanMessage(content=message)
        self.conversation_history[user_id]["messages"].append(user_message)
        
        # Debug: Print current conversation stage
        print(f"Before graph execution - User: {user_id}, Stage: {self.conversation_history[user_id]['conversation_stage']}")
        
        
        # Check if we have all required information to skip directly to recommendations
        user_info = self.conversation_history[user_id]["user_info"]
        policy_details = self.conversation_history[user_id]["policy_details"]
        
        required_user_fields = ["age", "gender", "smoking", "health"]
        required_policy_fields = ["coverage_amount", "policy_type"]
        
        has_user_info = all(field in user_info for field in required_user_fields)
        has_policy_info = all(field in policy_details for field in required_policy_fields)
        
        # If we are in recommendation stage or have complete info, generate recommendation directly
        if self.conversation_history[user_id]["conversation_stage"] == "recommendation" or (has_user_info and has_policy_info):
            print(f"Complete info available. Generating recommendation for user {user_id}")
            
            try:
                # Directly run the recommendation node
                state = self.conversation_history[user_id]
                updated_state = self._direct_recommendation(state)
                self.conversation_history[user_id] = updated_state
                
                # Return the last AI message
                for msg in reversed(updated_state["messages"]):
                    if isinstance(msg, AIMessage):
                        return {
                            "response": msg.content,
                            "conversation_stage": "followup"
                        }
            except Exception as e:
                print(f"Error generating direct recommendation: {str(e)}")
                # Continue with normal flow if direct recommendation fails
        
        # Check if this is a general question that needs a quick response
        is_general_question = self._is_general_question(message)
        
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
                result["conversation_stage"] not in ["greeting", "general_conversation", "collecting_info"] and
                not json_processed):  # Skip this check if JSON was successfully processed
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
        
        # Patterns for educational questions about insurance (not requesting personalized policy)
        educational_insurance_patterns = [
            "what is life insurance", "what is insurance", "what is a policy", 
            "how does life insurance work", "explain life insurance", "tell me about life insurance",
            "types of insurance", "types of life insurance", "different policies",
            "difference between", "explain the difference", "what's the difference",
            "no, just tell me", "just explain"
        ]
        
        # Check if the message contains any of the general patterns
        for pattern in general_patterns:
            if pattern in message_lower:
                return True
                
        # Check if this is an educational insurance question
        for pattern in educational_insurance_patterns:
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
        
        # Check if this is an educational question about insurance
        is_insurance_education = any(pattern in message.lower() for pattern in [
            "what is life insurance", "what is insurance", "what is a policy", 
            "how does life insurance work", "explain life insurance", "tell me about life insurance",
            "types of insurance", "types of life insurance", "different policies",
            "difference between", "explain the difference", "what's the difference",
            "no, just tell me", "just explain"
        ])
        
        if is_insurance_education:
            # Create a message for the LLM specifically for educational insurance questions
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
        else:
            # Create a message for the LLM for other general questions
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
        
        # Get response from LLM with a shorter timeout
        response = await self.llm_utility.ainvoke(messages, temperature=0.7, max_tokens=400)
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
        
        # Check if this is an educational question about insurance
        is_insurance_education = any(pattern in message.lower() for pattern in [
            "what is life insurance", "what is insurance", "what is a policy", 
            "how does life insurance work", "explain life insurance", "tell me about life insurance",
            "types of insurance", "types of life insurance", "different policies",
            "difference between", "explain the difference", "what's the difference",
            "no, just tell me", "just explain"
        ])
        
        if is_insurance_education:
            # Create a message for the LLM specifically for educational insurance questions
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
        else:
            # Create a message for the LLM for other general questions
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
        
        # Get response from LLM with a shorter timeout
        response = self.llm_utility.invoke(messages, temperature=0.7, max_tokens=400)
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

    def _is_insurance_related(self, message: str) -> bool:
        """
        Determine if a message is related to insurance topics.
        
        Args:
            message: The user message.
            
        Returns:
            True if the message is related to insurance, False otherwise.
        """
        # Convert to lowercase for case-insensitive matching
        message_lower = message.lower()
        
        # List of insurance-related terms
        insurance_terms = [
            "insurance", "policy", "coverage", "premium", "term life", "whole life", 
            "life insurance", "health insurance", "medical insurance", "risk assessment", 
            "insure", "benefits", "claim", "protection", "financial security", 
            "death benefit", "beneficiary", "underwriting", "quote", "riders"
        ]
        
        # Check if any insurance-related term is in the message
        for term in insurance_terms:
            if term in message_lower:
                return True
                
        return False


