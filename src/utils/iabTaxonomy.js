import iabCategoriesCsv from '@/data/iab-categories.csv?raw';

function parseCSVLine(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1;
      while (end < line.length && (line[end] !== '"' || line[end + 1] === '"')) end = line[end] === '"' ? end + 2 : end + 1;
      out.push(line.slice(i + 1, end).replace(/""/g, '"'));
      i = line[end] === '"' ? end + 1 : end + 2;
    } else {
      const comma = line.indexOf(',', i);
      const end = comma === -1 ? line.length : comma;
      out.push(line.slice(i, end).trim());
      i = comma === -1 ? line.length : comma + 1;
    }
  }
  return out;
}

function parseIABCategoriesCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const rows = lines.slice(1).map((line) => {
    const [code, tier, category] = parseCSVLine(line);
    return { code: (code || '').trim(), tier: (tier || '').trim(), name: (category || '').trim() };
  });
  const mainCategories = [];
  const byCode = {};
  for (const row of rows) {
    if (row.tier === 'Tier 1') {
      const cat = { code: row.code, name: row.name, children: [] };
      byCode[row.code] = cat;
      mainCategories.push(cat);
    } else if (row.tier === 'Tier 2') {
      const parentCode = row.code.replace(/-\d+$/, '');
      const parent = byCode[parentCode];
      if (parent) parent.children.push({ code: row.code, name: row.name });
    }
  }
  return mainCategories;
}

export const IAB_TAXONOMY = parseIABCategoriesCsv(iabCategoriesCsv);

export function getIABCodesForCategory(cat) {
  const codes = [cat.code];
  if (cat.children?.length) codes.push(...cat.children.map((c) => c.code));
  return codes;
}
