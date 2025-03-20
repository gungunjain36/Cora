## Create Aptos Dapp Boilerplate Template

The Boilerplate template provides a starter dapp with all necessary dapp infrastructure and a simple wallet info implementation, transfer APT and a simple message board functionality to send and read a message on chain.

## Read the Boilerplate template docs

To get started with the Boilerplate template and learn more about the template functionality and usage, head over to the [Boilerplate template docs](https://learn.aptoslabs.com/en/dapp-templates/boilerplate-template)

## The Boilerplate template provides:

- **Folder structure** - A pre-made dapp folder structure with a `frontend` and `contract` folders.
- **Dapp infrastructure** - All required dependencies a dapp needs to start building on the Aptos network.
- **Wallet Info implementation** - Pre-made `WalletInfo` components to demonstrate how one can use to read a connected Wallet info.
- **Transfer APT implementation** - Pre-made `transfer` components to send APT to an address.
- **Message board functionality implementation** - Pre-made `message` components to send and read a message on chain

## What tools the template uses?

- React framework
- Vite development tool
- shadcn/ui + tailwind for styling
- Aptos TS SDK
- Aptos Wallet Adapter
- Node based Move commands
- [Vite-pwa](https://vite-pwa-org.netlify.app/)

## What Move commands are available?

The tool utilizes [aptos-cli npm package](https://github.com/aptos-labs/aptos-cli) that lets us run Aptos CLI in a Node environment.

Some commands are built-in the template and can be ran as a npm script, for example:

- `npm run move:publish` - a command to publish the Move contract
- `npm run move:test` - a command to run Move unit tests
- `npm run move:compile` - a command to compile the Move contract
- `npm run move:upgrade` - a command to upgrade the Move contract
- `npm run dev` - a command to run the frontend locally
- `npm run deploy` - a command to deploy the dapp to Vercel

For all other available CLI commands, can run `npx aptos` and see a list of all available commands.

# Cora Insurance Platform - Move Contracts

This directory contains the Move smart contracts for the Cora Insurance Platform, along with scripts to deploy and interact with them.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [pnpm](https://pnpm.io/) (v7 or higher)
- [Aptos CLI](https://aptos.dev/tools/aptos-cli/install-cli/) (optional, will use npx fallback if not installed)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file in the `aptos` directory with the following variables:

```
VITE_APP_NETWORK=testnet
VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS=your_account_address
VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY=your_private_key
VITE_MODULE_ADDRESS=your_account_address
```

## Available Scripts

### Account Management

- **Create a new account**:
  ```bash
  pnpm run move:create-account
  ```
  This will generate a new account and update the `.env` file with the address and private key.

- **Fund your account**:
  ```bash
  pnpm run move:explorer-fund
  ```
  This will open the Aptos Explorer in your browser where you can fund your account with testnet tokens.

- **Check account balance**:
  ```bash
  pnpm run move:check-balance
  ```
  This will check if your account has been funded and is ready to publish contracts.

### Contract Deployment

- **Publish the Move contracts**:
  ```bash
  pnpm run move:publish
  ```
  This will compile and publish the Move contracts to the Aptos blockchain.

- **Upgrade the Move contracts**:
  ```bash
  pnpm run move:upgrade
  ```
  This will upgrade the existing Move contracts on the Aptos blockchain.

## Contract Structure

The Move contracts are located in the `contract` directory and include:

- `PolicyRegistry.move`: Manages insurance policies
- `PremiumEscrow.move`: Handles premium payments and escrow
- `ClaimProcessor.move`: Processes insurance claims
- `cora_insurance.move`: Main module for initializing the platform

## ABIs for Frontend Integration

The ABIs for the Move contracts are automatically generated during the publishing process and saved to the `frontend/utils` directory. These ABIs can be imported in your frontend code to interact with the contracts:

```typescript
import { 
  POLICY_REGISTRY_ABI, 
  PREMIUM_ESCROW_ABI, 
  CLAIM_PROCESSOR_ABI, 
  CORA_INSURANCE_ABI 
} from '../utils/abi';
```

To manually regenerate the ABIs, you can run:

```bash
pnpm run move:get-abi
```

## Troubleshooting

If you encounter issues with the Aptos faucet, try the following:

1. Visit the Aptos Explorer directly: https://explorer.aptoslabs.com/
2. Navigate to your account page
3. Click on "Request Testnet Funds"

Alternatively, you can use the Aptos Dev Portal faucet: https://aptos.dev/network/faucet

## Development Workflow

1. Create an account: `pnpm run move:create-account`
2. Fund your account: `pnpm run move:explorer-fund`
3. Verify funding: `pnpm run move:check-balance`
4. Publish contracts: `pnpm run move:publish`
5. Make changes to contracts as needed
6. Upgrade contracts: `pnpm run move:upgrade`

## License

[MIT](LICENSE)
