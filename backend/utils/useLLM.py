# This will a central hook that all our agents will use to interact with LLMs.
# This will be the central point of interaction with the LLMs.

import os
import asyncio
from typing import Optional, List, Dict, Any, Callable, TypeVar, Generic, Union
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain.cache import InMemoryCache
from langchain.globals import set_llm_cache
from dotenv import load_dotenv
import functools
import time

# Set up caching for LLM calls
set_llm_cache(InMemoryCache())

load_dotenv()

# Type variable for generic caching
T = TypeVar('T')

class LRUCache(Generic[T]):
    """Simple LRU cache implementation for caching LLM responses"""
    
    def __init__(self, max_size: int = 100):
        self.cache: Dict[str, T] = {}
        self.max_size = max_size
        self.access_times: Dict[str, float] = {}
    
    def get(self, key: str) -> Optional[T]:
        """Get an item from the cache"""
        if key in self.cache:
            self.access_times[key] = time.time()
            return self.cache[key]
        return None
    
    def put(self, key: str, value: T) -> None:
        """Put an item in the cache"""
        if len(self.cache) >= self.max_size and key not in self.cache:
            # Remove least recently used item
            oldest_key = min(self.access_times.items(), key=lambda x: x[1])[0]
            del self.cache[oldest_key]
            del self.access_times[oldest_key]
        
        self.cache[key] = value
        self.access_times[key] = time.time()

class UseLLM:
    """
    A utility class for interacting with language models.
    This class provides a centralized way for all agents to interact with LLMs.
    """
    
    def __init__(self, model_name: str = "gpt-4o", temperature: float = 0.7, api_key: Optional[str] = None):
        """
        Initialize the UseLLM utility.
        
        Args:
            model_name: The name of the language model to use.
            temperature: The temperature parameter for the language model.
            api_key: The API key for the language model provider.
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("API key is required. Please provide it or set the OPENAI_API_KEY environment variable.")
        
        self.model_name = model_name
        self.temperature = temperature
        
        # Initialize ChatOpenAI with optimized settings
        self.llm = ChatOpenAI(
            model=self.model_name,
            temperature=self.temperature,
            api_key=self.api_key,
            request_timeout=60,  # Increase timeout for reliability
            max_retries=3,       # Add retries for reliability
            streaming=False,     # Disable streaming for faster responses
            cache=True,          # Enable caching
        )
        
        # Initialize response cache
        self.response_cache = LRUCache[AIMessage](max_size=100)
        
        # Create a semaphore to limit concurrent API calls
        self.semaphore = asyncio.Semaphore(5)
    
    def get_llm(self):
        """
        Get the language model instance.
        
        Returns:
            The language model instance.
        """
        return self.llm
    
    def get_llm_with_tools(self, tools: List[Any]):
        """
        Get the language model instance with tools bound to it.
        
        Args:
            tools: A list of tools to bind to the language model.
            
        Returns:
            The language model instance with tools bound to it.
        """
        return self.llm.bind_tools(tools)
    
    def _generate_cache_key(self, messages: List[BaseMessage], **kwargs) -> str:
        """Generate a cache key from messages and kwargs"""
        # Simple cache key generation - concatenate all message contents
        message_str = "||".join([f"{msg.__class__.__name__}:{msg.content}" for msg in messages])
        kwargs_str = "||".join([f"{k}:{v}" for k, v in sorted(kwargs.items())])
        return f"{message_str}|{kwargs_str}"
    
    def invoke(self, messages: List[BaseMessage], temperature: Optional[float] = None, max_tokens: Optional[int] = None, **kwargs):
        """
        Invoke the language model with the given messages.
        
        Args:
            messages: A list of messages to send to the language model.
            temperature: Optional temperature override for this specific call.
            max_tokens: Optional max tokens override for this specific call.
            **kwargs: Additional arguments to pass to the language model.
            
        Returns:
            The response from the language model.
        """
        # Apply overrides for this specific call
        call_kwargs = kwargs.copy()
        if temperature is not None:
            call_kwargs["temperature"] = temperature
        if max_tokens is not None:
            call_kwargs["max_tokens"] = max_tokens
        
        # Check cache first
        cache_key = self._generate_cache_key(messages, **call_kwargs)
        cached_response = self.response_cache.get(cache_key)
        if cached_response:
            return cached_response
        
        # If not in cache, invoke the model
        response = self.llm.invoke(messages, **call_kwargs)
        
        # Cache the response
        self.response_cache.put(cache_key, response)
        
        return response
    
    async def ainvoke(self, messages: List[BaseMessage], temperature: Optional[float] = None, max_tokens: Optional[int] = None, **kwargs):
        """
        Asynchronously invoke the language model with the given messages.
        
        Args:
            messages: A list of messages to send to the language model.
            temperature: Optional temperature override for this specific call.
            max_tokens: Optional max tokens override for this specific call.
            **kwargs: Additional arguments to pass to the language model.
            
        Returns:
            The response from the language model.
        """
        # Apply overrides for this specific call
        call_kwargs = kwargs.copy()
        if temperature is not None:
            call_kwargs["temperature"] = temperature
        if max_tokens is not None:
            call_kwargs["max_tokens"] = max_tokens
            
        # Check cache first
        cache_key = self._generate_cache_key(messages, **call_kwargs)
        cached_response = self.response_cache.get(cache_key)
        if cached_response:
            return cached_response
        
        # Acquire semaphore to limit concurrent API calls
        async with self.semaphore:
            # If not in cache, invoke the model asynchronously
            response = await self.llm.ainvoke(messages, **call_kwargs)
            
            # Cache the response
            self.response_cache.put(cache_key, response)
            
            return response
    
    def create_system_message(self, content: str) -> SystemMessage:
        """
        Create a system message.
        
        Args:
            content: The content of the system message.
            
        Returns:
            A SystemMessage instance.
        """
        return SystemMessage(content=content)
    
    def create_human_message(self, content: str) -> HumanMessage:
        """
        Create a human message.
        
        Args:
            content: The content of the human message.
            
        Returns:
            A HumanMessage instance.
        """
        return HumanMessage(content=content)
    
    def create_ai_message(self, content: str) -> AIMessage:
        """
        Create an AI message.
        
        Args:
            content: The content of the AI message.
            
        Returns:
            An AIMessage instance.
        """
        return AIMessage(content=content)
