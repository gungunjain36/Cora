#!/usr/bin/env python3
"""
Test script for Cora Insurance Blockchain Integration

This script provides a simple way to test the blockchain integration
without relying on LangChain or other potentially incompatible dependencies.

Instructions:
1. First, install the Aptos SDK:
   pip install aptos-sdk

2. Ensure environment variables are set in .env:
   VITE_APP_NETWORK=testnet
   VITE_APTOS_API_KEY=AG-8ZAD7GRKXNPNANT2ROBKYYAQ2A2OAYGU9
   VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS=0xd290fb8c741c327618b21904475cfda58f566471e43f44495f4525295553c1ae
   VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY=0x03575c3b20fa782bfec2c6d715d2e8feec7b6e881ca81b0e18d7142c8baebf4f
   VITE_MODULE_ADDRESS=0xd290fb8c741c327618b21904475cfda58f566471e43f44495f4525295553c1ae

3. Run this script:
   python run_test_server.py

4. In a separate terminal, run the test script:
   python test_payment.py

"""
import os
import subprocess
import sys

def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import aptos_sdk
        print("✅ Aptos SDK is installed.")
    except ImportError:
        print("❌ Aptos SDK is not installed. Installing now...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "aptos-sdk"])
        print("✅ Aptos SDK has been installed.")
    
    try:
        import fastapi
        print("✅ FastAPI is installed.")
    except ImportError:
        print("❌ FastAPI is not installed. Installing now...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "fastapi", "uvicorn[standard]"])
        print("✅ FastAPI has been installed.")
    
    try:
        import httpx
        print("✅ HTTPX is installed.")
    except ImportError:
        print("❌ HTTPX is not installed. Installing now...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx"])
        print("✅ HTTPX has been installed.")

def check_environment_vars():
    """Check if required environment variables are available."""
    from dotenv import load_dotenv
    load_dotenv()
    
    required_vars = [
        "VITE_APP_NETWORK",
        "VITE_APTOS_API_KEY",
        "VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS",
        "VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY",
        "VITE_MODULE_ADDRESS"
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("Please set these variables in your .env file.")
        return False
    
    print("✅ All required environment variables are set.")
    return True

def run_server():
    """Run the simplified FastAPI server."""
    print("\n🚀 Starting the test server...")
    os.environ["PYTHONUNBUFFERED"] = "1"  # Ensure unbuffered output
    subprocess.run([sys.executable, "simple_server.py"])

if __name__ == "__main__":
    print("🔍 Checking dependencies...")
    check_dependencies()
    
    print("\n🔍 Checking environment variables...")
    if check_environment_vars():
        run_server()
    else:
        print("\n❌ Cannot start server due to missing environment variables.")
        sys.exit(1) 