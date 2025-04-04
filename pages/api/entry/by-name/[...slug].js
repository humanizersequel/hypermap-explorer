// pages/api/entry/by-name/[...slug].js
import { queryDatabase } from '../../../../utils/db'; // Adjust path if your structure differs

// Define Root Hash constant, needed for potentially excluding root info if needed
const ROOT_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

// The main function that handles incoming API requests
export default async function handler(req, res) {

  // --- 1. Check HTTP Method ---
  // This endpoint should only respond to GET requests
  if (req.method !== 'GET') {
    console.warn(`Method Not Allowed: Received ${req.method} request.`);
    res.setHeader('Allow', ['GET']); // Inform client which methods are allowed
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // --- 2. Extract and Validate Slug ---
  // 'slug' comes from the filename [...slug].js
  // For URL /api/entry/by-name/os/username/entry, req.query.slug will be ['os', 'username', 'entry']
  const { slug } = req.query;

  // Check if slug exists and is an array with at least one element
  if (!slug || !Array.isArray(slug) || slug.length === 0) {
    console.log("Invalid slug received:", slug);
    return res.status(400).json({ error: 'Invalid path provided. Path cannot be empty.' });
  }

  // --- 3. Reconstruct Full Name ---
  // The URL path is os/username/entry, but the internal full_name is entry.username.os
  // So, we need to reverse the slug array before joining with dots.
  const fullName = [...slug].reverse().join('.');
  console.log(`API route processing request for resolved fullName: ${fullName}`);

  // --- 4. Query Database ---
  try {
    // Query 1: Find the main entry using the unique full_name
    const entryQuery = 'SELECT * FROM entries WHERE full_name = $1 LIMIT 1';
    const entryResult = await queryDatabase(entryQuery, [fullName]);

    // Handle entry not found
    if (entryResult.rows.length === 0) {
      console.log(`Entry not found in DB for fullName: ${fullName}`);
      return res.status(404).json({ error: `Entry not found for path: ${slug.join('/')}` });
    }
    const entry = entryResult.rows[0];
    const entryHash = entry.namehash;

    // Query 2: Fetch associated notes (most recent first)
    const notesQuery = `
      SELECT label, raw_data, interpreted_data, block_number, log_index, tx_hash, notehash
      FROM notes
      WHERE entry_hash = $1
      ORDER BY block_number DESC, log_index DESC;
    `;
    const notesResult = await queryDatabase(notesQuery, [entryHash]);

    // Query 3: Fetch associated facts (most recent first)
    const factsQuery = `
      SELECT label, raw_data, interpreted_data, block_number, log_index, tx_hash, facthash
      FROM facts
      WHERE entry_hash = $1
      ORDER BY block_number DESC, log_index DESC;
    `;
    const factsResult = await queryDatabase(factsQuery, [entryHash]);

    // Query 4: Fetch direct children (basic info only)
    const childrenQuery = `
      SELECT namehash, label, full_name
      FROM entries
      WHERE parent_hash = $1;
    `;
    const childrenResult = await queryDatabase(childrenQuery, [entryHash]);

    // --- 5. Format Notes and Facts ---
    // Group notes by label into an object where each key is a label
    // and the value is an array of note history for that label (newest first).
    const notesGrouped = {};
    notesResult.rows.forEach(note => {
      const label = note.label; // Assumes label is stored as text
      if (!notesGrouped[label]) { notesGrouped[label] = []; }
      notesGrouped[label].push({
        data: note.interpreted_data, // Use pre-interpreted data from indexer
        rawData: note.raw_data,
        blockNumber: Number(note.block_number), // Ensure numbers
        logIndex: note.log_index,
        txHash: note.tx_hash,
        notehash: note.notehash
        // Note: history is already ordered by query
      });
    });

    // Group facts similarly
    const factsGrouped = {};
    factsResult.rows.forEach(fact => {
      const label = fact.label; // Assumes label is stored as text
      if (!factsGrouped[label]) { factsGrouped[label] = []; }
      factsGrouped[label].push({
        data: fact.interpreted_data,
        rawData: fact.raw_data,
        blockNumber: Number(fact.block_number),
        logIndex: fact.log_index,
        txHash: fact.tx_hash,
        facthash: fact.facthash
      });
    });

    // --- 6. Assemble Final JSON Response ---
    // Structure the response, keyed by the main entry's namehash
    const responseData = {
      [entryHash]: {
        namehash: entry.namehash,
        label: entry.label,
        parentHash: entry.parent_hash,
        fullName: entry.full_name,
        owner: entry.owner,
        gene: entry.gene,
        notes: notesGrouped, // Contains grouped note history
        facts: factsGrouped, // Contains grouped fact history
        children: childrenResult.rows.map(child => ({ // Basic info for children
             namehash: child.namehash,
             label: child.label,
             fullName: child.full_name // Include fullName for linking
        })),
        creationBlock: Number(entry.creation_block),
        lastUpdateBlock: Number(entry.last_update_block)
      }
    };

    // --- 7. Send Success Response ---
    console.log(`Successfully retrieved data for fullName: ${fullName}`);
    res.status(200).json(responseData);

  } catch (dbError) {
    // --- 8. Handle Database Errors ---
    console.error(`Database error in API route for /${slug.join('/')}:`, dbError);
    // Send a generic server error response to the client
    res.status(500).json({ error: 'Internal Server Error while fetching entry data.' });
  }
}