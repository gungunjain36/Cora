require("dotenv").config();
const { execSync } = require("child_process");
const fs = require("fs");

async function publishUpdate() {
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
    console.log("Publishing updated Move contract...");
    console.log("Using account address:", process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS);
    
    // Create a temporary file to store the private key
    const privateKeyPath = "./temp_private_key.txt";
    const privateKeyWithoutPrefix = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY.startsWith("0x")
      ? process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY.slice(2)
      : process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY;
    
    fs.writeFileSync(privateKeyPath, privateKeyWithoutPrefix);
    
    // Set named addresses for compilation
    const namedAddresses = `cora_insurance_addr=${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS}`;
    
    // Determine the API URL based on the network
    const network = process.env.VITE_APP_NETWORK || "testnet";
    const apiUrl = network === "mainnet" 
      ? "https://fullnode.mainnet.aptoslabs.com/v1" 
      : "https://fullnode.testnet.aptoslabs.com/v1";
    
    // Run the aptos CLI command
    const output = execSync(
      `aptos move publish --package-dir contract --named-addresses ${namedAddresses} --private-key-file ${privateKeyPath} --assume-yes --url ${apiUrl}`,
      { stdio: 'inherit' }
    );
    
    // Clean up the temporary private key file
    fs.unlinkSync(privateKeyPath);
    
    console.log("Contract published successfully");
  } catch (error) {
    console.error("Failed to publish updated contract:", error.message);
    
    // Clean up the temporary private key file if it exists
    try {
      if (fs.existsSync("./temp_private_key.txt")) {
        fs.unlinkSync("./temp_private_key.txt");
      }
    } catch (e) {
      console.error("Error cleaning up temporary file:", e.message);
    }
    
    process.exit(1);
  }
}

publishUpdate();
