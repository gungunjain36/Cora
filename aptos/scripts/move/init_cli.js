require("dotenv").config();
const fs = require("node:fs");
const { execSync } = require("child_process");
const path = require("path");

async function initCli() {
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
    
    // Create a temporary file with the private key
    const tempKeyFile = path.resolve(__dirname, "../../temp_private_key.txt");
    fs.writeFileSync(tempKeyFile, process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY.replace(/^0x/, ''), 'utf8');
    
    // Build the command to initialize the CLI
    const command = `${aptosCommand} init \
      --profile default \
      --private-key-file ${tempKeyFile} \
      --assume-yes \
      --network testnet`;
    
    console.log("Initializing Aptos CLI...");
    console.log(`Using command: ${aptosCommand} init`);
    
    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);
    
    // Remove the temporary file
    fs.unlinkSync(tempKeyFile);
    
    console.log("Aptos CLI initialized successfully!");
    
  } catch (error) {
    console.error("Error initializing Aptos CLI:", error.message);
    if (error.stdout) console.error("stdout:", error.stdout);
    if (error.stderr) console.error("stderr:", error.stderr);
    
    // Clean up temporary file if it exists
    const tempKeyFile = path.resolve(__dirname, "../../temp_private_key.txt");
    if (fs.existsSync(tempKeyFile)) {
      fs.unlinkSync(tempKeyFile);
    }
    
    process.exit(1);
  }
}

initCli(); 