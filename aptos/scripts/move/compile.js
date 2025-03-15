require("dotenv").config();
const { execSync } = require("child_process");

async function compile() {
  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS variable is not set, make sure you have set the publisher account address",
    );
  }

  try {
    console.log("Compiling Move contract...");
    
    const namedAddresses = `cora_insurance_addr=${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS}`;
    
    const output = execSync(
      `aptos move compile --package-dir contract --named-addresses ${namedAddresses}`,
      { stdio: 'inherit' }
    );
    
    console.log("Contract compiled successfully");
  } catch (error) {
    console.error("Failed to compile contract:", error.message);
    process.exit(1);
  }
}

compile();
