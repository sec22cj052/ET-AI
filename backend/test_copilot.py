import httpx
import asyncio

async def test_copilot():
    print("Testing /query/copilot...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", "http://127.0.0.1:8001/query/copilot", json={"question": "What maintenance was done on Pump-101 before it failed?"}) as response:
                print(f"Status: {response.status_code}")
                async for line in response.aiter_lines():
                    if line:
                        print(line)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_copilot())
