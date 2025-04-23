// hypermap-web-explorer/hypermap-explorer/components/NamespaceInfo.js
import { useAccount, useChainId } from 'wagmi';
import { BASE_CHAIN_ID } from '../lib/constants';
import MintSubEntry from './MintSubEntry';
import AddNote from './AddNote'; // <-- IMPORT AddNote
import AddFact from './AddFact'; // <-- IMPORT AddFact


// --- MODIFY Props ---
// Accept data directly from parent instead of just slug
export default function NamespaceInfo({
    owner,          // Owner address string
    tba,            // TBA address string (can be null/undefined)
    fullName,       // Full name string (e.g., "sub.entry.os")
    namehash,       // Namehash string
    label,          // Label string
    isOwner,        // Boolean indicating if connected wallet is owner (calculated in parent)
    slugForDisplay // Pass slug for display if needed, e.g., ['os','entry','sub']
}) {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();

  // --- REMOVE internal state for entryData, isLoadingApi, apiError, internal fullName, isOwner, parentTbaForMinting ---

  const isCorrectChain = currentChainId === BASE_CHAIN_ID;

  // Basic check if required props are present
  if (!fullName || !namehash || !owner) {
      // Or render a more specific error/loading state passed via props if needed
      return <div style={{padding: '20px', color: 'orange'}}>Waiting for entry data...</div>;
  }

  return (
    <div style={{ border: '1px solid #e0e0e0', padding: '20px', marginTop: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      {/* Use slugForDisplay or derive from fullName for display */}
      <h3>Namespace: /{slugForDisplay ? slugForDisplay.join('/') : fullName.split('.').reverse().join('/')}</h3>
      <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px dashed #ccc' }}>
         <p><strong>Full Name:</strong> {fullName}</p>
         <p><strong>Label:</strong> {label}</p>
         <p><strong>Namehash:</strong> <code style={{fontSize: '0.9em', wordBreak: 'break-all'}}>{namehash}</code></p>
         <p><strong>Owner:</strong> <code style={{fontSize: '0.9em', wordBreak: 'break-all'}}>{owner}</code></p>
         {/* Display TBA if available */}
         {tba && <p><strong>TBA:</strong> <code style={{fontSize: '0.9em', wordBreak: 'break-all'}}>{tba}</code></p>}
      </div>

      {/* Ownership Status Display - Uses isOwner prop */}
      <div style={{ marginBottom: '20px' }}>
          {isConnected ? (
              isCorrectChain ? (
                  isOwner ? (
                      <p style={{ color: 'green', fontWeight: 'bold', border: '1px solid green', padding: '8px', borderRadius: '4px', backgroundColor: '#e8f5e9' }}>✅ You are the owner of this namespace entry.</p>
                  ) : (
                      <p style={{ color: 'darkorange', fontWeight: 'bold', border: '1px solid orange', padding: '8px', borderRadius: '4px', backgroundColor: '#fff3e0' }}>⚠️ You are connected, but do not own this entry.</p>
                  )
              ) : (
                  <p style={{ color: 'red', fontWeight: 'bold', border: '1px solid red', padding: '8px', borderRadius: '4px', backgroundColor: '#ffebee' }}>❌ Please switch your wallet to the Base network to interact.</p>
              )
          ) : (
              <p style={{ color: '#555', border: '1px solid #ccc', padding: '8px', borderRadius: '4px', backgroundColor: '#eee' }}>🔌 Connect your wallet (top right) to check ownership and enable owner actions.</p>
          )}
      </div>

      {/* --- MODIFY Owner Actions Container --- */}
      {/* Render Actions ONLY IF owner, connected, on correct chain, and TBA address is available */}
      {isOwner && isConnected && isCorrectChain && tba && (
         <div style={{ borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h4>Owner Actions</h4>

            {/* Existing Mint component */}
            <MintSubEntry
               parentNamespace={fullName} // Pass the full name
               parentTbaAddress={tba}     // Pass the entry's TBA address
            />

            {/* --- ADD Note Component --- */}
            <AddNote
               tbaAddress={tba}         // Pass the entry's TBA address
               entryName={fullName}     // Pass the full name for tx description
            />

            {/* --- ADD Fact Component --- */}
            <AddFact
                tbaAddress={tba}        // Pass the entry's TBA address
                entryName={fullName}    // Pass the full name for tx description
            />
         </div>
      )}
      {/* Optional: Message if owner conditions met but TBA is missing */}
      {isOwner && isConnected && isCorrectChain && !tba && (
          <p style={{ color: 'orange', marginTop: '10px' }}>Owner actions require a deployed TBA (Token Bound Account), which was not found for this entry.</p>
      )}
    </div>
  );
}