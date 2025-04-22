// hypermap-web-explorer/hypermap-explorer/pages/index.js
import Head from 'next/head';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit'; // <-- Import the button component

export default function Home() {
  return (
    // Added a max-width and centering for better layout
    <div style={{ fontFamily: 'sans-serif', padding: '20px', lineHeight: '1.6', maxWidth: '960px', margin: '0 auto' }}>
      <Head>
        <title>Hypermap Explorer</title>
        <meta name="description" content="Explore the Hypermap Namespace on Base" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header section */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
        <h1 style={{ margin: 0 }}>Hypermap Explorer</h1>
        {/* Render the RainbowKit Connect Button */}
        <ConnectButton
          showBalance={false} // Don't show ETH balance in the button
          accountStatus="address" // Show only the address when connected
          chainStatus="icon" // Show only the network icon
        />
      </header>

      <main>
        <p>Welcome! This tool allows you to browse the Hypermap namespace deployed on the Base network.</p>
        <p>Connect your wallet (top right) to check ownership of entries and mint new sub-entries if you are the owner.</p>
        <p>Try navigating to a known path using the URL, for example:</p>
        <ul>
          {/* Use descriptive link text */}
          <li><Link href="/os">Explore /os</Link></li>
          <li><Link href="/hypr">Explore /hypr</Link></li>
          {/* Add more examples if known */}
        </ul>
         <p>The URL path structure `/[label]/[sublabel]/...` corresponds to the Hypermap name `sublabel.label`.</p>
      </main>

      <footer style={{marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #ddd', fontSize: '0.9em', color: '#777', textAlign: 'center'}}>
          Connected to Base Network via Hypermap Explorer
      </footer>
    </div>
  );
}