// pages/api/entry/by-name/[...slug].js
// Fetches Hypermap entry data including notes, facts, children, and TBA.

import { queryDatabase } from '../../../../utils/db'; // Adjust path if your structure differs

// Define Root Hash constant
const ROOT_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

// The main function that handles incoming API requests
export default async function handler(req, res) {

  // --- 1. Check HTTP Method ---
  if (req.method !== 'GET') {
    console.warn(`Method Not Allowed: Received ${req.method} request.`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // --- 2. Extract and Validate Slug ---
  const { slug } = req.query;
  if (!slug || !Array.isArray(slug) || slug.length === 0) {
    console.log("Invalid slug received:", slug);
    return res.status(400).json({ error: 'Invalid path provided. Path cannot be empty.' });
  }

  // --- 3. Reconstruct Full Name ---
  // Reverse slug array to match DB format (child.parent.grandparent)
  const fullName = [...slug].reverse().join('.');
  console.log(`API route processing request for resolved fullName: ${fullName}`);

  // --- 4. Query Database ---
  try {
    // Query 1: Find the main entry (including the new 'tba' column via SELECT *)
    const entryQuery = 'SELECT * FROM entries WHERE full_name = $1 LIMIT 1';
    const entryResult = await queryDatabase(entryQuery, [fullName]);

    // Handle entry not found
    if (entryResult.rows.length === 0) {
      console.log(`Entry not found in DB for fullName: ${fullName}`);
      return res.status(404).json({ error: `Entry not found for path: ${slug.join('/')}` });
    }
    const entry = entryResult.rows[0];
    const entryHash = entry.namehash; // Use the actual namehash from the found entry

    // Query 2: Fetch associated notes
    const notesQuery = `
      SELECT label, raw_data, interpreted_data, block_number, log_index, tx_hash, notehash
      FROM notes WHERE entry_hash = $1 ORDER BY block_number DESC, log_index DESC;
    `;
    const notesResult = await queryDatabase(notesQuery, [entryHash]);

    // Query 3: Fetch associated facts
    const factsQuery = `
      SELECT label, raw_data, interpreted_data, block_number, log_index, tx_hash, facthash
      FROM facts WHERE entry_hash = $1 ORDER BY block_number DESC, log_index DESC;
    `;
    const factsResult = await queryDatabase(factsQuery, [entryHash]);

    // Query 4: Fetch direct children
    const childrenQuery = `
      SELECT namehash, label, full_name
      FROM entries WHERE parent_hash = $1;
    `;
    const childrenResult = await queryDatabase(childrenQuery, [entryHash]);

    // --- 5. Format Notes and Facts ---
    const notesGrouped = {};
    notesResult.rows.forEach(note => {
      const label = note.label;
      if (!notesGrouped[label]) { notesGrouped[label] = []; }
      notesGrouped[label].push({
        data: note.interpreted_data, rawData: note.raw_data,
        blockNumber: Number(note.block_number), logIndex: note.log_index,
        txHash: note.tx_hash, notehash: note.notehash
      });
    });

    const factsGrouped = {};
    factsResult.rows.forEach(fact => {
      const label = fact.label;
      if (!factsGrouped[label]) { factsGrouped[label] = []; }
      factsGrouped[label].push({
        data: fact.interpreted_data, rawData: fact.raw_data,
        blockNumber: Number(fact.block_number), logIndex: fact.log_index,
        txHash: fact.tx_hash, facthash: fact.facthash
      });
    });

    // --- 6. Assemble Final JSON Response ---
    const responseData = {
      [entryHash]: { // Key the response by the entry's actual namehash
        namehash: entry.namehash,
        label: entry.label,
        parentHash: entry.parent_hash,
        fullName: entry.full_name,
        owner: entry.owner,
        gene: entry.gene,
        tba: entry.tba, // <<< --- ADDED TBA HERE --- <<<
        notes: notesGrouped,
        facts: factsGrouped,
        children: childrenResult.rows.map(child => ({
          namehash: child.namehash,
          label: child.label,
          fullName: child.full_name
        })),
        creationBlock: Number(entry.creation_block),
        lastUpdateBlock: Number(entry.last_update_block)
      }
    };

    // --- 7. Send Success Response ---
    console.log(`Successfully retrieved data for fullName: ${fullName} (namehash: ${entryHash})`);
    // Set cache headers - example: cache for 60 seconds on CDN, 5 minutes in browser
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120, max-age=300');
    res.status(200).json(responseData);

  } catch (dbError) {
    // --- 8. Handle Database Errors ---
    console.error(`Database error in API route for /${slug.join('/')}:`, dbError);
    res.status(500).json({ error: 'Internal Server Error while fetching entry data.' });
  }
}
