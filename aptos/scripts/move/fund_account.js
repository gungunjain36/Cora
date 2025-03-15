require("dotenv").config();
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

async function fundAccount() {
  try {
    // Check if the required environment variables are set
    if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS) {
      throw new Error(
        "VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS variable is not set, make sure you have set the publisher account address",
      );
    }

    const accountAddress = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS;
    
    // Check if the aptos command is installed globally
    let aptosCommand = "aptos";
    try {
      execSync("aptos --version", { stdio: "ignore" });
    } catch (error) {
      // Try to use the local aptos command from node_modules
      const localAptosPath = path.resolve(__dirname, "../../../node_modules/.bin/aptos");
      if (fs.existsSync(localAptosPath)) {
        aptosCommand = localAptosPath;
      } else {
        // Use npx as a fallback
        aptosCommand = "npx aptos";
      }
    }

    console.log(`Funding account: ${accountAddress}`);
    
    // Construct the command to fund the account
    const command = `${aptosCommand} account fund-with-faucet --account ${accountAddress} --amount 100000000 --faucet-url https://faucet.testnet.aptoslabs.com --url https://api.testnet.aptoslabs.com/v1`;
    
    // Execute the command
    console.log("Executing command to fund account...");
    const output = execSync(command, { encoding: "utf8" });
    console.log(output);
    
    console.log("Account funded successfully!");
    console.log("You can now run 'pnpm run move:check-balance' to verify the balance.");
    console.log("After confirming the balance, run 'pnpm run move:publish' to publish the contract.");
    
  } catch (error) {
    console.error("Error funding account:", error.message);
    if (error.stdout) console.error("Command output:", error.stdout.toString());
    if (error.stderr) console.error("Command error:", error.stderr.toString());
    
    console.log("\n=== ALTERNATIVE FUNDING METHOD ===");
    console.log("If the automatic funding failed, please fund your account manually:");
    console.log(`1. Visit: https://aptos.dev/network/faucet?address=${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS}`);
    console.log("2. After funding, run 'pnpm run move:check-balance' to verify the balance.");
    console.log("3. Then run 'pnpm run move:publish' to publish the contract.");
    console.log("===============================\n");
    
    process.exit(1);
  }
}

fundAccount(); 