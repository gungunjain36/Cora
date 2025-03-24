import { Network } from "@aptos-labs/ts-sdk";
import { NetworkInfo, isAptosNetwork } from "@aptos-labs/wallet-adapter-react";

export const isValidNetworkName = (network: NetworkInfo | null) => {
  if (isAptosNetwork(network)) {
    return Object.values<string | undefined>(Network).includes(network?.name);
  }
  // If the configured network is not an Aptos network, i.e is a custom network
  // we resolve it as a valid network name
  return true;
};

/**
 * Converts a hex string to a Uint8Array of bytes
 * @param hexString - Hex string to convert (with or without 0x prefix)
 * @returns Uint8Array of bytes
 */
export function hexToBytes(hexString: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  
  // Ensure even length
  const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : "0" + cleanHex;
  
  const bytes = new Uint8Array(paddedHex.length / 2);
  
  for (let i = 0; i < paddedHex.length; i += 2) {
    bytes[i / 2] = parseInt(paddedHex.substring(i, i + 2), 16);
  }
  
  return bytes;
}

/**
 * Formats an address to include 0x prefix if missing
 * @param address - Blockchain address
 * @returns Formatted address with 0x prefix
 */
export function formatAddress(address: string): string {
  if (!address) return "";
  return address.startsWith("0x") ? address : `0x${address}`;
}

/**
 * Shortens an address for display
 * @param address - Blockchain address
 * @param chars - Number of characters to show at start and end
 * @returns Shortened address
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  const formatted = formatAddress(address);
  return `${formatted.substring(0, chars + 2)}...${formatted.substring(formatted.length - chars)}`;
}

/**
 * Format a number to a currency string
 * @param amount - Amount to format
 * @param currency - Currency symbol
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = "$"): string {
  return `${currency}${amount.toLocaleString()}`;
}

/**
 * Format a date from timestamp
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatDate(timestamp: number): string {
  // Convert seconds to milliseconds if needed
  const ms = timestamp > 10000000000 ? timestamp : timestamp * 1000;
  return new Date(ms).toLocaleDateString();
}
