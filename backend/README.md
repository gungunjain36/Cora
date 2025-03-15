# Cora Insurance Multi-Agent System

This is a multi-agent system for Cora Insurance that uses LangGraph and LangChain to provide insurance policy recommendations based on user information.

## Architecture

The system consists of the following agents:

1. **Communication Agent**: The top-level agent that handles communication with the client and coordinates with other agents.
2. **Risk Assessment Agent**: Assesses the risk of a user based on their information.
3. **Premium Calculation Agent**: Calculates the premium for a given policy based on user information and risk assessment.
4. **Policy Recommendation Agent**: Recommends policies based on risk assessment and premium calculation.

## Setup

### Prerequisites

- Python 3.8+
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cora-insurance.git
cd cora-insurance
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r backend/requirements.txt
```

4. Create a `.env` file in the `backend` directory:
```bash
cp backend/.env.example backend/.env
```

5. Edit the `.env` file and add your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

### Running the API

To start the API server:

```bash
cd backend
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.

### API Endpoints

- `POST /agents/chat`: Chat with the communication agent
  - Request body: `{"message": "Hello", "user_id": "user123"}`
  - Response: `{"response": "Agent response", "conversation_stage": "greeting"}`

- `GET /agents/history/{user_id}`: Get conversation history for a user
  - Response: `{"history": [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there!"}]}`

### Testing the Agents

You can test the agents directly using the provided test script:

```bash
cd backend
python test_agents.py
```

This script demonstrates a sample conversation with the insurance agent.

## How It Works

1. The Communication Agent receives messages from the client and manages the conversation flow.
2. Based on the user's information, it delegates tasks to the Risk Assessment Agent and Premium Calculation Agent.
3. The Policy Recommendation Agent uses the results from these agents to recommend appropriate policies.
4. The Communication Agent formats the recommendations and presents them to the user.

## LangGraph Implementation

The system uses LangGraph to create a graph-based workflow for each agent. Each agent has its own state machine that manages its internal state and transitions.

- The Communication Agent uses a state machine with stages like greeting, collecting information, policy selection, recommendation, and followup.
- The Risk Assessment Agent, Premium Calculation Agent, and Policy Recommendation Agent each have simpler workflows focused on their specific tasks.

## Extending the System

To add new functionality:

1. Create a new agent class in the `backend/agents` directory.
2. Implement the agent's state machine using LangGraph.
3. Integrate the new agent with the Communication Agent or other relevant agents.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 