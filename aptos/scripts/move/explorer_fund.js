require("dotenv").config();
const open = require("open");

async function openExplorerFundPage() {
  try {
    // Check if the required environment variables are set
    if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS) {
      throw new Error(
        "VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS variable is not set, make sure you have set the publisher account address",
      );
    }

    const accountAddress = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS;
    
    // Generate the URL to the Aptos Explorer
    const explorerUrl = `https://explorer.aptoslabs.com/account/${accountAddress}?network=testnet`;
    const faucetUrl = `https://aptoslabs.com/testnet-faucet?address=${accountAddress}`;
    
    console.log("\n=== FUND YOUR ACCOUNT ===");
    console.log(`Account address: ${accountAddress}`);
    console.log("\nPlease use one of the following methods to fund your account:");
    
    console.log("\nMethod 1: Aptos Explorer");
    console.log(`1. Visit: ${explorerUrl}`);
    console.log("2. Click on 'Request Testnet Funds' button on the account page");
    
    console.log("\nMethod 2: Aptos Faucet");
    console.log(`1. Visit: ${faucetUrl}`);
    console.log("2. Follow the instructions on the page to fund your account");
    
    console.log("\nMethod 3: Aptos Dev Portal");
    console.log(`1. Visit: https://aptos.dev/network/faucet?address=${accountAddress}`);
    
    console.log("\nAfter funding your account:");
    console.log("1. Run 'pnpm run move:check-balance' to verify the balance");
    console.log("2. Run 'pnpm run move:publish' to publish the contract");
    console.log("===============================\n");
    
    // Try to open the explorer URL in the default browser
    try {
      console.log("Attempting to open the Aptos Explorer in your default browser...");
      await open(faucetUrl);
      console.log("Browser opened successfully!");
    } catch (openError) {
      console.log("Could not automatically open the browser. Please use the URLs above.");
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

openExplorerFundPage(); 