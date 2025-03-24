import asyncio
from agents.aptos_agent import AptosAgent

async def test():
    agent = AptosAgent()
    client = await agent.get_rest_client()
    print("REST client initialized successfully")
    await agent.client.aclose()
    print("Test completed successfully")

if __name__ == "__main__":
    asyncio.run(test()) 