#!/usr/bin/env node

import { Command } from 'commander';
import { HexString } from 'aptos';
import { BlockchainManager } from './main';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Create blockchain manager instance
const blockchainManager = new BlockchainManager();

// Create program
const program = new Command();

program
  .name('cora-cli')
  .description('CLI for interacting with Cora Insurance blockchain components')
  .version('1.0.0');

// Fund command
program
  .command('fund')
  .description('Fund an account with test tokens (devnet/testnet only)')
  .argument('<address>', 'Account address to fund')
  .option('-a, --amount <amount>', 'Amount to fund (default: 100000000)', '100000000')
  .action(async (address, options) => {
    try {
      console.log(`Funding account ${address} with ${options.amount} test tokens...`);
      await blockchainManager.fundAccount(address, parseInt(options.amount));
      console.log('Account funded successfully!');
    } catch (error) {
      console.error('Error funding account:', error);
    }
  });

// Check balance command
program
  .command('balance')
  .description('Check the balance of an account')
  .argument('<address>', 'Account address to check')
  .action(async (address) => {
    try {
      const balance = await blockchainManager.getBalance(address);
      console.log(`Balance for ${address}: ${balance.toString()} APT`);
    } catch (error) {
      console.error('Error checking balance:', error);
    }
  });

// Register user command
program
  .command('register-user')
  .description('Register a new user in the policy registry')
  .requiredOption('--name <name>', 'Full name of the user')
  .requiredOption('--email <email>', 'Email of the user')
  .requiredOption('--wallet <wallet>', 'Wallet address of the user')
  .option('--private-key <privateKey>', 'Private key for transaction signing')
  .action(async (options) => {
    try {
      const userId = uuidv4();
      console.log(`Registering user ${options.name} with ID ${userId}...`);
      
      // In a real implementation, we would submit this transaction to the blockchain
      // For now, we'll just log the payload
      const payload = blockchainManager.createRegisterUserPayload(
        userId, 
        options.name, 
        options.email, 
        options.wallet
      );
      
      console.log('Transaction payload created:');
      console.log(JSON.stringify(payload, null, 2));
      
      // Save user data to a local file for testing
      const userData = {
        userId,
        name: options.name,
        email: options.email,
        walletAddress: options.wallet,
        registeredAt: new Date().toISOString()
      };
      
      const userDataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(userDataDir, `user-${userId}.json`),
        JSON.stringify(userData, null, 2)
      );
      
      console.log(`User data saved to ./data/user-${userId}.json`);
    } catch (error) {
      console.error('Error registering user:', error);
    }
  });

// Create policy command
program
  .command('create-policy')
  .description('Create a new insurance policy')
  .requiredOption('--user-id <userId>', 'ID of the user')
  .requiredOption('--policy-type <policyType>', 'Type of insurance policy')
  .requiredOption('--coverage <coverage>', 'Coverage amount')
  .requiredOption('--premium <premium>', 'Premium amount')
  .option('--start-date <startDate>', 'Start date (ISO format)', new Date().toISOString())
  .option('--end-date <endDate>', 'End date (ISO format)', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString())
  .option('--private-key <privateKey>', 'Private key for transaction signing')
  .action(async (options) => {
    try {
      const policyId = `POL-${uuidv4()}`;
      console.log(`Creating policy ${policyId} for user ${options.userId}...`);
      
      // In a real implementation, we would submit this transaction to the blockchain
      // For now, we'll just log the payload
      const payload = blockchainManager.createPolicyPayload(
        policyId,
        options.userId,
        options.policyType,
        parseInt(options.coverage),
        parseInt(options.premium),
        options.startDate,
        options.endDate
      );
      
      console.log('Transaction payload created:');
      console.log(JSON.stringify(payload, null, 2));
      
      // Save policy data to a local file for testing
      const policyData = {
        policyId,
        userId: options.userId,
        policyType: options.policyType,
        coverageAmount: parseInt(options.coverage),
        premiumAmount: parseInt(options.premium),
        startDate: options.startDate,
        endDate: options.endDate,
        status: 'Active',
        createdAt: new Date().toISOString()
      };
      
      const policyDataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(policyDataDir)) {
        fs.mkdirSync(policyDataDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(policyDataDir, `policy-${policyId}.json`),
        JSON.stringify(policyData, null, 2)
      );
      
      console.log(`Policy data saved to ./data/policy-${policyId}.json`);
    } catch (error) {
      console.error('Error creating policy:', error);
    }
  });

// Submit claim command
program
  .command('submit-claim')
  .description('Submit a new insurance claim')
  .requiredOption('--policy-id <policyId>', 'ID of the policy')
  .requiredOption('--amount <amount>', 'Claim amount')
  .requiredOption('--reason <reason>', 'Reason for the claim')
  .option('--date <date>', 'Submission date (ISO format)', new Date().toISOString())
  .option('--private-key <privateKey>', 'Private key for transaction signing')
  .action(async (options) => {
    try {
      const claimId = `CLM-${uuidv4()}`;
      console.log(`Submitting claim ${claimId} for policy ${options.policyId}...`);
      
      // In a real implementation, we would submit this transaction to the blockchain
      // For now, we'll just log the payload
      const payload = blockchainManager.createSubmitClaimPayload(
        claimId,
        options.policyId,
        parseInt(options.amount),
        options.reason,
        options.date
      );
      
      console.log('Transaction payload created:');
      console.log(JSON.stringify(payload, null, 2));
      
      // Save claim data to a local file for testing
      const claimData = {
        claimId,
        policyId: options.policyId,
        amount: parseInt(options.amount),
        reason: options.reason,
        submissionDate: options.date,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };
      
      const claimDataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(claimDataDir)) {
        fs.mkdirSync(claimDataDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(claimDataDir, `claim-${claimId}.json`),
        JSON.stringify(claimData, null, 2)
      );
      
      console.log(`Claim data saved to ./data/claim-${claimId}.json`);
    } catch (error) {
      console.error('Error submitting claim:', error);
    }
  });

// Get user policies command
program
  .command('get-policies')
  .description('Get policies for a user')
  .argument('<address>', 'Wallet address of the user')
  .action(async (address) => {
    try {
      console.log(`Fetching policies for wallet ${address}...`);
      const policies = await blockchainManager.getUserPolicies(address);
      
      if (policies.length === 0) {
        console.log('No policies found for this user.');
      } else {
        console.log('Policies:');
        policies.forEach((policy, index) => {
          console.log(`\nPolicy ${index + 1}:`);
          console.log(JSON.stringify(policy, null, 2));
        });
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
    }
  });

// Get policy details command
program
  .command('get-policy-details')
  .description('Get details of a specific policy')
  .argument('<policyId>', 'ID of the policy')
  .action(async (policyId) => {
    try {
      console.log(`Fetching details for policy ${policyId}...`);
      const policy = await blockchainManager.getPolicyDetails(policyId);
      
      if (!policy) {
        console.log('Policy not found.');
      } else {
        console.log('Policy details:');
        console.log(JSON.stringify(policy, null, 2));
      }
    } catch (error) {
      console.error('Error fetching policy details:', error);
    }
  });

// Get claim status command
program
  .command('get-claim-status')
  .description('Get status of a specific claim')
  .argument('<claimId>', 'ID of the claim')
  .action(async (claimId) => {
    try {
      console.log(`Fetching status for claim ${claimId}...`);
      const claim = await blockchainManager.getClaimStatus(claimId);
      
      if (!claim) {
        console.log('Claim not found.');
      } else {
        console.log('Claim details:');
        console.log(JSON.stringify(claim, null, 2));
      }
    } catch (error) {
      console.error('Error fetching claim status:', error);
    }
  });

// Parse command line arguments
program.parse(process.argv); 