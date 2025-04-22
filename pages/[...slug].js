// hypermap-web-explorer/hypermap-explorer/pages/[...slug].js
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
// Import our custom NamespaceInfo component
import NamespaceInfo from '../components/NamespaceInfo';

// Helper component to render notes/facts section
function RenderNotesOrFacts({ title, items }) {
    if (!items || Object.keys(items).length === 0) {
        return (
            <>
                <h2>{title}</h2>
                <p>None</p>
            </>
        );
    }
    return (
        <>
            <h2>{title}</h2>
            <ul style={{ listStyle: 'none', paddingLeft: '0' }}>
                {Object.entries(items).map(([label, history]) => (
                    <li key={label} style={{ marginBottom: '15px', borderLeft: '3px solid #eee', paddingLeft: '15px' }}>
                        <strong>{label}:</strong>
                        {/* Display only the most recent entry (index 0 due to DB sorting) */}
                        {history.length > 0 && (
                            <div style={{ marginLeft: '10px', fontSize: '0.9em', color: '#333', marginTop: '5px' }}>
                                {/* Display interpreted data if available, otherwise show raw */}
                                <span>Data: </span>
                                <code style={{ background: '#eee', padding: '2px 4px', borderRadius: '3px', display: 'inline-block', maxWidth:'100%', overflowWrap:'break-word' }}>
                                    {history[0].data !== null ? String(history[0].data) : `(Raw: ${history[0].rawData})`}
                                </code>
                                <br/>
                                {/* Optionally always show raw data too */}
                                {history[0].data !== null && (
                                     <span style={{fontSize: '0.8em', color: '#666'}}>Raw: <code style={{ background: '#eee', padding: '1px 3px', borderRadius: '3px', wordBreak: 'break-all' }}>{history[0].rawData}</code></span>
                                )}
                                <br/>
                                <small style={{ color: '#777' }}>
                                    (Block: {history[0].blockNumber} | Tx: <code style={{fontSize:'0.9em'}}>{history[0].txHash?.substring(0,10)}...</code> | Log Idx: {history[0].logIndex})
                                </small>
                                {/* Consider adding a button here later to show full history if needed */}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </>
    );
}


// Main Page Component
export default function EntryPage() {
  const router = useRouter();
  // 'slug' from router.query will be an array of path segments, or undefined initially
  const { slug } = router.query;

  // State for the fetched data, loading status, and errors
  const [entryData, setEntryData] = useState(null);
  const [loading, setLoading] = useState(true); // Start loading initially
  const [error, setError] = useState(null);
  const [apiPath, setApiPath] = useState(''); // For display

  // useEffect runs client-side after component mounts and when dependencies change
  useEffect(() => {
    // Only run fetch if the router has hydrated and slug is available and is an array
    if (router.isReady && slug && Array.isArray(slug)) {
      const pathStringForApi = slug.join('/'); // Path for API call e.g., "os/username/entry"
      setApiPath(pathStringForApi); // Update display path

      setLoading(true);
      setError(null);
      setEntryData(null); // Clear previous data

      console.log(`useEffect: Fetching data for API path: /api/entry/by-name/${pathStringForApi}`);

      // Make the fetch request to our *internal* API route
      fetch(`/api/entry/by-name/${pathStringForApi}`)
        .then(async (res) => {
          // Check if the response status code indicates success (e.g., 200 OK)
          if (!res.ok) {
            let errorMsg = `HTTP error! Status: ${res.status}`;
            try {
              // Try to get more specific error from API response body
              const errorData = await res.json();
              errorMsg = errorData.error || errorMsg;
            } catch (parseError) {
              // Ignore if response body isn't valid JSON
            }
            // Throw an error to be caught by the .catch block
            throw new Error(errorMsg);
          }
          // If response is OK, parse the JSON body
          return res.json();
        })
        .then((data) => {
          // API returns { "hash": { ...details... } }
          // Extract the details object (there should only be one key)
          const entryHash = Object.keys(data)[0];
          if (entryHash && data[entryHash]) {
            console.log("useEffect: Data fetched successfully:", data[entryHash]);
            setEntryData(data[entryHash]); // Update state with the fetched data
          } else {
            // This indicates an unexpected response format from the API
            throw new Error("Received unexpected data format from API.");
          }
           // Data loaded successfully, stop loading indicator
           setLoading(false);
        })
        .catch((err) => {
          // Handle any errors during fetch or processing
          console.error("useEffect: Fetch error:", err);
          setError(err.message); // Set error state to display message
          setLoading(false); // Stop loading indicator
        });
    } else if (router.isReady && !slug) {
        // Handle cases where router is ready but slug is missing (e.g., maybe root path, handle differently if needed)
        setLoading(false);
        setError("Invalid or missing path.");
    }
     // If router is not ready yet, do nothing and wait for it to hydrate

  }, [slug, router.isReady]); // Dependency array: re-run effect if slug or router readiness changes

  // Basic loading state while router is not ready or slug is missing
  if (!router.isReady) {
    return <div style={{ padding: '20px' }}>Loading page data...</div>;
  }

  // Handle case where slug might be ready but invalid (e.g., non-array - though unlikely with [...slug].js)
  if (!Array.isArray(slug) || slug.length === 0) {
       // You could redirect or show a specific message for root/invalid paths if needed
       // For now, just indicate it's not a valid entry path based on slug.
       return (
           <div style={{ fontFamily: 'sans-serif', padding: '20px', lineHeight: '1.6', maxWidth: '960px', margin: '0 auto' }}>
               <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
                   <Link href="/">Back to Home</Link>
                   <ConnectButton />
               </header>
               <p>Invalid Hypermap path.</p>
           </div>
       );
   }

  const path = slug.join('/'); // Reconstruct the display path e.g., "nick/hypr"

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', lineHeight: '1.6', maxWidth: '960px', margin: '0 auto' }}>
      <Head>
        <title>Hypermap: /{path}</title>
        <meta name="description" content={`Exploring the Hypermap namespace entry /${path} on Base`} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
         <Link href="/">← Back to Home</Link>
         <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon"/>
      </header>

      <main>
        {/* Pass the validated slug array to the NamespaceInfo component */}
        <NamespaceInfo slug={slug} />

        {/* Display the original entry details including notes, facts, and children */}
        {loading && (
          <div style={{ marginTop: '30px' }}>
            <p>Loading entry details...</p>
          </div>
        )}

        {error && (
          <div style={{ marginTop: '30px', color: 'red' }}>
            <p>Error loading entry details: {error}</p>
          </div>
        )}

        {entryData && !loading && !error && (
          <div style={{ marginTop: '30px' }}>
            {/* Notes and Facts */}
            <RenderNotesOrFacts title="Notes" items={entryData.notes} />
            <RenderNotesOrFacts title="Facts" items={entryData.facts} />

            {/* Display Children */}
            <h2>Children</h2>
            {entryData.children && entryData.children.length > 0 ? (
              <ul style={{ listStyle: 'none', paddingLeft: '10px' }}>
                {entryData.children.map(child => {
                    // Construct the URL path from the child's full name
                    const childUrlPath = child.fullName ? child.fullName.split('.').reverse().join('/') : null;
                    return (
                        <li key={child.namehash} style={{ margin: '5px 0' }}>
                            {childUrlPath ? (
                                <Link href={`/${childUrlPath}`}>
                                    {/* Display child label, fallback to truncated hash */}
                                    {child.label || child.namehash.substring(0, 10)}
                                </Link>
                            ) : (
                                // If child full name missing (shouldn't happen often with filtering), just show label/hash
                                <span>{child.label || child.namehash.substring(0, 10)}</span>
                            )}
                            {' '} {/* Space */}
                            (<code style={{fontSize:'0.8em', color:'#555'}}>{child.namehash}</code>)
                        </li>
                    );
                })}
              </ul>
            ) : (
              <p>None</p>
            )}
          </div>
        )}
      </main>

       <footer style={{marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #ddd', fontSize: '0.9em', color: '#777', textAlign: 'center'}}>
         Hypermap Explorer on Base
       </footer>
    </div>
  );
}