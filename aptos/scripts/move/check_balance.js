require("dotenv").config();
const { Aptos, AptosConfig, Network } = require("@aptos-labs/ts-sdk");

async function checkBalance() {
  try {
    // Check if the required environment variables are set
    if (!process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS) {
      throw new Error(
        "VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS variable is not set, make sure you have set the publisher account address",
      );
    }

    // Initialize the Aptos SDK
    const config = new AptosConfig({ 
      network: Network.TESTNET 
    });
    const aptos = new Aptos(config);
    
    const accountAddress = process.env.VITE_MODULE_PUBLISHER_ACCOUNT_ADDRESS;
    
    console.log(`Checking balance for account: ${accountAddress}`);
    
    try {
      // Try to get account resources
      const resources = await aptos.getAccountResources({
        accountAddress: accountAddress,
      });
      
      // Find the coin resource
      const coinResource = resources.find(
        (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );
      
      if (coinResource) {
        const balance = coinResource.data.coin.value;
        console.log(`Account balance: ${balance} octas (${balance / 100000000} APT)`);
        
        if (balance > 0) {
          console.log("✅ Account is funded and ready to publish the contract.");
          console.log("You can run 'pnpm run move:publish' to publish the contract.");
        } else {
          console.log("❌ Account has zero balance. Please fund your account.");
          console.log(`Please visit: https://aptos.dev/network/faucet?address=${accountAddress}`);
        }
      } else {
        console.log("❌ Account exists but no coin resource found. Please fund your account.");
        console.log(`Please visit: https://aptos.dev/network/faucet?address=${accountAddress}`);
      }
    } catch (error) {
      if (error.message && error.message.includes("Account not found")) {
        console.log("❌ Account does not exist on the blockchain yet.");
        console.log("Please fund your account to create it on-chain.");
        console.log(`Please visit: https://aptos.dev/network/faucet?address=${accountAddress}`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("Error checking balance:", error.message);
    process.exit(1);
  }
}

checkBalance(); 