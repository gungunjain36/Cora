import httpx
import json
import asyncio

async def test_payment_api():
    """Test the premium payment API endpoint."""
    url = "http://localhost:8000/blockchain/process-payment"
    
    # Test payload
    payload = {
        "wallet_address": "0x123abc456def789ghi",
        "policy_id": 12345,
        "amount": 100
    }
    
    # Make API request
    async with httpx.AsyncClient() as client:
        print(f"Sending request to {url} with payload: {payload}")
        try:
            response = await client.post(url, json=payload)
            print(f"Status code: {response.status_code}")
            print(f"Response: {response.text}")
            
            # Parse and print response details
            if response.status_code == 200:
                result = response.json()
                print("\nPayment processed successfully:")
                print(f"Transaction hash: {result.get('transaction_hash', 'N/A')}")
                print(f"Message: {result.get('message', 'N/A')}")
            else:
                print(f"\nError processing payment: {response.text}")
        except Exception as e:
            print(f"Exception occurred: {str(e)}")

# Run the test
if __name__ == "__main__":
    asyncio.run(test_payment_api()) 