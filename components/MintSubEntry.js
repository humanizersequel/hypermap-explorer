// hypermap-web-explorer/hypermap-explorer/components/MintSubEntry.js

// --- Import necessary functions and constants ---
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
// Import encoding utilities from viem
import { encodeFunctionData, encodePacked, stringToHex } from 'viem';
// Import ABIs and addresses from constants file
import {
  HYPERMAP_ADDRESS,  // Address of the main Hypermap contract
  hypermapAbi,       // ABI for the Hypermap contract (needed for inner encoding)
  HYPER_ACCOUNT_IMPL,// Default implementation for new TBAs
  BASE_CHAIN_ID,     // Chain ID for Base
  mechAbi            // ABI for the TBA 'execute' function (NEW)
} from '../lib/constants';

// --- Component Definition ---
// Accept parentTbaAddress prop passed from NamespaceInfo
export default function MintSubEntry({ parentNamespace, parentTbaAddress }) {
  // Hooks to get wallet/chain info
  const { address: connectedAddress, isConnected } = useAccount();
  const currentChainId = useChainId();

  // State for the input field for the new sub-label
  const [subLabel, setSubLabel] = useState('');

  // Wagmi hook for sending transactions.
  // We don't pre-configure address/abi here as it depends on the dynamic parentTbaAddress.
  const { data: transactionHash, error: writeError, isPending: isSending, writeContract } = useWriteContract();

  // --- Function to handle the mint button click ---
  const handleMint = () => {
    // --- Input Validation ---
    const trimmedLabel = subLabel.trim(); // Remove leading/trailing whitespace
    // Check if label is empty or contains invalid characters (dots/spaces are disallowed by Hypermap labels)
    if (!trimmedLabel || trimmedLabel.includes('.') || trimmedLabel.includes(' ')) {
      alert('Invalid label. Label cannot be empty and cannot contain dots or spaces.');
      return; // Stop execution if label is invalid
    }

    // --- Prerequisite Checks ---
    // Ensure the parent TBA address was successfully passed from NamespaceInfo
    if (!parentTbaAddress) {
        alert('Parent TBA address is missing. Cannot initiate minting process.');
        console.error("handleMint called without parentTbaAddress in MintSubEntry");
        return; // Stop execution if parent TBA is missing
    }
    // Ensure user is connected, has an address, and is on the correct chain (Base)
    if (!isConnected || !connectedAddress || currentChainId !== BASE_CHAIN_ID) {
      alert('Minting prerequisites not met. Ensure you are connected on the Base network.');
      console.error("Mint prerequisite failed in MintSubEntry:", { isConnected, connectedAddress, currentChainId });
      return; // Stop execution if prerequisites fail
    }

    // --- Argument Preparation ---
    console.log(`Attempting to mint label '${trimmedLabel}' under parent ${parentNamespace} (TBA: ${parentTbaAddress})`);

    // STEP 1: Prepare the INNER encoded data for the actual Hypermap 'mint' function call.
    // This data will be passed *to* the parent TBA's 'execute' function.
    let encodedMintCallData;
    try {
      // We use encodeFunctionData to create the calldata for calling 'mint' on HYPERMAP_ADDRESS.
      encodedMintCallData = encodeFunctionData({
        abi: hypermapAbi,       // Use the ABI of the main Hypermap contract
        functionName: 'mint',  // Specify the 'mint' function
        args: [
          connectedAddress,     // to: The address receiving ownership of the NEW sub-entry's TBA.
          // node/label: IMPORTANT! Encode *only the new label* as bytes.
          encodePacked(['bytes'], [stringToHex(trimmedLabel)]),
          '0x',                 // initialization: No setup data for the new TBA in this case.
          HYPER_ACCOUNT_IMPL    // implementation: The default TBA implementation address.
        ]
      });
      console.log("STEP 1: Prepared Inner Encoded Mint Call Data:", encodedMintCallData);
    } catch (error) {
      console.error("Error encoding inner mint call data:", error);
      alert(`Failed to encode mint data: ${error.message}`);
      return; // Stop execution if encoding fails
    }

    // STEP 2: Prepare the arguments array for the Parent TBA's 'execute' function call.
    const executeArgs = [
       HYPERMAP_ADDRESS,      // target (address): The address of the contract the TBA should call (main Hypermap contract).
       0n,                    // value (uint256): Amount of ETH to send with the call (0 in this case). Use BigInt notation (0n).
       encodedMintCallData,   // data (bytes): The encoded 'mint' call prepared in Step 1. This is the action the TBA will perform.
       0                      // operation (uint8): Type of call. 0 typically means standard CALL.
    ];
    console.log("STEP 2: Prepared Arguments for Parent TBA Execute:", executeArgs);


    // STEP 3: Initiate the transaction by calling 'writeContract'.
    // We target the parent TBA's address and its 'execute' function.
    console.log(`STEP 3: Calling 'execute' on Parent TBA (${parentTbaAddress})...`);
    try {
      writeContract({
        address: parentTbaAddress,     // Target the PARENT's TBA address
        abi: mechAbi,                  // Use the ABI for the 'execute' function.
        functionName: 'execute',       // Specify the 'execute' function name.
        args: executeArgs,             // Pass the arguments prepared in Step 2.
        chainId: BASE_CHAIN_ID,        // Ensure transaction is for Base network.
        // value: 0n // Explicitly set value to 0 if needed, though often default
      });
    } catch (error) {
        // Catch potential errors during the writeContract call initiation itself
        console.error("Error initiating writeContract call:", error);
        alert(`Failed to initiate transaction: ${error.message}`);
    }
    // Note: Errors during transaction *sending* or *mining* will be caught by the `writeError` state variable from `useWriteContract`.
  };

  // --- Transaction Monitoring ---
  // Hook to watch the transaction status using the hash returned by writeContract
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
    useWaitForTransactionReceipt({
       hash: transactionHash, // The hash from the writeContract result
       chainId: BASE_CHAIN_ID, // Specify chain for monitoring
       // confirmations: 1, // Optional: Wait for 1 block confirmation
    });
  // --- End Monitoring ---


  // --- Render Component UI ---
  return (
    <div style={{ border: '1px solid #d0d0d0', padding: '15px', borderRadius: '6px', backgroundColor: '#ffffff' }}>
      <h4>Mint New Sub-entry</h4>
      <p style={{ fontSize: '0.95em', color: '#333' }}>
        Create a new entry under <strong>{parentNamespace}</strong>.
        {/* Display connected address concisely */}
        You ({connectedAddress ? `${connectedAddress.substring(0, 6)}...${connectedAddress.substring(connectedAddress.length - 4)}` : 'Disconnected'}) will be the owner.
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
          // Robust disable logic: check label validity, parent TBA presence, connection status, chain, and transaction status
          disabled={!subLabel.trim() || subLabel.includes('.') || subLabel.includes(' ') || !parentTbaAddress || isSending || isConfirming || !isConnected || currentChainId !== BASE_CHAIN_ID}
          style={{
              padding: '10px 18px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#0052FF',
              color: 'white',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              opacity: (!subLabel.trim() || subLabel.includes('.') || subLabel.includes(' ') || !parentTbaAddress || isSending || isConfirming || !isConnected || currentChainId !== BASE_CHAIN_ID) ? 0.5 : 1 // Visual cue for disabled
          }}
        >
          {/* Dynamic button text based on state */}
          {isSending ? 'Sending Tx...' : (isConfirming ? 'Minting (Confirming...)' : 'Mint Sub-Entry')}
        </button>
      </div>

      {/* Transaction Status Feedback Area */}
      <div style={{ marginTop: '15px', fontSize: '0.9em' }}>
          {/* Show hash immediately if sending starts successfully */}
          {transactionHash && !isConfirmed && !receiptError && !writeError && (
             <p style={{ color: '#555', wordBreak: 'break-all' }}>Transaction submitted: {transactionHash}</p>
          )}
          {isConfirming && (
             <p style={{ color: 'blue' }}>Waiting for blockchain confirmation...</p>
          )}
          {isConfirmed && (
             // Suggest page refresh to see update, as frontend state might not auto-update perfectly
             <p style={{ color: 'green', fontWeight: 'bold', wordBreak: 'break-all' }}>✅ Mint successful! Tx: {transactionHash} (You may need to refresh the page after a moment to see the new entry)</p>
          )}
          {/* Display errors: prioritize writeError (sending phase) then receiptError (confirmation phase) */}
          {(writeError || receiptError) && (
             <p style={{ color: 'red', fontWeight: 'bold' }}>
                {/* Use optional chaining and nullish coalescing for safer error message access */}
                ❌ Minting Error: {(writeError?.shortMessage ?? receiptError?.shortMessage ?? writeError?.message ?? receiptError?.message ?? 'An unknown error occurred.')}
             </p>
          )}
      </div>
      {/* --- End Feedback --- */}
    </div>
  );
}