require("dotenv").config();
const fs = require("node:fs");
const { execSync } = require("child_process");
const aptosSDK = require("@aptos-labs/ts-sdk");
const path = require("path");

async function initAccount() {
  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS variable is not set, make sure you have set the publisher account address",
    );
  }

  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY variable is not set, make sure you have set the publisher account private key",
    );
  }

  try {
    // Get the network URL
    const networkUrl = process.env.VITE_APP_NETWORK 
      ? aptosSDK.NetworkToNodeAPI[process.env.VITE_APP_NETWORK] 
      : "https://api.testnet.aptoslabs.com/v1";
    
    // Use a more direct approach to run the aptos CLI
    // First, check if aptos is installed globally
    let aptosCommand;
    try {
      execSync("aptos --version", { stdio: 'ignore' });
      aptosCommand = "aptos";
    } catch (e) {
      // If not installed globally, use the local node_modules path
      const localAptosBin = path.resolve(__dirname, "../../../node_modules/.bin/aptos");
      if (fs.existsSync(localAptosBin)) {
        aptosCommand = localAptosBin;
      } else {
        // Try npx as a last resort
        aptosCommand = "npx aptos";
      }
    }
    
    // Build the command to initialize account with testnet faucet
    const command = `${aptosCommand} account fund-with-faucet \
      --account ${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS} \
      --faucet-url https://faucet.testnet.aptoslabs.com \
      --url ${networkUrl}`;
    
    console.log("Initializing account with testnet faucet...");
    console.log(`Using command: ${aptosCommand} account fund-with-faucet`);
    
    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);
    
    console.log("Account initialized successfully!");
    
  } catch (error) {
    console.error("Error initializing account:", error.message);
    if (error.stdout) console.error("stdout:", error.stdout);
    if (error.stderr) console.error("stderr:", error.stderr);
    process.exit(1);
  }
}

initAccount(); 