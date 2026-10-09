export function parseReplaceCSV(rows) {
  return rows
    .filter(row => row && row.findText !== undefined)
    .map(row => ({
      scope: row.scope || 'DOCUMENT',
      from: row.from || null,
      to: row.to || null,
      block: row.block || null,
      findText: String(row.findText),
      replaceText: String(row.replaceText)
    }));
}
