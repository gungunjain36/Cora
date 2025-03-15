# Frontend Integration Guide for Communication Agent

This guide explains how to integrate the frontend onboarding form with the communication agent API.

## API Endpoint

The communication agent is accessible through the following endpoint:

```
POST /api/agents/chat
```

## Request Format

The API accepts the following JSON payload:

```json
{
  "message": "User's message text",
  "user_id": "unique_user_id",
  "user_details": {
    "name": "John Doe",
    "age": 35,
    "gender": "Male",
    "email": "john@example.com",
    "phone": "1234567890",
    "income": "₹15,00,000 - ₹25,00,000",
    "occupation": "Salaried",
    "smoker": "No",
    "preExistingConditions": "No",
    "familyHistory": "No"
  }
}
```

### Fields Explanation:

- `message`: The user's message text (required)
- `user_id`: A unique identifier for the user (required)
- `user_details`: An object containing the user's details from the onboarding form (optional)

The `user_details` object can include any of the following fields:

| Field | Description | Expected Values |
|-------|-------------|----------------|
| `name` | User's full name | String |
| `age` | User's age | Number |
| `gender` | User's gender | "Male", "Female", "Other", "Prefer not to say" |
| `email` | User's email address | String |
| `phone` | User's phone number | String |
| `income` | User's annual income range | One of the income ranges from the form |
| `occupation` | User's occupation | One of the occupation options from the form |
| `smoker` | Whether the user smokes | "Yes", "No" |
| `preExistingConditions` | Whether the user has pre-existing medical conditions | "Yes", "No" |
| `familyHistory` | Whether the user has a family history of serious illnesses | "Yes", "No" |

## Response Format

The API returns the following JSON response:

```json
{
  "response": "AI assistant's response text",
  "conversation_stage": "collecting_info"
}
```

### Fields Explanation:

- `response`: The AI assistant's response text
- `conversation_stage`: The current stage of the conversation (e.g., "greeting", "collecting_info", "policy_selection", "recommendation", "followup", "completed")

## Integration Steps

1. **Collect User Details**: After the user completes the onboarding form, store the form data in your frontend state.

2. **Initialize Chat**: When the user starts a chat, send their first message along with their user details to the API.

3. **Subsequent Messages**: For subsequent messages, you only need to send the message and user_id (the backend will remember the user details).

## Example Usage

```javascript
// After onboarding form submission
const userDetails = {
  name: formData.name,
  age: formData.age,
  gender: formData.gender,
  email: formData.email,
  phone: formData.phone,
  income: formData.income,
  occupation: formData.occupation,
  smoker: formData.smoker,
  preExistingConditions: formData.preExistingConditions,
  familyHistory: formData.familyHistory
};

// Store user details in your app state
storeUserDetails(userDetails);

// When user sends their first message
async function sendFirstMessage(message, userId) {
  const response = await fetch('/api/agents/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      user_id: userId,
      user_details: userDetails
    }),
  });
  
  return await response.json();
}

// For subsequent messages
async function sendMessage(message, userId) {
  const response = await fetch('/api/agents/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      user_id: userId
    }),
  });
  
  return await response.json();
}
```

## Important Notes

1. The communication agent will use the provided user details to personalize responses and skip unnecessary questions.

2. If any required information is missing, the agent will still ask for it during the conversation.

3. For general questions like "Hi" or "What can you do for me?", the agent will provide quick, helpful responses without running the full conversation flow.

4. The agent will never skip directly to recommendations without first ensuring it has all the necessary information.

5. The conversation history is stored on the backend, so you can retrieve it using the `/api/agents/history/{user_id}` endpoint if needed.

## Troubleshooting

If you encounter any issues with the integration, please check the following:

1. Ensure that the `user_id` is consistent across all requests for the same user.

2. Verify that the user details are properly formatted according to the expected values.

3. Check the network tab in your browser's developer tools to see the exact request and response.

4. If you're still having issues, contact the backend team with the specific error message and request payload. 