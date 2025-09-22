// pages/api/providers/list.js
// Cursor-based pagination API for provider entries in the grid.hypr namespace

import { queryDatabase } from '../../../utils/db';

const BATCH_SIZE = 50;
const NAMESPACE_PATTERN = '%grid.hypr%'; // Entries containing grid.hypr in the path

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    console.warn(`Method Not Allowed: Received ${req.method} request.`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Extract cursor from query params
  const { cursor } = req.query;
  const isInitialLoad = !cursor;

  console.log(`Fetching providers batch - cursor: ${cursor || 'initial'}`);

  try {
    // Build the base query for provider entries
    let entriesQuery;
    let queryParams;

    if (cursor) {
      // Simplified cursor approach - just use namehash for ordering
      // This is more reliable and doesn't require complex subqueries
      entriesQuery = `
        SELECT
          e.namehash,
          e.label,
          e.full_name,
          e.parent_hash,
          e.owner,
          e.gene,
          e.tba,
          e.creation_block,
          e.last_update_block
        FROM entries e
        WHERE
          e.full_name LIKE $1
          AND e.namehash < $2
          AND EXISTS (
            SELECT 1
            FROM notes n
            WHERE n.entry_hash = e.namehash
            AND n.label = '~provider-name'
          )
        ORDER BY e.namehash DESC
        LIMIT $3
      `;
      queryParams = [NAMESPACE_PATTERN, cursor, BATCH_SIZE];
    } else {
      // Initial load - no cursor
      entriesQuery = `
        SELECT
          e.namehash,
          e.label,
          e.full_name,
          e.parent_hash,
          e.owner,
          e.gene,
          e.tba,
          e.creation_block,
          e.last_update_block
        FROM entries e
        WHERE
          e.full_name LIKE $1
          AND EXISTS (
            SELECT 1
            FROM notes n
            WHERE n.entry_hash = e.namehash
            AND n.label = '~provider-name'
          )
        ORDER BY e.namehash DESC
        LIMIT $2
      `;
      queryParams = [NAMESPACE_PATTERN, BATCH_SIZE];
    }

    // Execute the main query
    const entriesResult = await queryDatabase(entriesQuery, queryParams);
    const entries = entriesResult.rows;

    if (entries.length === 0) {
      console.log('No more providers found');
      return res.status(200).json({
        providers: [],
        nextCursor: null,
        hasMore: false,
        ...(isInitialLoad && { totalCount: 0 })
      });
    }

    // Get all entry hashes for batch fetching notes
    const entryHashes = entries.map(e => e.namehash);

    // Fetch all notes for these entries in one query
    const notesQuery = `
      SELECT
        entry_hash,
        label,
        raw_data,
        interpreted_data,
        block_number,
        log_index,
        tx_hash,
        notehash
      FROM notes
      WHERE
        entry_hash = ANY($1::text[])
        AND label IN ('~provider-name', '~description', '~price', '~status')
      ORDER BY block_number DESC, log_index DESC
    `;
    const notesResult = await queryDatabase(notesQuery, [entryHashes]);

    // Group notes by entry hash
    const notesByEntry = {};
    notesResult.rows.forEach(note => {
      if (!notesByEntry[note.entry_hash]) {
        notesByEntry[note.entry_hash] = {};
      }
      // Only keep the most recent note for each label (already sorted by block/log)
      if (!notesByEntry[note.entry_hash][note.label]) {
        notesByEntry[note.entry_hash][note.label] = {
          data: note.interpreted_data,
          rawData: note.raw_data,
          blockNumber: Number(note.block_number),
          logIndex: note.log_index,
          txHash: note.tx_hash,
          notehash: note.notehash
        };
      }
    });

    // Build provider objects
    const providers = entries.map(entry => ({
      namehash: entry.namehash,
      label: entry.label,
      fullName: entry.full_name,
      parentHash: entry.parent_hash,
      owner: entry.owner,
      gene: entry.gene,
      tba: entry.tba,
      providerName: notesByEntry[entry.namehash]?.['~provider-name']?.data || entry.label,
      description: notesByEntry[entry.namehash]?.['~description']?.data || null,
      price: notesByEntry[entry.namehash]?.['~price']?.data || null,
      status: notesByEntry[entry.namehash]?.['~status']?.data || 'active',
      lastUpdateBlock: Number(entry.last_update_block),
      creationBlock: Number(entry.creation_block)
    }));

    // Determine if there are more results
    const lastEntry = entries[entries.length - 1];
    const nextCursor = entries.length === BATCH_SIZE ? lastEntry.namehash : null;

    // Get total count only on initial load
    let totalCount;
    if (isInitialLoad) {
      const countQuery = `
        SELECT COUNT(*) as total
        FROM entries e
        WHERE
          e.full_name LIKE $1
          AND EXISTS (
            SELECT 1
            FROM notes n
            WHERE n.entry_hash = e.namehash
            AND n.label = '~provider-name'
          )
      `;
      const countResult = await queryDatabase(countQuery, [NAMESPACE_PATTERN]);
      totalCount = parseInt(countResult.rows[0].total);
      console.log(`Total provider count: ${totalCount}`);
    }

    console.log(`Returning ${providers.length} providers, nextCursor: ${nextCursor}`);

    // Build response
    const response = {
      providers,
      nextCursor,
      hasMore: nextCursor !== null,
      ...(isInitialLoad && { totalCount })
    };

    // Set cache headers for better performance
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30, max-age=10');
    res.status(200).json(response);

  } catch (error) {
    console.error('Database error in providers list API:', error);
    res.status(500).json({
      error: 'Internal Server Error while fetching providers',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}