// FILE: hypermap-explorer/components/AddNote.js
import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import {
    mechAbi, // Use the exported mechAbi for the TBA's execute function
    HYPERMAP_ADDRESS,
    encodeNoteData,
    BASE_CHAIN_ID // Import Base chain ID for checks
} from '../lib/constants';

export default function AddNote({ tbaAddress, entryName }) {
    const [noteKey, setNoteKey] = useState('~');
    const [noteValue, setNoteValue] = useState('');
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
            addRecentTransaction({ hash: transactionHash, description: `Added note ${noteKey} to ${entryName}` });
            // Clear inputs on success? Optional.
            // setNoteKey('~');
            // setNoteValue('');
        }
    }, [isConfirmed, transactionHash, addRecentTransaction, noteKey, entryName]);


    const handleNoteKeyChange = (e) => {
        const value = e.target.value;
        if (!value) {
            setNoteKey('~'); // Reset to default if cleared
        } else if (!value.startsWith('~')) {
            setNoteKey('~' + value.replace(/ /g, '-')); // Replace spaces or disallow
        } else {
            setNoteKey(value.replace(/ /g, '-'));
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();

        const trimmedKey = noteKey.trim();
        if (!isConnected || !connectedAddress || currentChainId !== BASE_CHAIN_ID) {
            alert('Please connect your wallet to the Base network.');
            openConnectModal?.();
            return;
        }
        if (!tbaAddress) {
            alert("Target TBA address is missing.");
            console.error("AddNote called without tbaAddress.");
            return;
        }
        if (!trimmedKey || trimmedKey.length <= 1 || trimmedKey.includes('.') || trimmedKey.includes(' ')) {
            alert("Please provide a valid note key starting with ~ (no dots or spaces).");
            return;
        }

        console.log(`Attempting to add note '${trimmedKey}' with value '${noteValue}' via TBA ${tbaAddress}`);

        try {
            const encodedNoteCallData = encodeNoteData(trimmedKey, noteValue);
            console.log("Inner Encoded Note Call Data:", encodedNoteCallData);

            const executeArgs = [
                HYPERMAP_ADDRESS,       // target: The Hypermap contract address
                0n,                     // value: 0 ETH
                encodedNoteCallData,    // data: The encoded hypermap.note() call
                0                       // operation: 0 for CALL
            ];
            console.log("Executing Note via TBA with args:", executeArgs);

            writeContract({
                address: tbaAddress,
                abi: mechAbi,
                functionName: 'execute',
                args: executeArgs,
                chainId: BASE_CHAIN_ID,
            });

        } catch (err) {
            console.error("Error preparing note transaction:", err);
            alert(`Error: ${err.message}`);
        }
    };

    const isDisabled = !tbaAddress || isSending || isConfirming || !isConnected || currentChainId !== BASE_CHAIN_ID || !noteKey || noteKey.length <= 1 || noteKey.includes('.') || noteKey.includes(' ');

    return (
        <div style={{ border: '1px solid #d0d0d0', padding: '15px', borderRadius: '6px', backgroundColor: '#ffffff', marginTop:'15px' }}>
          <h4>Add/Update Note</h4>
          <form onSubmit={handleAddNote}>
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="noteKey" style={{ display: 'block', marginBottom: '5px' }}>Key:</label>
              <input
                id="noteKey"
                type="text"
                value={noteKey}
                onChange={handleNoteKeyChange}
                placeholder="~key (no dots/spaces)"
                required
                style={{width:'100%', padding:'8px', boxSizing:'border-box'}}
                disabled={isSending || isConfirming}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="noteValue" style={{ display: 'block', marginBottom: '5px' }}>Value:</label>
              <input
                id="noteValue"
                type="text"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Value"
                style={{width:'100%', padding:'8px', boxSizing:'border-box'}}
                disabled={isSending || isConfirming}
              />
            </div>
            <button
                type="submit"
                disabled={isDisabled}
                style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer', padding: '10px 15px', backgroundColor: '#0052FF', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {isSending ? 'Sending...' : (isConfirming ? 'Confirming...' : 'Add/Update Note')}
            </button>
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
                 <p style={{ color: 'green', fontWeight: 'bold', wordBreak: 'break-all' }}>✅ Note added/updated! Tx: {transactionHash} (Refresh page to see changes)</p>
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