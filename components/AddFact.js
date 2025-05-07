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
        <div
            className="border border-gray-300 rounded-md p-4 mt-4"
        >
            <h4>Add Fact (Immutable)</h4>
            <form onSubmit={handleAddFact}>
                <div className="mb-2">
                    <label htmlFor="factKey" className="block mb-1">Key:</label>
                    <input
                        id="factKey"
                        type="text"
                        value={factKey}
                        onChange={handleFactKeyChange}
                        placeholder="!key (no dots/spaces)"
                        required
                        className="w-full p-2"
                        disabled={isSending || isConfirming}
                    />
                </div>
                <div className="mb-2">
                    <label htmlFor="factValue" className="block mb-1">Value:</label>
                    <input
                        id="factValue"
                        type="text"
                        value={factValue}
                        onChange={(e) => setFactValue(e.target.value)}
                        placeholder="Value (required)"
                        required
                        className="w-full p-2"
                        disabled={isSending || isConfirming}
                    />
                </div>
                <button
                    type="submit"
                    disabled={isDisabled}
                    className="opacity-50 cursor-not-allowed p-2 rounded-md bg-blue-500 text-white border-none"
                >
                    {isSending ? 'Sending...' : (isConfirming ? 'Confirming...' : 'Add Fact')}
                </button>
                <p className="text-sm mt-2 text-gray-700">Note: Facts are immutable and cannot be changed once set.</p>
            </form>

            {/* Transaction Status Feedback */}
            <div className="mt-2 text-sm">
                {transactionHash && !isConfirmed && !receiptError && !writeError && (
                    <p
                        className="text-gray-700 break-all"
                    >Transaction submitted: {transactionHash}</p>
                )}
                {isConfirming && (
                    <p className="text-blue-500">Waiting for blockchain confirmation...</p>
                )}
                {isConfirmed && (
                    <p className="text-green-500 font-bold break-all">✅ Fact added! Tx: {transactionHash} (Refresh page to see changes)</p>
                )}
                {(writeError || receiptError) && (
                    <p className="text-red-500 font-bold">
                        ❌ Error: {(writeError?.shortMessage ?? receiptError?.shortMessage ?? writeError?.message ?? receiptError?.message ?? 'An unknown error occurred.')}
                    </p>
                )}
            </div>
        </div>
    );
}