// hypermap-web-explorer/hypermap-explorer/pages/_app.js
import '@/styles/globals.css'; // Keep existing global styles
import '@rainbow-me/rainbowkit/styles.css'; // Add RainbowKit's base styles

import { getDefaultConfig, RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains'; // Import the Base chain configuration
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { http } from 'viem'; // Import http transport for custom RPC

import localFont from 'next/font/local';

const clash = localFont({
  src: './../public/ClashDisplay-Variable.woff2',
});

const chaney = localFont({
  src: './../public/chaneyextended.woff2',
});

// --- Environment Variable Retrieval ---
// Fetch keys from process.env - NEXT_PUBLIC_ prefix is crucial here!
const infuraApiKey = process.env.NEXT_PUBLIC_INFURA_API_KEY;
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// --- Basic Validation (Optional but good practice) ---
if (!infuraApiKey) {
  console.warn("Startup Warning: NEXT_PUBLIC_INFURA_API_KEY environment variable is missing. Falling back to public RPC (not recommended for production).");
}
if (!walletConnectProjectId) {
  // WalletConnect might partially work without it, but show a clear warning.
  console.error("Configuration Error: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID environment variable is not set. Wallet connections may fail or be unreliable.");
  // Consider throwing an error in production builds if this is absolutely required:
  // if (process.env.NODE_ENV === 'production') {
  //   throw new Error("Missing critical environment variable: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
  // }
}
// --- End Validation ---


// 1. Configure Wagmi & RainbowKit
//    This object holds the core configuration for blockchain interaction.
const config = getDefaultConfig({
  appName: 'Hypermap Explorer', // Displayed in wallet connection prompts
  projectId: walletConnectProjectId || 'MISSING_PROJECT_ID', // Use variable, provide non-functional fallback
  chains: [base], // Define supported chains - only Base (ID 8453) for now
  // --- Define Network Transport ---
  // This tells Wagmi how to communicate with the Base network.
  transports: {
    [base.id]: http( // Use the 'http' transport
      // Construct the Infura RPC URL. Use public RPC as a fallback if key is missing.
      infuraApiKey
        ? `https://base-mainnet.infura.io/v3/${infuraApiKey}`
        : 'https://mainnet.base.org' // Public fallback - rate limits apply!
    ),
  },
  // --- End Transport ---
  // Optional: WalletConnect specific options can go here if needed
  // walletConnectOptions: { ... }
});

// 2. Create a React Query Client
//    RainbowKit relies on React Query for managing async state.
const queryClient = new QueryClient();

// 3. Define the Root Application Component
//    This function wraps every page in your application.
export default function App({ Component, pageProps }) {
  return (
    // WagmiProvider makes Wagmi hooks (like useAccount, useWriteContract) available
    // It requires the 'config' object we created above.
    <WagmiProvider config={config}>
      {/* QueryClientProvider provides the React Query context */}
      <QueryClientProvider client={queryClient}>
        {/* RainbowKitProvider adds the wallet connection UI components and logic */}
        {/* Theme and other customizations can be applied here */}
        <RainbowKitProvider
          theme={lightTheme({ // Example: Apply a light theme with custom accent
            accentColor: '#0052FF', // Base blue-ish color
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
          modalSize="compact" // Use a more compact modal for connection options
        >
          {/* This renders the actual page component being visited */}
          <Component className={`${clash.className} ${chaney.className}`} {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}