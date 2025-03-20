require("dotenv").config();
const fs = require("node:fs");

const modules = [
  { address: process.env.VITE_MODULE_ADDRESS, name: "message_board" },
  { address: "0x1", name: "coin" },
  // Add our insurance contracts
  { address: process.env.VITE_MODULE_ADDRESS, name: "policy_registry" },
  { address: process.env.VITE_MODULE_ADDRESS, name: "premium_escrow" },
  { address: process.env.VITE_MODULE_ADDRESS, name: "claim_processor" },
  { address: process.env.VITE_MODULE_ADDRESS, name: "cora_insurance" },
];

async function getAbi() {
  // Wait for 5 seconds to ensure the module is deployed
  await new Promise((resolve) => setTimeout(resolve, 5000));
  modules.forEach((module) => {
    const url = `https://fullnode.${process.env.VITE_APP_NETWORK}.aptoslabs.com/v1/accounts/${module.address}/module/${module.name}`;
    fetch(url)
      .then((response) => response.json())
      .then((response) => {
        if (response.error) {
          console.log(`Error fetching ${module.name} ABI: ${response.error.message || JSON.stringify(response.error)}`);
          // Create an empty ABI file if the module doesn't exist
          const abiString = `export const ${module.name.toUpperCase()}_ABI = undefined as const;`;
          fs.writeFileSync(`frontend/utils/${module.name}_abi.ts`, abiString);
          return;
        }
        
        const abi = response.abi;
        const abiString = `export const ${module.name.toUpperCase()}_ABI = ${JSON.stringify(abi)} as const;`;
        fs.writeFileSync(`frontend/utils/${module.name}_abi.ts`, abiString);
        console.log(`${module.name} ABI saved to frontend/utils/${module.name}_abi.ts`);
      })
      .catch((error) => {
        console.error(`Error fetching ${module.name} ABI:`, error);
        // Create an empty ABI file if there was an error
        const abiString = `export const ${module.name.toUpperCase()}_ABI = undefined as const;`;
        fs.writeFileSync(`frontend/utils/${module.name}_abi.ts`, abiString);
      });
  });
}

getAbi();
