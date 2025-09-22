// pages/api/providers/debug.js
// Debug endpoint to check what provider data exists in the database

import { queryDatabase } from '../../../utils/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log('Debug: Checking for grid.hypr entries...');

    // 1. Check if there are ANY entries under grid.hypr
    const entriesQuery = `
      SELECT COUNT(*) as total
      FROM entries
      WHERE full_name LIKE '%grid.hypr%'
    `;
    const entriesResult = await queryDatabase(entriesQuery, []);
    const totalEntries = parseInt(entriesResult.rows[0].total);

    // 2. Check how many have provider-name notes
    const withNotesQuery = `
      SELECT COUNT(DISTINCT e.namehash) as total
      FROM entries e
      WHERE e.full_name LIKE '%grid.hypr%'
      AND EXISTS (
        SELECT 1 FROM notes n
        WHERE n.entry_hash = e.namehash
        AND n.label = '~provider-name'
      )
    `;
    const withNotesResult = await queryDatabase(withNotesQuery, []);
    const entriesWithProviderName = parseInt(withNotesResult.rows[0].total);

    // 3. Get a sample of entries to see the structure
    const sampleQuery = `
      SELECT
        e.namehash,
        e.label,
        e.full_name,
        e.parent_hash,
        e.last_update_block
      FROM entries e
      WHERE e.full_name LIKE '%grid.hypr%'
      ORDER BY e.last_update_block DESC
      LIMIT 10
    `;
    const sampleResult = await queryDatabase(sampleQuery, []);

    // 4. Get all unique note labels for grid.hypr entries
    const noteLabelsQuery = `
      SELECT DISTINCT n.label, COUNT(*) as count
      FROM notes n
      JOIN entries e ON n.entry_hash = e.namehash
      WHERE e.full_name LIKE '%grid.hypr%'
      GROUP BY n.label
      ORDER BY count DESC
      LIMIT 20
    `;
    const noteLabelsResult = await queryDatabase(noteLabelsQuery, []);

    // 5. Check different pattern variations
    const patternsQuery = `
      SELECT
        COUNT(CASE WHEN full_name LIKE '%.grid.hypr' THEN 1 END) as ends_with_grid_hypr,
        COUNT(CASE WHEN full_name LIKE '%.grid.hypr.%' THEN 1 END) as contains_grid_hypr_middle,
        COUNT(CASE WHEN full_name LIKE 'grid.hypr%' THEN 1 END) as starts_with_grid_hypr,
        COUNT(CASE WHEN full_name = 'grid.hypr' THEN 1 END) as exact_grid_hypr
      FROM entries
      WHERE full_name LIKE '%grid.hypr%'
    `;
    const patternsResult = await queryDatabase(patternsQuery, []);

    res.status(200).json({
      summary: {
        totalEntriesUnderGridHypr: totalEntries,
        entriesWithProviderNameNote: entriesWithProviderName,
        percentageWithProviderName: totalEntries > 0
          ? Math.round(entriesWithProviderName / totalEntries * 100)
          : 0
      },
      patterns: patternsResult.rows[0],
      sampleEntries: sampleResult.rows,
      noteLabels: noteLabelsResult.rows,
      debug: {
        namespacePattern: '%grid.hypr%',
        message: totalEntries === 0
          ? 'No entries found under grid.hypr namespace'
          : entriesWithProviderName === 0
            ? 'Entries exist but none have ~provider-name notes'
            : 'Provider entries found successfully'
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      error: 'Database error',
      details: error.message
    });
  }
}