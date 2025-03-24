# Cora

Cora is a comprehensive insurance platform that combines AI-powered insurance agents with blockchain-based policy management. This system offers users personalized insurance recommendations, automated policy creation, and secure claims processing through a modern, user-friendly interface.

![image](https://github.com/user-attachments/assets/650b3758-b397-4bc0-8c41-e3f8beeb1388)

![image](https://github.com/user-attachments/assets/37488229-25c6-428f-ba9e-c8a75c00ee48)


## System Architecture

<img width="1024" alt="Screenshot 2025-03-24 at 17 37 32" src="https://github.com/user-attachments/assets/bf47047c-3542-4cda-8ee5-17db92ef3348" />


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
cd aptos
npm run dev
```



