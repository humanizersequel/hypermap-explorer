// utils/db.js
// Utility for managing the PostgreSQL connection pool.

import { Pool } from 'pg'; // Import the Pool class from node-postgres

// Declare a variable to hold the pool instance. It's declared outside the function
// so that it persists across multiple function calls within the same process/lambda invocation.
let pool;

// Function to get or create the connection pool instance (Singleton pattern)
function getPool() {
  // If the pool hasn't been created yet...
  if (!pool) {
    // Check if the required environment variable is set.
    if (!process.env.DATABASE_URL) {
      console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
      // In a server context, throwing here might stop the specific request/invocation.
      // For critical config, sometimes exiting the process is considered, but can affect availability.
      throw new Error("DATABASE_URL environment variable is not set.");
    }

    console.log("Creating new PostgreSQL connection pool...");
    // Create a new Pool instance with the connection string from environment variables.
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Note: For production deployments (like Vercel connecting to Railway),
      // you often NEED SSL enabled. Railway usually includes ssl=require in the URL.
      // If not, or for other providers, you might need:
      // ssl: {
      //   rejectUnauthorized: false // Use with caution, check provider docs
      // }
    });

    // Add an error listener to the pool. This handles errors for idle clients
    // that aren't actively running a query.
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle PostgreSQL client in pool', err);
      // Depending on the app's needs, you might just log this, or potentially
      // try to gracefully shut down the process if pool errors are critical.
    });

    console.log("PostgreSQL connection pool created.");
  }
  // Return the existing or newly created pool instance.
  return pool;
}

/**
 * Executes a SQL query using a client from the connection pool.
 * Ensures the client is always released back to the pool.
 * @param {string} text - The SQL query text (e.g., "SELECT * FROM users WHERE id = $1").
 * @param {Array} [params] - Optional array of parameters for the query (e.g., [userId]).
 * @returns {Promise<QueryResult>} A promise that resolves with the query result.
 * @throws {Error} Throws an error if the query fails.
 */
export async function queryDatabase(text, params) {
  const dbPool = getPool(); // Get the singleton pool instance
  const start = Date.now();
  let client; // Declare client outside try block

  try {
    // Get a client connection from the pool
    client = await dbPool.connect();
    // Execute the query
    const res = await client.query(text, params);
    // Calculate execution time
    const duration = Date.now() - start;
    // Log successful query execution (optional, good for debugging)
    // Shorten query text for cleaner logs if it's very long
    const logText = text.length > 150 ? text.substring(0, 150) + '...' : text;
    console.log('Executed query', { text: logText, params: params, duration: `${duration}ms`, rowCount: res.rowCount });
    // Return the full result object from node-postgres
    return res;
  } catch (error) {
     // Log the error if the query fails
     console.error('Error executing query:', { text, params, error });
     // Re-throw the error so the calling function knows it failed
     throw error;
  } finally {
    // VERY IMPORTANT: Always release the client back to the pool,
    // regardless of whether the query succeeded or failed.
    if (client) {
      client.release();
      // console.log('Database client released.'); // Optional log
    }
  }
}