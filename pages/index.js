// pages/index.js
import Head from 'next/head';
import Link from 'next/link'; // Import Link for navigation

export default function Home() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px', lineHeight: '1.6' }}>
      <Head>
        <title>Hypermap Explorer</title>
        <meta name="description" content="Explore the Hypermap Namespace" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>Welcome to the Hypermap Explorer</h1>
        <p>This tool allows you to browse the Hypermap namespace deployed on the Base network.</p>
        <p>Try navigating to a known path, for example:</p>
        <ul>
          {/* Add examples of valid paths */}
          <li><Link href="/os">/os</Link></li>
          <li><Link href="/hypr">/hypr</Link></li>
          {/* Add more examples if known */}
        </ul>
         <p>The structure is `/[label]/[sublabel]/[subsublabel]...` corresponding to `subsublabel.sublabel.label` in the namespace.</p>
      </main>
    </div>
  );
}