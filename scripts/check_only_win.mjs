/**
 * Script: check_only_win.mjs
 * Fetches all User Syncs, checks only_win for each, and exports those with only_win=true to a CSV.
 *
 * Usage:
 *   node scripts/check_only_win.mjs <auth_token>
 *
 * Output: scripts/only_win_true.csv
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_BASE = 'https://back.platform.gcp.omnitagjs.com/bo-api';
const SEARCH_URL = `${API_BASE}/cookie_sync/search`;

const token = process.argv[2];
if (!token) {
  console.error('❌  Usage: node scripts/check_only_win.mjs <auth_token>');
  process.exit(1);
}

const headers = { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' };

// ── 1. Fetch all user syncs ─────────────────────────────────────────────────
console.log('⏳  Fetching all User Syncs…');
const searchRes = await fetch(SEARCH_URL, {
  method: 'POST',
  headers,
  body: JSON.stringify({ From: 0, Order: [{ Field: 'UpdatedAt', Operator: 'desc' }], Size: 500 }),
});

if (!searchRes.ok) {
  console.error(`❌  Search failed: HTTP ${searchRes.status}`);
  process.exit(1);
}

const searchData = await searchRes.json();
const items = Array.isArray(searchData?.Data) ? searchData.Data : [];
console.log(`✅  Found ${items.length} User Syncs`);

// ── 2. Fetch each one and check only_win ────────────────────────────────────
const results = [];
let done = 0;

await Promise.all(
  items.map(async (item) => {
    try {
      const res = await fetch(`${API_BASE}/cookie_sync/${item.uid}`, { headers });
      if (!res.ok) {
        console.warn(`  ⚠️  ${item.uid} → HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      const d = json?.Data ?? json;
      if (d.only_win === true) {
        results.push({ uid: d.uid, name: d.name ?? item.name ?? '', only_win: true });
      }
    } catch (e) {
      console.warn(`  ⚠️  ${item.uid} → ${e.message}`);
    } finally {
      done++;
      process.stdout.write(`\r  Checked ${done}/${items.length}…`);
    }
  })
);

console.log(`\n\n🔍  ${results.length} User Sync(s) with only_win = true`);

// ── 3. Write CSV ────────────────────────────────────────────────────────────
if (results.length === 0) {
  console.log('ℹ️   No entries to export.');
  process.exit(0);
}

const csv = ['uid,name,only_win', ...results.map(r => `${r.uid},"${r.name.replace(/"/g, '""')}",true`)].join('\n');
const outPath = join(__dirname, 'only_win_true.csv');
writeFileSync(outPath, csv, 'utf8');
console.log(`✅  CSV saved → ${outPath}`);
