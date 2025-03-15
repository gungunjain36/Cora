require("dotenv").config();
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

async function publishMovePackage() {
  try {
    // Check if the required environment variables are set
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

    // Get the network URL
    const network = process.env.VITE_APP_NETWORK || "testnet";
    const networkUrl = network === "mainnet"
      ? "https://api.mainnet.aptoslabs.com/v1"
      : "https://api.testnet.aptoslabs.com/v1";

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

    // Create a temporary file to store the private key
    const privateKeyWithoutPrefix = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY.startsWith("0x")
      ? process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY.slice(2)
      : process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY;
    
    const tempKeyFilePath = path.resolve(__dirname, "../../temp_private_key.txt");
    fs.writeFileSync(tempKeyFilePath, privateKeyWithoutPrefix, "utf8");

    // Construct the command to publish the package
    const command = `${aptosCommand} move publish --package-dir contract --named-addresses cora_insurance_addr=${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS} --private-key-file ${tempKeyFilePath} --assume-yes --url ${networkUrl}`;

    console.log("Publishing Move package...");
    console.log(`Using account address: ${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS}`);
    
    // Execute the command
    const output = execSync(command, { encoding: "utf8" });
    console.log(output);

    // Extract the transaction hash from the output
    const txHashMatch = output.match(/Transaction hash: (0x[a-f0-9]+)/i);
    if (txHashMatch && txHashMatch[1]) {
      console.log(`Transaction hash: ${txHashMatch[1]}`);
    }

    // Update the .env file with the module address
    const moduleAddress = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS;
    const envFilePath = ".env";
    let envContent = "";

    // Check if .env file exists and read it
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, "utf8");
    }

    // Update VITE_MODULE_ADDRESS
    const moduleAddressRegex = /^VITE_MODULE_ADDRESS=.*$/m;
    const newModuleAddressEntry = `VITE_MODULE_ADDRESS=${moduleAddress}`;

    if (envContent.match(moduleAddressRegex)) {
      envContent = envContent.replace(moduleAddressRegex, newModuleAddressEntry);
    } else {
      envContent += `\n${newModuleAddressEntry}`;
    }

    // Write the updated content back to the .env file
    fs.writeFileSync(envFilePath, envContent, "utf8");
    console.log(`Updated .env file with module address: ${moduleAddress}`);

    console.log("Move package published successfully!");
  } catch (error) {
    console.error("Error publishing Move package:", error.message);
    if (error.stdout) console.error("Command output:", error.stdout.toString());
    if (error.stderr) console.error("Command error:", error.stderr.toString());
    process.exit(1);
  } finally {
    // Clean up the temporary key file
    const tempKeyFilePath = path.resolve(__dirname, "../../temp_private_key.txt");
    if (fs.existsSync(tempKeyFilePath)) {
      fs.unlinkSync(tempKeyFilePath);
    }
  }
}

publishMovePackage();
