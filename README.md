# Cora Insurance System

Cora is a comprehensive insurance platform that combines AI-powered insurance agents with blockchain-based policy management. This system offers users personalized insurance recommendations, automated policy creation, and secure claims processing through a modern, user-friendly interface.

## System Architecture

The Cora Insurance System consists of several key components:

1. **Backend AI System** 
   - Policy recommendation agent
   - Risk assessment agent
   - Premium calculation agent
   - Communication agent
   - Aptos blockchain agent

2. **Blockchain Infrastructure**
   - Smart contracts for policy registry
   - Smart contracts for claims management
   - Wallet integration 

3. **Frontend Interface**
   - User dashboard
   - Policy management
   - Claims processing
   - AI chat interface

## Backend-Blockchain Integration

The integration between the backend AI system and the Aptos blockchain is handled through the following components:

### `AptosAgent` (`backend/agents/aptos_agent.py`)

This agent serves as the bridge between the backend system and the blockchain. It provides methods for:

- User registration
- Policy creation
- Premium payment processing
- Claim submission and tracking

### Blockchain API Routes (`backend/routes/blockchain_routes.py`)

These FastAPI routes expose blockchain operations through a RESTful API, allowing the frontend to interact with the blockchain through simple HTTP requests.

### Blockchain Manager (`aptos/scripts/main.ts`)

A TypeScript utility for managing blockchain operations, including:

- Account management
- Transaction payload creation
- Resource retrieval from the blockchain

### CLI Tool (`aptos/scripts/cli.ts`)

A command-line interface for direct interaction with the blockchain components, useful for testing and development.

## Setup and Usage

### Prerequisites

- Python 3.8+
- Node.js 14+
- Aptos CLI
- FastAPI
- React

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/cora-insurance.git
cd cora-insurance
```

2. **Install backend dependencies**

```bash
cd backend
pip install -r requirements.txt
```

3. **Install frontend and blockchain dependencies**

```bash
cd ../aptos
npm install
```

### Configuration

Create a `.env` file in the root directory with the following variables:

```
# Aptos Network Settings
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
APTOS_FAUCET_URL=https://faucet.devnet.aptoslabs.com
NETWORK=devnet
CONTRACT_ADDRESS=your_contract_address
ADMIN_PRIVATE_KEY=your_private_key

# Backend Settings
API_KEY=your_backend_api_key
OPENAI_API_KEY=your_openai_api_key
```

### Running the Backend

```bash
cd backend
uvicorn main:app --reload
```

### Running the Frontend

```bash
cd aptos/frontend
npm run dev
```

## Blockchain CLI Usage

The CLI tool provides a convenient way to interact with the blockchain:

```bash
# Check balance of an address
node aptos/scripts/cli.ts balance <address>

# Fund an account with test tokens (devnet only)
node aptos/scripts/cli.ts fund <address> --amount 100000000

# Register a new user
node aptos/scripts/cli.ts register-user --name "John Doe" --email "john@example.com" --wallet <wallet_address>

# Create a policy
node aptos/scripts/cli.ts create-policy --user-id <user_id> --policy-type "Term Life" --coverage 5000000 --premium 12500

# Get policies for a user
node aptos/scripts/cli.ts get-policies <wallet_address>

# Submit a claim
node aptos/scripts/cli.ts submit-claim --policy-id <policy_id> --amount 2500 --reason "Medical expenses"
```

## API Endpoints

The backend system exposes the following blockchain-related endpoints:

- `POST /wallet-mapping`: Map a user ID to a wallet address
- `GET /verify-wallet/{user_id}/{wallet_address}`: Verify wallet mapping
- `POST /register-user`: Register a new user
- `POST /create-policy`: Create a new insurance policy
- `GET /user-policies/{wallet_address}`: Get policies for a user
- `GET /policy-details/{policy_id}`: Get details of a specific policy
- `POST /process-payment`: Process a premium payment
- `POST /submit-claim`: Submit an insurance claim
- `GET /claim-status/{claim_id}`: Get the status of a claim

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Frontend UI    │◄────►  Backend API    │◄────►  Aptos          │
│  (React)        │     │  (FastAPI)      │     │  Blockchain     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              ▲
                              │
                              ▼
                       ┌─────────────────┐
                       │                 │
                       │  AI Agents      │
                       │                 │
                       └─────────────────┘
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
