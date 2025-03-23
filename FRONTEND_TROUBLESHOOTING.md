# Frontend Troubleshooting Guide

## Issues with Content Not Displaying

If your frontend isn't displaying any content, here are some steps to troubleshoot:

### 1. Check Environment Configuration

Make sure your `.env.local` file in the `aptos/frontend` directory has the correct configuration:

```
# API URLs
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Aptos Network Configuration
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
NEXT_PUBLIC_APTOS_FAUCET_URL=https://faucet.devnet.aptoslabs.com

# Contract Module Addresses
NEXT_PUBLIC_POLICY_MODULE_ADDRESS=0x1
NEXT_PUBLIC_PAYMENT_MODULE_ADDRESS=0x1
NEXT_PUBLIC_CLAIMS_MODULE_ADDRESS=0x1
```

### 2. Start the Backend Server

Ensure the backend server is running:

```bash
cd backend
python main.py
```

The server should be running on http://localhost:8000

### 3. Start the Frontend Development Server

Run the frontend development server:

```bash
cd aptos/frontend
npm run dev
```

The frontend should be accessible at http://localhost:3000

### 4. Check Browser Console for Errors

Open your browser's developer tools (F12) and check the console for any errors.

Common issues include:
- CORS errors: Make sure your backend server has proper CORS settings
- API connection errors: Ensure your API endpoints are correctly formatted
- Authentication errors: Check if user authentication is working properly

### 5. Wallet Connection Issues

If you're having issues with wallet connection:
- Ensure you have a wallet extension installed (like Petra or Martian)
- Check that you're connected to the right network (Devnet/Testnet/Mainnet)
- Verify the wallet adapter code in the frontend is correctly configured

### 6. Component Rendering Issues

If specific components aren't rendering:
- Check that the component is receiving the expected props
- Verify that state management is working correctly
- Look for conditional rendering that might be preventing components from displaying

### 7. Data Fetching Issues

If your components aren't displaying data:
- Check the network tab in developer tools to see if API requests are successful
- Verify that the response format matches what your components expect
- Ensure proper error handling is implemented for failed requests

### 8. Backend Connection

Make sure the blockchain service can connect to your backend:
- Verify your API_BASE_URL is correctly set
- Check that the backend routes exist and are functioning properly
- Test individual API endpoints directly to isolate frontend vs. backend issues

### 9. Blockchain Connection

For blockchain integration issues:
- Ensure your node URL is correctly configured
- Check that contract addresses are valid
- Verify your wallet has sufficient funds for transactions

### 10. Clean and Rebuild

If all else fails, try cleaning your build and node modules:

```bash
cd aptos/frontend
rm -rf node_modules/.cache
rm -rf .next
npm install
npm run dev
```

## Additional Resources

- Check the README files in each directory for specific setup instructions
- Refer to the blockchain service documentation for API endpoint details
- Review the component documentation for usage examples 