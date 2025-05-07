// hypermap-web-explorer/hypermap-explorer/components/NamespaceInfo.js
import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi'; // Only need useAccount and useChainId from wagmi here
import { BASE_CHAIN_ID } from '../lib/constants';
// Import components
import MintSubEntry from './MintSubEntry';
import AddNote from './AddNote'; // <-- IMPORT AddNote
import AddFact from './AddFact'; // <-- IMPORT AddFact

// This component expects the 'slug' array from the URL, e.g., ['nick', 'hypr']
// reviewers note: the url paths are "backwards" to how they are referenced in the protocol. Nick.hypr will live at the slash hypr slash nick path
export default function NamespaceInfo({ slug }) {
  const { address: connectedAddress, isConnected } = useAccount(); // Get wallet connection status
  const currentChainId = useChainId(); // Get the currently connected chain ID

  // State variables for this component
  const [entryData, setEntryData] = useState(null); // Holds data fetched from API
  const [isLoadingApi, setIsLoadingApi] = useState(false); // Tracks API loading state
  const [apiError, setApiError] = useState(null); // Stores any API error message
  const [isOwner, setIsOwner] = useState(false); // Tracks if connected wallet is the owner
  const [fullName, setFullName] = useState(''); // Stores the reconstructed full name (e.g., "nick.hypr")
  // --- ADD State for Parent TBA Address ---
  const [parentTbaForMinting, setParentTbaForMinting] = useState(null);
  // --- END ADD ---

  // Effect Hook: Fetch data from the backend API when the slug changes
  useEffect(() => {
    // Only run if slug is a valid array with content
    if (slug && Array.isArray(slug) && slug.length > 0) {
      // Note: We previously calculated fullName here as slug.join('.')
      // but now we get the correct fullName directly from the API response
      // Instead, we'll just set a temporary display value until API responds
      setFullName(''); // Will be set from API response after fetch
      // --- ADD Reset for Parent TBA ---
      setParentTbaForMinting(null);
      // --- END ADD ---

      // Define the async function to fetch data
      const fetchEntryData = async () => {
        setIsLoadingApi(true); // Set loading state
        setApiError(null); // Clear previous errors
        setEntryData(null); // Reset data for new slug
        setIsOwner(false); // Reset ownership status
        // --- ADD Reset for Parent TBA on fetch ---
        setParentTbaForMinting(null);
        // --- END ADD ---

        console.log(`Fetching API: /api/entry/by-name/${slug.join('/')}`);

        try {
          // Call the backend API endpoint
          const response = await fetch(`/api/entry/by-name/${slug.join('/')}`);

          // Check if the API call was successful
          if (!response.ok) {
            let errorMsg = `API Error: ${response.status} ${response.statusText}`;
            try { // Try to parse specific error from API response body
              const errorData = await response.json();
              errorMsg = errorData.error || errorMsg;
            } catch (e) { /* Ignore parsing error */ }
            throw new Error(errorMsg);
          }

          // Parse the JSON response
          const data = await response.json();

          // --- Process API Response ---
          // The API returns data keyed by the entry's namehash
          const namehash = Object.keys(data)[0];
          if (!namehash || !data[namehash]) {
            throw new Error("Invalid API response format received.");
          }
          const fetchedEntry = data[namehash];
          console.log("API Data Received:", fetchedEntry);
          setEntryData(fetchedEntry); // Store the fetched entry data in state

          // --- CORRECTED fullName SETTING ---
          // Use the fullName directly from the API response
          if (fetchedEntry.fullName) {
            setFullName(fetchedEntry.fullName); // Set state from API data
            console.log('Set fullName state from API:', fetchedEntry.fullName);
          } else {
            // Fallback or error if API didn't provide fullName
            console.warn("API response missing fullName field.");
            setFullName(''); // Clear or handle as appropriate
          }
          // --- END CORRECTION ---

          // --- ADD Logic to extract and store Parent TBA Address ---
          // This assumes your API response for the current entry (the parent)
          // now includes a 'tba' field as per your update.
          if (fetchedEntry.tba) {
            setParentTbaForMinting(fetchedEntry.tba);
            console.log('Set parentTbaForMinting state from API:', fetchedEntry.tba);
          } else {
            console.warn("API response missing tba field. Minting will be disabled.");
            // Keep parentTbaForMinting as null
          }
          // --- END ADD ---

          // ** Ownership Check (Simplified) **
          // Compare owner from API with connected address directly here
          if (isConnected && connectedAddress && fetchedEntry.owner) {
            const ownerFromApi = fetchedEntry.owner;
            const isMatch = ownerFromApi?.toLowerCase() === connectedAddress?.toLowerCase();
            setIsOwner(isMatch);
            console.log(`Ownership check: API Owner=${ownerFromApi}, Connected=${connectedAddress}, Match=${isMatch}`);
          } else {
            setIsOwner(false); // Not connected or missing data
          }
          // --- End Processing ---

        } catch (error) {
          console.error("API Fetch Error:", error);
          setApiError(error.message); // Store error message
          setIsOwner(false); // Ensure ownership is false on error
          // --- ADD Reset for Parent TBA on error ---
          setParentTbaForMinting(null);
          // --- END ADD ---
        } finally {
          setIsLoadingApi(false); // Clear loading state regardless of outcome
        }
      };

      fetchEntryData(); // Execute the fetch function
    } else {
      // Handle cases with invalid slug input
      setEntryData(null);
      setApiError('Invalid namespace path provided in URL.');
      setFullName('');
      setIsOwner(false);
      // --- ADD Reset for Parent TBA on invalid slug ---
      setParentTbaForMinting(null);
      // --- END ADD ---
    }
    // This effect depends on the 'slug' and connection status/address
  }, [slug, isConnected, connectedAddress]); // Re-run when slug or connection state changes


  // --- Render Logic ---
  // Handle loading and error states first
  if (!slug || slug.length === 0) return <div style={{ padding: '20px', color: '#555' }}>Enter a valid Hypermap path in the URL (e.g., /nick/hypr).</div>;
  if (isLoadingApi) return <div style={{ padding: '20px' }}>Loading entry data for &apos;{fullName}&apos;...</div>;
  if (apiError) return <div style={{ padding: '20px', color: 'red' }}>Error loading data: {apiError}</div>;
  // Handle case where API call finished but found no data (404 was likely handled by API, but check state too)
  if (!entryData) return <div style={{ padding: '20px' }}>Namespace &apos;{fullName}&apos; not found.</div>;

  // If data is loaded, extract details for display
  const { namehash, owner, label } = entryData;

  // Check if the user is on the correct network (Base)
  const isCorrectChain = currentChainId === BASE_CHAIN_ID;

  return (
    // Use a more descriptive wrapper or styling as needed
    <div
      className="border border-gray-300 rounded-md p-4 mt-4"
    >
      <h3>Namespace: /{slug.join('/')}</h3>
      <div
        className="mb-4 pb-4 border-b border-dashed border-gray-300"
      >
        <p><strong>Full Name:</strong> {fullName}</p>
        <p><strong>Label:</strong> {label}</p>
        <p><strong>Namehash:</strong> <code className="text-sm break-all">{namehash}</code></p>
        <p><strong>Owner:</strong> <code className="text-sm break-all">{owner}</code></p>
        {/* Removed TBA Address display as it's out of scope */}
      </div>

      {/* Ownership Status Display - Clearer messages */}
      <div>
        {isConnected ? (
          isCorrectChain ? (
            isOwner ? (
              <p
                className="text-green-500 font-bold border border-green-500 rounded-md p-2 bg-green-500/10"
              >✅ You are the owner of this namespace entry.</p>
            ) : (
              <p className="text-orange-500 font-bold border border-orange-500 rounded-md p-2 bg-orange-500/10">⚠️ You are connected, but do not own this entry.</p>
            )
          ) : (
            // Connected but on wrong chain
            <p className="text-red-500 font-bold border border-red-500 rounded-md p-2 bg-red-500/10">❌ Please switch your wallet to the Base network to interact.</p>
          )
        ) : (
          // Not connected
          <p className="text-gray-500 border border-gray-500 rounded-md p-4 bg-gray-500/10">🔌 Connect your wallet (top right) to check ownership and enable owner actions.</p>
        )}
      </div>


      {/* Action Components Container - Render Mint ONLY IF owner, connected, on correct chain, and parent TBA available */}
      {isOwner && isConnected && isCorrectChain && parentTbaForMinting && (
        <div className="border-t border-gray-300 pt-4">
          <h4>Owner Actions</h4>
          {/* Render the Mint component, passing necessary props */}
          <MintSubEntry
            parentNamespace={fullName} // Pass the full name (e.g., "nick.hypr")
            parentTbaAddress={parentTbaForMinting} // Pass the parent's TBA address
          />

          {/* --- ADD Note Component --- */}
          <AddNote
            tbaAddress={parentTbaForMinting} // Pass the entry's TBA address
            entryName={fullName} // Pass the full name for tx description
          />

          {/* --- ADD Fact Component --- */}
          <AddFact
            tbaAddress={parentTbaForMinting} // Pass the entry's TBA address
            entryName={fullName} // Pass the full name for tx description
          />
        </div>
      )}
      {/* Optional: Add a message if owner but parentTba is missing */}
      {isOwner && isConnected && isCorrectChain && !parentTbaForMinting && !isLoadingApi && (
        <p className="text-orange-500 mt-2">Parent TBA address not found, minting disabled.</p>
      )}
    </div>
  );
}