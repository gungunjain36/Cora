require("dotenv").config();
const { Aptos, AptosConfig, Network, Account, AccountAddress } = require("@aptos-labs/ts-sdk");
const fs = require("node:fs");

async function createAccount() {
  try {
    // Initialize the Aptos SDK
    const config = new AptosConfig({ 
      network: Network.TESTNET 
    });
    const aptos = new Aptos(config);
    
    // Create a new account
    console.log("Creating a new account...");
    const account = Account.generate();
    
    // Get the account address and private key
    const accountAddress = account.accountAddress;
    const privateKey = account.privateKey;
    
    console.log(`Account address: ${accountAddress.toString()}`);
    console.log(`Private key: ${privateKey.toString()}`);
    
    // Update the .env file with the account address and private key
    const filePath = ".env";
    let envContent = "";

    // Check .env file exists and read it
    if (fs.existsSync(filePath)) {
      envContent = fs.readFileSync(filePath, "utf8");
    }

    // Update VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS
    const addressRegex = /^VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS=.*$/m;
    const newAddressEntry = `VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS=${accountAddress.toString()}`;

    // Update VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY
    const privateKeyRegex = /^VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY=.*$/m;
    const newPrivateKeyEntry = `VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY=${privateKey.toString()}`;

    // Check if variables are already defined and update them
    if (envContent.match(addressRegex)) {
      envContent = envContent.replace(addressRegex, newAddressEntry);
    } else {
      envContent += `\n${newAddressEntry}`;
    }

    if (envContent.match(privateKeyRegex)) {
      envContent = envContent.replace(privateKeyRegex, newPrivateKeyEntry);
    } else {
      envContent += `\n${newPrivateKeyEntry}`;
    }

    // Write the updated content back to the .env file
    fs.writeFileSync(filePath, envContent, "utf8");
    console.log("Updated .env file with the new account address and private key");
    
    // Also update the VITE_MODULE_ADDRESS
    const moduleAddressRegex = /^VITE_MODULE_ADDRESS=.*$/m;
    const newModuleAddressEntry = `VITE_MODULE_ADDRESS=${accountAddress.toString()}`;
    
    if (envContent.match(moduleAddressRegex)) {
      envContent = envContent.replace(moduleAddressRegex, newModuleAddressEntry);
    } else {
      envContent += `\n${newModuleAddressEntry}`;
    }
    
    // Write the updated content back to the .env file
    fs.writeFileSync(filePath, envContent, "utf8");
    console.log("Updated .env file with the module address");
    
    // Provide instructions for funding the account
    console.log("\n=== IMPORTANT: MANUAL STEP REQUIRED ===");
    console.log("You need to fund your account with testnet APT before publishing the contract.");
    console.log(`Please visit: https://aptos.dev/network/faucet?address=${accountAddress.toString()}`);
    console.log("After funding your account, you can run 'pnpm run move:publish' to publish the contract.");
    console.log("=======================================\n");
    
  } catch (error) {
    console.error("Error creating account:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

createAccount(); 