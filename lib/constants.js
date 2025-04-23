// hypermap-web-explorer/hypermap-explorer/lib/constants.js
import { parseAbi, encodeFunctionData } from 'viem';

// Address of the main Hypermap contract on Base
export const HYPERMAP_ADDRESS = '0x000000000044C6B8Cb4d8f0F889a3E47664EAeda';

// Default implementation address for new Token Bound Accounts (TBAs) created via mint
// Needed as an argument for the 'mint' function.
export const HYPER_ACCOUNT_IMPL = '0x0000000000EDAd72076CBe7b9Cfa3751D5a85C97';

// Base Chain ID (useful for checks)
export const BASE_CHAIN_ID = 8453;

// ABI for the Hypermap contract - Include functions needed across the app
// Added 'get' and 'tbaOf' based on contract source provided
export const hypermapAbi = parseAbi([
  // Function to create a new namespace entry and its TBA (called via parent TBA execute)
  'function mint(address owner, bytes calldata node, bytes calldata data, address implementation) external returns (address tba)',
  // Function to retrieve entry info (used by backend, potentially useful elsewhere)
  'function get(bytes32 node) external view returns (address tba, address owner, bytes memory note)',
  // Function to retrieve TBA address directly (alternative to 'get')
  'function tbaOf(bytes32 entry) external view returns (address tba)',
  // Add note and fact functions needed for the new features
  'function note(string calldata key, string calldata val) external returns (bool)',
  'function fact(string calldata key, string calldata val) external returns (bool)'
]);

// --- ADD THIS ABI DEFINITION ---
// ABI for the standard 'execute' function on a Token Bound Account (TBA)
// This allows the TBA owner to interact with other contracts.
export const mechAbi = parseAbi([
  'function execute(address target, uint256 value, bytes calldata data, uint8 operation) returns (bytes memory returnData)'
]);
// --- END ADD ---

/**
 * Encodes the calldata for adding or updating a note via Hypermap contract.
 * @param {string} key - The note key (e.g., "~content"). Must start with ~.
 * @param {string} value - The note value.
 * @returns {`0x${string}`} - The encoded calldata for the hypermap.note() function.
 */
export function encodeNoteData(key, value) {
  // Add validation or ensure key starts with ~ before calling if needed
  return encodeFunctionData({
    abi: hypermapAbi, // ABI of the main Hypermap contract
    functionName: 'note',
    args: [key, value],
  });
}

/**
 * Encodes the calldata for adding a fact via Hypermap contract.
 * @param {string} key - The fact key (e.g., "!website"). Must start with !.
 * @param {string} value - The fact value.
 * @returns {`0x${string}`} - The encoded calldata for the hypermap.fact() function.
 */
export function encodeFactData(key, value) {
  // Add validation or ensure key starts with ! before calling if needed
  return encodeFunctionData({
    abi: hypermapAbi, // ABI of the main Hypermap contract
    functionName: 'fact',
    args: [key, value],
  });
}