// pages/api/search/[...slug].js
// Search API for Hypermap entries, notes, and facts - returns entry-based results

import { queryDatabase } from '../../../utils/db';

// Helper function to escape special characters for ILIKE patterns
function escapeForLike(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    console.warn(`Method Not Allowed: Received ${req.method} request.`);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Extract and validate slug
  const { slug } = req.query;
  if (!slug || !Array.isArray(slug) || slug.length === 0) {
    console.log("Invalid slug received:", slug);
    return res.status(400).json({ error: 'Invalid search path provided.' });
  }

  // Parse the slug to determine search type and parameters
  let searchTerm, namespacePath, isGlobalSearch;
  
  if (slug.length === 1) {
    // Global search: /api/search/[searchTerm]
    searchTerm = slug[0];
    namespacePath = null;
    isGlobalSearch = true;
    console.log(`Global search for: "${searchTerm}"`);
  } else {
    // Scoped search: /api/search/[...namespace]/[searchTerm]
    searchTerm = slug[slug.length - 1];
    // Reconstruct namespace path (reverse the URL path minus search term)
    const namespaceParts = slug.slice(0, -1);
    namespacePath = [...namespaceParts].reverse().join('.');
    isGlobalSearch = false;
    console.log(`Scoped search for: "${searchTerm}" under namespace: "${namespacePath}"`);
  }

  // Validate search term
  if (!searchTerm || searchTerm.trim().length === 0) {
    return res.status(400).json({ error: 'Search term cannot be empty.' });
  }

  // Prepare search pattern for ILIKE queries
  const escapedSearchTerm = escapeForLike(searchTerm.trim());
  const searchPattern = `%${escapedSearchTerm}%`;

  try {
    let matchingEntryHashes = new Set();
    let entriesMap = new Map();

    if (isGlobalSearch) {
      // Global search - find all entries that match directly or have matching notes/facts
      console.log('Executing global search queries...');

      // Find entries that match by name
      const entriesQuery = `
        SELECT namehash, label, full_name, parent_hash, owner, gene, tba, creation_block, last_update_block
        FROM entries
        WHERE label ILIKE $1 OR full_name ILIKE $1
        LIMIT 100
      `;
      const entriesResult = await queryDatabase(entriesQuery, [searchPattern]);
      
      // Add matching entries to our set
      entriesResult.rows.forEach(entry => {
        matchingEntryHashes.add(entry.namehash);
        entriesMap.set(entry.namehash, entry);
      });

      // Find entries that have matching notes
      const notesQuery = `
        SELECT DISTINCT entry_hash
        FROM notes
        WHERE 
          label ILIKE $1 OR 
          interpreted_data ILIKE $1 OR 
          raw_data ILIKE $1
        LIMIT 100
      `;
      const notesResult = await queryDatabase(notesQuery, [searchPattern]);
      notesResult.rows.forEach(row => matchingEntryHashes.add(row.entry_hash));

      // Find entries that have matching facts
      const factsQuery = `
        SELECT DISTINCT entry_hash
        FROM facts
        WHERE 
          label ILIKE $1 OR 
          interpreted_data ILIKE $1 OR 
          raw_data ILIKE $1
        LIMIT 100
      `;
      const factsResult = await queryDatabase(factsQuery, [searchPattern]);
      factsResult.rows.forEach(row => matchingEntryHashes.add(row.entry_hash));

    } else {
      // Scoped search - find entries that contain the namespace path and match the search
      console.log(`Executing scoped search for namespace containing: ${namespacePath}`);

      // Find entries whose full_name contains the namespace path
      const entriesQuery = `
        SELECT namehash, label, full_name, parent_hash, owner, gene, tba, creation_block, last_update_block
        FROM entries
        WHERE 
          full_name LIKE $1
          AND (label ILIKE $2 OR full_name ILIKE $2)
        LIMIT 100
      `;
      const entriesResult = await queryDatabase(entriesQuery, [`%${namespacePath}%`, searchPattern]);
      
      // Add matching entries
      entriesResult.rows.forEach(entry => {
        matchingEntryHashes.add(entry.namehash);
        entriesMap.set(entry.namehash, entry);
      });

      // Find entries with matching notes under this namespace
      const notesQuery = `
        SELECT DISTINCT n.entry_hash
        FROM notes n
        JOIN entries e ON n.entry_hash = e.namehash
        WHERE 
          e.full_name LIKE $1
          AND (
            n.label ILIKE $2 OR 
            n.interpreted_data ILIKE $2 OR 
            n.raw_data ILIKE $2
          )
        LIMIT 100
      `;
      const notesResult = await queryDatabase(notesQuery, [`%${namespacePath}%`, searchPattern]);
      notesResult.rows.forEach(row => matchingEntryHashes.add(row.entry_hash));

      // Find entries with matching facts under this namespace
      const factsQuery = `
        SELECT DISTINCT f.entry_hash
        FROM facts f
        JOIN entries e ON f.entry_hash = e.namehash
        WHERE 
          e.full_name LIKE $1
          AND (
            f.label ILIKE $2 OR 
            f.interpreted_data ILIKE $2 OR 
            f.raw_data ILIKE $2
          )
        LIMIT 100
      `;
      const factsResult = await queryDatabase(factsQuery, [`%${namespacePath}%`, searchPattern]);
      factsResult.rows.forEach(row => matchingEntryHashes.add(row.entry_hash));
    }

    // Now fetch full data for all matching entries
    const entryHashArray = Array.from(matchingEntryHashes);
    
    if (entryHashArray.length === 0) {
      console.log('No matching entries found');
      return res.status(200).json({
        query: searchTerm,
        namespace: isGlobalSearch ? null : namespacePath,
        results: {},
        totalResults: 0
      });
    }

    console.log(`Found ${entryHashArray.length} matching entries, fetching full data...`);

    // Fetch entry details for entries we don't already have
    const missingHashes = entryHashArray.filter(hash => !entriesMap.has(hash));
    if (missingHashes.length > 0) {
      const entriesDetailQuery = `
        SELECT namehash, label, full_name, parent_hash, owner, gene, tba, creation_block, last_update_block
        FROM entries
        WHERE namehash = ANY($1::text[])
      `;
      const entriesDetailResult = await queryDatabase(entriesDetailQuery, [missingHashes]);
      entriesDetailResult.rows.forEach(entry => {
        entriesMap.set(entry.namehash, entry);
      });
    }

    // Fetch all notes for matching entries
    const allNotesQuery = `
      SELECT entry_hash, label, raw_data, interpreted_data, block_number, log_index, tx_hash, notehash
      FROM notes
      WHERE entry_hash = ANY($1::text[])
      ORDER BY block_number DESC, log_index DESC
    `;
    const allNotesResult = await queryDatabase(allNotesQuery, [entryHashArray]);

    // Fetch all facts for matching entries
    const allFactsQuery = `
      SELECT entry_hash, label, raw_data, interpreted_data, block_number, log_index, tx_hash, facthash
      FROM facts
      WHERE entry_hash = ANY($1::text[])
      ORDER BY block_number DESC, log_index DESC
    `;
    const allFactsResult = await queryDatabase(allFactsQuery, [entryHashArray]);

    // Fetch children for all matching entries
    const allChildrenQuery = `
      SELECT parent_hash, namehash, label, full_name
      FROM entries
      WHERE parent_hash = ANY($1::text[])
    `;
    const allChildrenResult = await queryDatabase(allChildrenQuery, [entryHashArray]);

    // Group notes by entry and label
    const notesByEntry = {};
    allNotesResult.rows.forEach(note => {
      if (!notesByEntry[note.entry_hash]) {
        notesByEntry[note.entry_hash] = {};
      }
      if (!notesByEntry[note.entry_hash][note.label]) {
        notesByEntry[note.entry_hash][note.label] = [];
      }
      notesByEntry[note.entry_hash][note.label].push({
        data: note.interpreted_data,
        rawData: note.raw_data,
        blockNumber: Number(note.block_number),
        logIndex: note.log_index,
        txHash: note.tx_hash,
        notehash: note.notehash
      });
    });

    // Group facts by entry and label
    const factsByEntry = {};
    allFactsResult.rows.forEach(fact => {
      if (!factsByEntry[fact.entry_hash]) {
        factsByEntry[fact.entry_hash] = {};
      }
      if (!factsByEntry[fact.entry_hash][fact.label]) {
        factsByEntry[fact.entry_hash][fact.label] = [];
      }
      factsByEntry[fact.entry_hash][fact.label].push({
        data: fact.interpreted_data,
        rawData: fact.raw_data,
        blockNumber: Number(fact.block_number),
        logIndex: fact.log_index,
        txHash: fact.tx_hash,
        facthash: fact.facthash
      });
    });

    // Group children by parent
    const childrenByParent = {};
    allChildrenResult.rows.forEach(child => {
      if (!childrenByParent[child.parent_hash]) {
        childrenByParent[child.parent_hash] = [];
      }
      childrenByParent[child.parent_hash].push({
        namehash: child.namehash,
        label: child.label,
        fullName: child.full_name
      });
    });

    // Build the response in the same format as by-name API
    const results = {};
    entryHashArray.forEach(entryHash => {
      const entry = entriesMap.get(entryHash);
      if (entry) {
        results[entryHash] = {
          namehash: entry.namehash,
          label: entry.label,
          parentHash: entry.parent_hash,
          fullName: entry.full_name,
          owner: entry.owner,
          gene: entry.gene,
          tba: entry.tba,
          notes: notesByEntry[entryHash] || {},
          facts: factsByEntry[entryHash] || {},
          children: childrenByParent[entryHash] || [],
          creationBlock: Number(entry.creation_block),
          lastUpdateBlock: Number(entry.last_update_block)
        };
      }
    });

    // Calculate total results
    const totalResults = Object.keys(results).length;

    console.log(`Search completed. Found ${totalResults} matching entries`);
    
    // Set cache headers for search results
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60, max-age=60');
    res.status(200).json({
      query: searchTerm,
      namespace: isGlobalSearch ? null : namespacePath,
      results,
      totalResults
    });

  } catch (dbError) {
    console.error(`Database error in search API:`, dbError);
    res.status(500).json({ error: 'Internal Server Error while searching.' });
  }
}