// hypermap-web-explorer/hypermap-explorer/lib/constants.js
import { parseAbi } from 'viem';

// Address of the main Hypermap contract on Base
export const HYPERMAP_ADDRESS = '0x000000000044C6B8Cb4d8f0F889a3E47664EAeda';

// Default implementation address for new Token Bound Accounts (TBAs) created via mint
// Needed as an argument for the 'mint' function.
export const HYPER_ACCOUNT_IMPL = '0x0000000000EDAd72076CBe7b9Cfa3751D5a85C97';

// Base Chain ID (useful for checks)
export const BASE_CHAIN_ID = 8453;

// ABI for the Hypermap contract - ONLY include functions we currently use ('mint')
// Removed 'get', 'note', 'fact' as they are not needed based on current scope.
export const hypermapAbi = parseAbi([
  // Function to create a new namespace entry and its TBA
  'function mint(address owner, bytes calldata node, bytes calldata data, address implementation) external returns (address tba)',
]);