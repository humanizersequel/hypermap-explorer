
// hypermap-web-explorer/hypermap-explorer/pages/[...slug].js
import { FaChevronLeft, FaChevronRight, FaCircleNotch, FaX } from 'react-icons/fa6';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Copier from '../components/Copier';
// Import our custom NamespaceInfo component
import NamespaceInfo from '../components/NamespaceInfo';

// Helper component to render notes/facts section
function RenderNotesOrFacts({ title, items }) {
  if (!items || Object.keys(items).length === 0) {
    return (
      <>
        <h2>{title}</h2>
        <p className="text-sm opacity-50">None</p>
      </>
    );
  }
  const length = useMemo(() => Object.keys(items).length, [items]);
  return (
    <>
      <h2>{title}</h2>
      <div className={classNames("grid gap-4", {
        "grid-cols-2": length < 3,
        "grid-cols-2 xl:grid-cols-4": length >= 4 && length % 2 === 0,
        "grid-cols-3 xl:grid-cols-6": length >= 3 && length % 3 === 0,
        [`length-${length}`]: true,
      })}>
        {Object.entries(items).map(([label, history]) => (
          <div
            key={label}
            className="border border-black/50 dark:border-white/50 rounded-md p-4 bg-black/10 dark:bg-white/10 flex flex-col gap-2"
          >
            <strong>{label}:</strong>
            {/* Display only the most recent entry (index 0 due to DB sorting) */}
            {history.length > 0 && (
              <div className="text-sm flex flex-wrap gap-2 items-center">
                {/* Display interpreted data if available, otherwise show raw */}
                <span>Data: </span>
                <code>
                  {history[0].data !== null ? String(history[0].data) : history[0].rawData}
                </code>
                <Copier text={history[0].data} />
                <br />
                {history[0].rawData !== null && <div className="flex flex-wrap gap-2 items-center">
                  <span>Raw:</span>
                  <code>{history[0].rawData}</code>
                  <Copier text={history[0].rawData} />
                </div>}
                <br />
                <small className="flex flex-wrap gap-2 items-center">
                  (Block: {history[0].blockNumber} | Tx: <code className="font-mono">{history[0].txHash?.substring(0, 10)}...</code> | Log Idx: {history[0].logIndex}) <Copier text={history[0].txHash} />
                </small>
                {/* Consider adding a button here later to show full history if needed */}
              </div>
            )}
          </div>
        ))}
      </div>
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
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const onSearch = (term) => {
    if (!entryData) return;
    if (term) {
      setFilter(term);
    } else {
      setFilter('');
    }
    setCurrentPage(1);
  }

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
            onSearch();
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
      <div
        className="p-4 leading-6 max-w-4xl mx-auto"
      >
        <header className="flex justify-between items-center mb-4 pb-2 border-b">
          <Link href="/">Back to Home</Link>
          <ConnectButton />
        </header>
        <p>Invalid Hypermap path.</p>
      </div>
    );
  }

  const path = slug.join('/'); // Reconstruct the display path e.g., "nick/hypr"

  return (
    <div className="font-sans p-4 leading-6 max-w-4xl mx-auto flex flex-col gap-4">
      <Head>
        <title>Hypermap: /{path}</title>
        <meta name="description" content={`Exploring the Hypermap namespace entry /${path} on Base`} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className="flex justify-between items-center mb-4 pb-2 border-b">
        <Link href="/">← Back to Home</Link>
        <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
      </header>

      <main className="flex flex-col gap-4">
        <NamespaceInfo slug={slug} />

        {loading && (
          <div className="mt-4 flex gap-4 items-center">
            <FaCircleNotch className="animate-spin" />
            <p>Loading entry details...</p>
          </div>
        )}

        {error && (
          <div className="mt-4 text-red-500">
            <p>Error loading entry details: {error}</p>
          </div>
        )}

        {entryData && !loading && !error && (
          <div className="gap-4 flex flex-col">
            <RenderNotesOrFacts title="Notes" items={entryData.notes} />
            <RenderNotesOrFacts title="Facts" items={entryData.facts} />

            <div className="grid lg:grid-cols-3 gap-4 items-center">
              <h2 className="flex-1">Children</h2>
              {entryData?.children?.length > 10 && <>
                <div className="flex justify-center gap-4 flex-1">
                  <button
                    className="thin clear"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <FaChevronLeft />
                  </button>
                  <span>{currentPage * 10 - 9} to {Math.min(currentPage * 10, entryData.children.length)} of {entryData.children.length}</span>
                  <button
                    className="thin clear"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage * 10 >= entryData.children.length}
                  >
                    <FaChevronRight />
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={filter}
                    onChange={(e) => onSearch(e.target.value)}
                    className=" bg-black/10 dark:bg-white/10 rounded-md p-2 border border-black/50 dark:border-white/50"
                  />
                  {filter && <button
                    className="thin clear self-stretch"
                    onClick={() => onSearch('')}
                  >
                    <FaX />
                  </button>}
                </div>
              </>}
            </div>
            {entryData.children && entryData.children.length > 0 ? <>
              <ul className="list-none pl-4">
                {entryData.children
                  .filter(child => filter ? child.label?.toLowerCase().includes(filter?.toLowerCase()) : true)
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map(child => {
                    // Construct the URL path from the child's full name
                    const childUrlPath = child.fullName ? child.fullName.split('.').reverse().join('/') : null;
                    return (
                      <li key={child.namehash} className="mx-2">
                        {childUrlPath ? (
                          <Link href={`/${childUrlPath}`}>
                            {child.label || child.namehash.substring(0, 10)}
                          </Link>
                        ) : (
                          // If child full name missing (shouldn't happen often with filtering), just show label/hash
                          <span>{child.label || child.namehash.substring(0, 10)}</span>
                        )}
                        {' '}
                        (<code >{child.namehash}</code>)
                      </li>
                    );
                  })}
              </ul>
            </> : (
              <p className="text-sm opacity-50">None</p>
            )}
          </div>
        )}
      </main>

      <footer className="pt-4 border-t">
        Hypermap Explorer on Base
      </footer>
    </div>
  );
}