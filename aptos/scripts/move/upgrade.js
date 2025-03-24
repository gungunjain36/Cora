require("dotenv").config();
const cli = require("@aptos-labs/ts-sdk/dist/common/cli/index.js");
const aptosSDK = require("@aptos-labs/ts-sdk")

async function publish() {
  if (!process.env.VITE_MODULE_ADDRESS) {
    throw new Error(
      "VITE_MODULE_ADDRESS variable is not set, make sure you have published the module before upgrading it",
    );
  }

  if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY) {
    throw new Error(
      "VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY variable is not set, make sure you have set the publisher account private key",
    );
  }

  try {
    console.log("Upgrading Move contract...");
    console.log("Using account address:", process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS);
    
    const move = new cli.Move();

    await move.upgradeObjectPackage({
      packageDirectoryPath: "contract",
      objectAddress: process.env.VITE_MODULE_ADDRESS,
      namedAddresses: {
        // Use the correct named address for Cora insurance
        cora_insurance_addr: process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS,
      },
      extraArguments: [
        `--private-key=${process.env.VITE_MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY}`,
        `--url=${aptosSDK.NetworkToNodeAPI[process.env.VITE_APP_NETWORK]}`,
        "--assume-yes"
      ],
    });
    
    console.log("Contract upgraded successfully");
  } catch (error) {
    console.error("Failed to upgrade contract:", error.message);
    process.exit(1);
  }
}

publish();
