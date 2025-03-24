import { createSurfClient } from "@thalalabs/surf";
import { aptosClient } from "./aptosClient";

// Create surf client with error handling
let surfInstance: ReturnType<typeof createSurfClient> | null = null;

export function surfClient() {
  if (!surfInstance) {
    try {
      surfInstance = createSurfClient(aptosClient());
    } catch (error) {
      console.error("Error initializing Surf client:", error);
      // Create a basic client with error handling to prevent crashes
      throw new Error("Failed to initialize Surf client");
    }
  }
  return surfInstance;
}
