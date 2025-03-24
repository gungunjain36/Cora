import asyncio
import httpx

async def test_blockchain_endpoints():
    """Test the blockchain API endpoints"""
    base_url = "http://localhost:8000"
    
    async with httpx.AsyncClient() as client:
        # Test health endpoint
        resp = await client.get(f"{base_url}/health")
        print(f"Health check: {resp.status_code}")
        print(f"Response: {resp.json()}")
        
        # Test getting policies
        wallet_address = "0xd290fb8c741c327618b21904475cfda58f566471e43f44495f4525295553c1ae"
        resp = await client.get(f"{base_url}/api/blockchain/policies/{wallet_address}")
        print(f"\nGet policies: {resp.status_code}")
        if resp.status_code == 200:
            policies = resp.json()
            print(f"Found {len(policies)} policies")
            if policies:
                print(f"First policy: {policies[0]}")
        else:
            print(f"Error: {resp.text}")
        
        # Test creating a policy
        policy_data = {
            "policy_type": "Term Life",
            "coverage_amount": 500000,
            "term_length": 10,
            "premium_amount": 1200
        }
        resp = await client.post(
            f"{base_url}/api/blockchain/policy/create/{wallet_address}",
            json=policy_data
        )
        print(f"\nCreate policy: {resp.status_code}")
        print(f"Response: {resp.json()}")
        
        # Get updated policies
        resp = await client.get(f"{base_url}/api/blockchain/policies/{wallet_address}")
        print(f"\nGet updated policies: {resp.status_code}")
        if resp.status_code == 200:
            policies = resp.json()
            print(f"Found {len(policies)} policies")
            if policies:
                print(f"First policy: {policies[0]}")
        else:
            print(f"Error: {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_blockchain_endpoints()) 