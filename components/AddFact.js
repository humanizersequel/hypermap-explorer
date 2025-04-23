// hypermap-web-explorer/hypermap-explorer/components/AddFact.js
import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import {
    mechAbi, // Use the exported mechAbi for the TBA's execute function
    HYPERMAP_ADDRESS,
    encodeFactData, // Use fact encoder
    BASE_CHAIN_ID
} from '../lib/constants';

export default function AddFact({ tbaAddress, entryName }) {
    const [factKey, setFactKey] = useState('!');
    const [factValue, setFactValue] = useState('');
    const { address: connectedAddress, isConnected } = useAccount();
    const currentChainId = useChainId();
    const { openConnectModal } = useConnectModal();
    const addRecentTransaction = useAddRecentTransaction();

    const { data: transactionHash, error: writeError, isPending: isSending, writeContract } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
        useWaitForTransactionReceipt({
            hash: transactionHash,
            chainId: BASE_CHAIN_ID,
        });

    // Add recent transaction when confirmed
    React.useEffect(() => {
        if (isConfirmed && transactionHash) {
            addRecentTransaction({ hash: transactionHash, description: `Added fact ${factKey} to ${entryName}` });
             // Clear inputs on success? Optional.
            // setFactKey('!');
            // setFactValue('');
        }
    }, [isConfirmed, transactionHash, addRecentTransaction, factKey, entryName]);

    const handleFactKeyChange = (e) => {
        const value = e.target.value;
        if (!value) {
            setFactKey('!'); // Reset to default if cleared
        } else if (!value.startsWith('!')) {
            setFactKey('!' + value.replace(/ /g, '-')); // Replace spaces or disallow
        } else {
            setFactKey(value.replace(/ /g, '-'));
        }
    };

    const handleAddFact = async (e) => {
        e.preventDefault();

        const trimmedKey = factKey.trim();
        const trimmedValue = factValue.trim(); // Facts need a value

        if (!isConnected || !connectedAddress || currentChainId !== BASE_CHAIN_ID) {
            alert('Please connect your wallet to the Base network.');
            openConnectModal?.();
            return;
        }
         if (!tbaAddress) {
            alert("Target TBA address is missing.");
            console.error("AddFact called without tbaAddress.");
            return;
        }
        if (!trimmedKey || trimmedKey.length <= 1 || trimmedKey.includes('.') || trimmedKey.includes(' ')) {
            alert("Please provide a valid fact key starting with ! (no dots or spaces).");
            return;
        }
        if (!trimmedValue) { // Ensure fact value is not empty
            alert("Fact value cannot be empty.");
            return;
        }

        console.log(`Attempting to add fact '${trimmedKey}' with value '${trimmedValue}' via TBA ${tbaAddress}`);

        try {
            const encodedFactCallData = encodeFactData(trimmedKey, trimmedValue);
            console.log("Inner Encoded Fact Call Data:", encodedFactCallData);

            const executeArgs = [
                HYPERMAP_ADDRESS,       // target: The Hypermap contract address
                0n,                     // value: 0 ETH
                encodedFactCallData,    // data: The encoded hypermap.fact() call
                0                       // operation: 0 for CALL
            ];
            console.log("Executing Fact via TBA with args:", executeArgs);

            writeContract({
                address: tbaAddress,
                abi: mechAbi,
                functionName: 'execute',
                args: executeArgs,
                chainId: BASE_CHAIN_ID,
            });

        } catch (err) {
            console.error("Error preparing fact transaction:", err);
            alert(`Error: ${err.message}`);
        }
    };

    const isDisabled = !tbaAddress || isSending || isConfirming || !isConnected || currentChainId !== BASE_CHAIN_ID || !factKey || factKey.length <= 1 || factKey.includes('.') || factKey.includes(' ') || !factValue.trim();


    return (
        <div style={{ border: '1px solid #d0d0d0', padding: '15px', borderRadius: '6px', backgroundColor: '#ffffff', marginTop:'15px' }}>
          <h4>Add Fact (Immutable)</h4>
          <form onSubmit={handleAddFact}>
             <div style={{ marginBottom: '10px' }}>
              <label htmlFor="factKey" style={{ display: 'block', marginBottom: '5px' }}>Key:</label>
              <input
                id="factKey"
                type="text"
                value={factKey}
                onChange={handleFactKeyChange}
                placeholder="!key (no dots/spaces)"
                required
                style={{width:'100%', padding:'8px', boxSizing:'border-box'}}
                disabled={isSending || isConfirming}
              />
            </div>
             <div style={{ marginBottom: '10px' }}>
              <label htmlFor="factValue" style={{ display: 'block', marginBottom: '5px' }}>Value:</label>
              <input
                id="factValue"
                type="text"
                value={factValue}
                onChange={(e) => setFactValue(e.target.value)}
                placeholder="Value (required)"
                required
                style={{width:'100%', padding:'8px', boxSizing:'border-box'}}
                disabled={isSending || isConfirming}
              />
            </div>
            <button
                type="submit"
                disabled={isDisabled}
                style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer', padding: '10px 15px', backgroundColor: '#0052FF', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {isSending ? 'Sending...' : (isConfirming ? 'Confirming...' : 'Add Fact')}
            </button>
             <p style={{ fontSize: '0.8em', marginTop: '10px', color: '#555' }}>Note: Facts are immutable and cannot be changed once set.</p>
          </form>

           {/* Transaction Status Feedback */}
          <div style={{ marginTop: '15px', fontSize: '0.9em' }}>
             {transactionHash && !isConfirmed && !receiptError && !writeError && (
                 <p style={{ color: '#555', wordBreak: 'break-all' }}>Transaction submitted: {transactionHash}</p>
             )}
             {isConfirming && (
                 <p style={{ color: 'blue' }}>Waiting for blockchain confirmation...</p>
             )}
             {isConfirmed && (
                 <p style={{ color: 'green', fontWeight: 'bold', wordBreak: 'break-all' }}>✅ Fact added! Tx: {transactionHash} (Refresh page to see changes)</p>
             )}
             {(writeError || receiptError) && (
                 <p style={{ color: 'red', fontWeight: 'bold' }}>
                     ❌ Error: {(writeError?.shortMessage ?? receiptError?.shortMessage ?? writeError?.message ?? receiptError?.message ?? 'An unknown error occurred.')}
                 </p>
             )}
          </div>
        </div>
      );
}