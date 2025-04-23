// hypermap-web-explorer/hypermap-explorer/lib/constants.js
import { parseAbi } from 'viem';

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
  'function tbaOf(bytes32 entry) external view returns (address tba)'
  // Add 'note', 'fact', 'gene' if needed by other features later
]);

// --- ADD THIS ABI DEFINITION ---
// ABI for the standard 'execute' function on a Token Bound Account (TBA)
// This allows the TBA owner to interact with other contracts.
export const mechAbi = parseAbi([
  'function execute(address target, uint256 value, bytes calldata data, uint8 operation) returns (bytes memory returnData)'
]);
// --- END ADD ---