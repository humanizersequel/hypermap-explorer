// hypermap-web-explorer/hypermap-explorer/pages/index.js
import Head from 'next/head';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit'; // <-- Import the button component
import { FaMagnifyingGlass, FaX } from 'react-icons/fa6';
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const onSearch = (e) => {
    if (search) {
      router.push(`/${search.replace(/^\/|\/$/g, '')}`); // Remove leading and trailing slashes
    }
  }
  return (
    // Added a max-width and centering for better layout
    <div className="font-sans p-4 leading-6 max-w-4xl mx-auto flex flex-col gap-8">
      <Head>
        <title>Hypermap Explorer</title>
        <meta name="description" content="Explore the Hypermap Namespace on Base" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header section */}
      <header
        className="flex justify-between items-center pb-8 border-b"
      >
        <h1 className="text-2xl font-bold">Hypermap Explorer</h1>
        {/* Render the RainbowKit Connect Button */}
        <ConnectButton
          showBalance={false} // Don't show ETH balance in the button
          accountStatus="address" // Show only the address when connected
          chainStatus="icon" // Show only the network icon
        />
      </header>

      <main className="flex flex-col gap-4">
        <p>Welcome! This tool allows you to browse the Hypermap namespace deployed on the Base network.</p>
        <p>Connect your wallet (top right) to check ownership of entries and mint new sub-entries if you are the owner.</p>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="search/a/namespace/path"
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSearch();
              }
            }}
            className="text-xl flex-1 bg-black/10 dark:bg-white/10 rounded-md p-2 border border-black/50 dark:border-white/50"
          />
          <button
            className="thin clear self-stretch"
            onClick={onSearch}
          >
            <FaMagnifyingGlass />
          </button>
          {search && <button className="thin clear self-stretch"
            onClick={() => setSearch('')}
          >
            <FaX />
          </button>}
        </div>
        <p>Try navigating to a known path using the URL, for example:</p>
        <ul>
          {/* Use descriptive link text */}
          <li><Link href="/os">Explore /os</Link></li>
          <li><Link href="/hypr">Explore /hypr</Link></li>
          {/* Add more examples if known */}
        </ul>
        <p>The URL path structure `/[label]/[sublabel]/...` corresponds to the Hypermap name `sublabel.label`.</p>
      </main>

      <footer className="mt-4 pt-2 border-t">
        Connected to Base Network via Hypermap Explorer
      </footer>
    </div>
  );
}