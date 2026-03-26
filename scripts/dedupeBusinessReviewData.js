/**
 * Deduplicate Business Review data array by (timestamp, adKind).
 * For duplicate keys we keep one row and sum numeric metrics.
 * Used by fetch scripts and by deduplicateBusinessReviewJson.js.
 */

export function getDedupeKey(record) {
  const ts = record.timestamp ?? '';
  const adKind = record.adKind ?? '';
  return `${ts}|${adKind}`;
}

export function deduplicateData(dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return dataArray;

  const map = new Map();

  for (const record of dataArray) {
    const key = getDedupeKey(record);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...record });
      continue;
    }

    for (const [k, value] of Object.entries(record)) {
      if (k === 'timestamp' || k === 'adKind') continue;
      if (typeof value === 'number') {
        existing[k] = (existing[k] ?? 0) + value;
      } else if (existing[k] === undefined) {
        existing[k] = value;
      }
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => {
    const t = (a.timestamp || '').localeCompare(b.timestamp || '');
    if (t !== 0) return t;
    return (a.adKind || '').localeCompare(b.adKind || '');
  });
  return result;
}
