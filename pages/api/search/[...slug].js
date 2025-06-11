// pages/api/search/[...slug].js
// Search API for Hypermap entries, notes, and facts

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
    let entriesResult, notesResult, factsResult;
    let namespaceInfo = null;

    if (isGlobalSearch) {
      // Global search queries
      console.log('Executing global search queries...');

      // Search entries by label or full_name
      const entriesQuery = `
        SELECT namehash, label, full_name, owner, tba
        FROM entries
        WHERE label ILIKE $1 OR full_name ILIKE $1
        ORDER BY 
          CASE 
            WHEN label ILIKE $2 THEN 0
            WHEN full_name ILIKE $2 THEN 1
            ELSE 2
          END,
          full_name
        LIMIT 50
      `;
      entriesResult = await queryDatabase(entriesQuery, [searchPattern, `${escapedSearchTerm}%`]);

      // Search notes
      const notesQuery = `
        SELECT 
          n.entry_hash, n.label as note_label, n.raw_data, n.interpreted_data,
          n.block_number, n.log_index, n.tx_hash, n.notehash,
          e.full_name, e.label as entry_label, e.namehash
        FROM notes n
        JOIN entries e ON n.entry_hash = e.namehash
        WHERE 
          n.label ILIKE $1 OR 
          n.interpreted_data ILIKE $1 OR 
          n.raw_data ILIKE $1
        ORDER BY n.block_number DESC, n.log_index DESC
        LIMIT 50
      `;
      notesResult = await queryDatabase(notesQuery, [searchPattern]);

      // Search facts
      const factsQuery = `
        SELECT 
          f.entry_hash, f.label as fact_label, f.raw_data, f.interpreted_data,
          f.block_number, f.log_index, f.tx_hash, f.facthash,
          e.full_name, e.label as entry_label, e.namehash
        FROM facts f
        JOIN entries e ON f.entry_hash = e.namehash
        WHERE 
          f.label ILIKE $1 OR 
          f.interpreted_data ILIKE $1 OR 
          f.raw_data ILIKE $1
        ORDER BY f.block_number DESC, f.log_index DESC
        LIMIT 50
      `;
      factsResult = await queryDatabase(factsQuery, [searchPattern]);

    } else {
      // Scoped search - first verify the namespace exists
      const namespaceQuery = 'SELECT namehash, full_name FROM entries WHERE full_name = $1 LIMIT 1';
      const namespaceResult = await queryDatabase(namespaceQuery, [namespacePath]);
      
      if (namespaceResult.rows.length === 0) {
        console.log(`Namespace not found: ${namespacePath}`);
        return res.status(404).json({ error: `Namespace not found: ${namespacePath}` });
      }

      namespaceInfo = namespaceResult.rows[0];
      console.log(`Found namespace: ${namespaceInfo.full_name} (${namespaceInfo.namehash})`);

      // Search entries under this namespace (including the namespace itself if it matches)
      const entriesQuery = `
        SELECT namehash, label, full_name, owner, tba
        FROM entries
        WHERE 
          (full_name = $1 OR full_name LIKE $2)
          AND (label ILIKE $3 OR full_name ILIKE $3)
        ORDER BY 
          CASE 
            WHEN full_name = $1 AND label ILIKE $4 THEN 0
            WHEN label ILIKE $4 THEN 1
            WHEN full_name ILIKE $4 THEN 2
            ELSE 3
          END,
          full_name
        LIMIT 50
      `;
      entriesResult = await queryDatabase(entriesQuery, [
        namespacePath,
        `${namespacePath}.%`,
        searchPattern,
        `${escapedSearchTerm}%`
      ]);

      // Search notes under this namespace
      const notesQuery = `
        SELECT 
          n.entry_hash, n.label as note_label, n.raw_data, n.interpreted_data,
          n.block_number, n.log_index, n.tx_hash, n.notehash,
          e.full_name, e.label as entry_label, e.namehash
        FROM notes n
        JOIN entries e ON n.entry_hash = e.namehash
        WHERE 
          (e.full_name = $1 OR e.full_name LIKE $2)
          AND (
            n.label ILIKE $3 OR 
            n.interpreted_data ILIKE $3 OR 
            n.raw_data ILIKE $3
          )
        ORDER BY n.block_number DESC, n.log_index DESC
        LIMIT 50
      `;
      notesResult = await queryDatabase(notesQuery, [
        namespacePath,
        `${namespacePath}.%`,
        searchPattern
      ]);

      // Search facts under this namespace
      const factsQuery = `
        SELECT 
          f.entry_hash, f.label as fact_label, f.raw_data, f.interpreted_data,
          f.block_number, f.log_index, f.tx_hash, f.facthash,
          e.full_name, e.label as entry_label, e.namehash
        FROM facts f
        JOIN entries e ON f.entry_hash = e.namehash
        WHERE 
          (e.full_name = $1 OR e.full_name LIKE $2)
          AND (
            f.label ILIKE $3 OR 
            f.interpreted_data ILIKE $3 OR 
            f.raw_data ILIKE $3
          )
        ORDER BY f.block_number DESC, f.log_index DESC
        LIMIT 50
      `;
      factsResult = await queryDatabase(factsQuery, [
        namespacePath,
        `${namespacePath}.%`,
        searchPattern
      ]);
    }

    // Format results
    const formattedEntries = entriesResult.rows.map(entry => ({
      namehash: entry.namehash,
      label: entry.label,
      fullName: entry.full_name,
      owner: entry.owner,
      tba: entry.tba,
      urlPath: entry.full_name ? entry.full_name.split('.').reverse().join('/') : null
    }));

    const formattedNotes = notesResult.rows.map(note => ({
      entryHash: note.entry_hash,
      entryFullName: note.full_name,
      entryLabel: note.entry_label,
      noteLabel: note.note_label,
      data: note.interpreted_data || note.raw_data,
      rawData: note.raw_data,
      blockNumber: Number(note.block_number),
      logIndex: note.log_index,
      txHash: note.tx_hash,
      notehash: note.notehash,
      urlPath: note.full_name ? note.full_name.split('.').reverse().join('/') : null
    }));

    const formattedFacts = factsResult.rows.map(fact => ({
      entryHash: fact.entry_hash,
      entryFullName: fact.full_name,
      entryLabel: fact.entry_label,
      factLabel: fact.fact_label,
      data: fact.interpreted_data || fact.raw_data,
      rawData: fact.raw_data,
      blockNumber: Number(fact.block_number),
      logIndex: fact.log_index,
      txHash: fact.tx_hash,
      facthash: fact.facthash,
      urlPath: fact.full_name ? fact.full_name.split('.').reverse().join('/') : null
    }));

    // Calculate total results
    const totalResults = formattedEntries.length + formattedNotes.length + formattedFacts.length;
    const isLimited = formattedEntries.length === 50 || formattedNotes.length === 50 || formattedFacts.length === 50;

    // Build response
    const response = {
      query: searchTerm,
      namespace: isGlobalSearch ? null : {
        fullName: namespacePath,
        namehash: namespaceInfo?.namehash,
        urlPath: namespacePath.split('.').reverse().join('/')
      },
      results: {
        entries: formattedEntries,
        notes: formattedNotes,
        facts: formattedFacts
      },
      totalResults,
      limited: isLimited
    };

    console.log(`Search completed. Found ${totalResults} results${isLimited ? ' (limited)' : ''}`);
    
    // Set cache headers for search results
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60, max-age=60');
    res.status(200).json(response);

  } catch (dbError) {
    console.error(`Database error in search API:`, dbError);
    res.status(500).json({ error: 'Internal Server Error while searching.' });
  }
}