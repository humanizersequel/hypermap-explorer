// hypermap-web-explorer/hypermap-explorer/components/MintSubEntry.js (Final Version)
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { encodePacked, stringToHex } from 'viem'; // Utilities for encoding arguments
import { HYPERMAP_ADDRESS, hypermapAbi, HYPER_ACCOUNT_IMPL, BASE_CHAIN_ID } from '../lib/constants';

// Props received from NamespaceInfo:
// parentNamespace: string (e.g., "nick.hypr")
export default function MintSubEntry({ parentNamespace }) {
  // Hooks to get wallet/chain info
  const { address: connectedAddress, isConnected } = useAccount();
  const currentChainId = useChainId();

  // State for the input field
  const [subLabel, setSubLabel] = useState('');

  // Wagmi hook for preparing and sending transactions
  const { data: transactionHash, error: writeError, isPending: isSending, writeContract } = useWriteContract();

  // Function triggered by the mint button
  const handleMint = () => {
    const trimmedLabel = subLabel.trim();
    // --- Input Validation ---
    if (!trimmedLabel) {
      alert('Please enter a label for the new sub-entry.');
      return;
    }
    // Add more specific label validation if needed (e.g., no dots, spaces?)
    if (trimmedLabel.includes('.') || trimmedLabel.includes(' ')) {
        alert('Label cannot contain dots or spaces.');
        return;
    }
    // --- End Validation ---

    // --- Pre-flight Checks ---
    // These should ideally be guaranteed by the parent component (NamespaceInfo)
    // conditionally rendering this component, but double-check.
    if (!isConnected || !connectedAddress || !parentNamespace || currentChainId !== BASE_CHAIN_ID) {
      alert('Minting prerequisites not met. Ensure you are connected on Base network and viewing a valid entry you own.');
      console.error("Mint prerequisite failed in MintSubEntry:", { isConnected, connectedAddress, parentNamespace, currentChainId });
      return;
    }
    // --- End Checks ---


    // --- Prepare Mint Arguments ---
    // Construct the full name (e.g., "data.nick.hypr")
    const fullNodeName = `${trimmedLabel}.${parentNamespace}`;
    console.log(`Attempting to mint: ${fullNodeName}`);

    // Arguments array for the 'mint' function call:
    // mint(address owner, bytes calldata node, bytes calldata data, address implementation)
    const mintArgs = [
        connectedAddress, // The minter becomes the owner of the new sub-entry/TBA
        encodePacked(['bytes'], [stringToHex(fullNodeName)]), // The full name, encoded as bytes
        '0x', // No initial setup data for the TBA in this basic case
        HYPER_ACCOUNT_IMPL, // Address of the standard TBA implementation contract
    ];
    console.log("Mint arguments prepared:", mintArgs);
    // --- End Argument Prep ---

    // --- Initiate Transaction ---
    // Call the function provided by useWriteContract hook
    console.log("Calling writeContract for mint...");
    writeContract({
      address: HYPERMAP_ADDRESS, // Target the main Hypermap contract
      abi: hypermapAbi,          // Use its ABI (specifically the 'mint' function)
      functionName: 'mint',     // Function to call
      args: mintArgs,           // Arguments prepared above
      chainId: BASE_CHAIN_ID,    // Ensure the transaction is for Base network
    });
    // --- End Transaction Initiation ---
  };

  // --- Transaction Monitoring ---
  // Hook to watch the transaction status using the hash returned by writeContract
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({
       hash: transactionHash, // The hash from the writeContract result
       chainId: BASE_CHAIN_ID, // Specify chain for monitoring
       // Optional: confirmations: 1, // Wait for 1 block confirmation
    });
  // --- End Monitoring ---


  // --- Render Component UI ---
  return (
    <div style={{ border: '1px solid #d0d0d0', padding: '15px', borderRadius: '6px', backgroundColor: '#ffffff' }}>
      <h4>Mint New Sub-entry</h4>
      <p style={{ fontSize: '0.95em', color: '#333' }}>
        Create a new entry directly under <strong>{parentNamespace}</strong>.
        You ({connectedAddress ? `${connectedAddress.substring(0, 6)}...` : ''}) will be the owner.
      </p>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', marginTop: '10px' }}>
        <input
          type="text"
          value={subLabel}
          onChange={(e) => setSubLabel(e.target.value)}
          placeholder="Enter new label (no dots/spaces)"
          style={{ padding: '10px', flexGrow: 1, border: '1px solid #ccc', borderRadius: '4px' }}
          // Disable input while sending or confirming transaction
          disabled={isSending || isConfirming}
        />
        <button
          onClick={handleMint}
          // More robust disable logic
          disabled={!subLabel.trim() || subLabel.includes('.') || subLabel.includes(' ') || isSending || isConfirming || !isConnected || currentChainId !== BASE_CHAIN_ID}
          style={{ padding: '10px 18px', border: 'none', borderRadius: '4px', backgroundColor: '#0052FF', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}
          // Add hover effect maybe?
        >
          {/* Dynamic button text based on state */}
          {isSending ? 'Sending Tx...' : (isConfirming ? 'Minting (Confirming...)' : 'Mint Sub-Entry')}
        </button>
      </div>

      {/* Transaction Status Feedback Area */}
      <div style={{ marginTop: '15px', fontSize: '0.9em' }}>
          {transactionHash && !isConfirmed && !receiptError && !writeError && (
             <p style={{ color: '#555', wordBreak: 'break-all' }}>Transaction submitted: {transactionHash}</p>
          )}
          {isConfirming && (
             <p style={{ color: 'blue' }}>Waiting for blockchain confirmation...</p>
          )}
          {isConfirmed && (
             <p style={{ color: 'green', fontWeight: 'bold', wordBreak: 'break-all' }}>✅ Mint successful! Tx: {transactionHash} (Refresh page to see new entry)</p>
          )}
          {/* Display errors from either sending or confirmation phase */}
          {(writeError || receiptError) && (
             <p style={{ color: 'red', fontWeight: 'bold' }}>
                ❌ Minting Error: {(writeError?.shortMessage || receiptError?.shortMessage || writeError?.message || receiptError?.message)}
             </p>
          )}
      </div>
      {/* --- End Feedback --- */}
    </div>
  );
}