/**
 * Deduplicate Business Review JSON files (data array) by (timestamp, adKind).
 * For duplicate keys we keep one row and sum numeric metrics.
 *
 * Usage:
 *   node scripts/deduplicateBusinessReviewJson.js [dir]
 *
 * If [dir] is omitted, processes all: data/REALM, data/DSP, data/COMPANY, data/DEAL, data/BROKER.
 * If [dir] is given (e.g. REALM), only processes data/REALM.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deduplicateData } from './dedupeBusinessReviewData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_ROOT = path.join(__dirname, '..', 'data');
const DEFAULT_DIRS = ['REALM', 'DSP', 'COMPANY', 'DEAL', 'BROKER'];

function processFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error(`   ❌ Read error: ${e.message}`);
    return { ok: false, removed: 0 };
  }

  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.error(`   ❌ Invalid JSON: ${e.message}`);
    return { ok: false, removed: 0 };
  }

  const data = json.data;
  if (!Array.isArray(data)) {
    console.log(`   ⏭️  No "data" array, skip`);
    return { ok: false, removed: 0 };
  }

  const before = data.length;
  const deduped = deduplicateData(data);
  const after = deduped.length;
  const removed = before - after;

  if (removed === 0) {
    return { ok: true, removed: 0 };
  }

  json.data = deduped;
  if (typeof json.totalRecords === 'number') json.totalRecords = deduped.length;

  try {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
  } catch (e) {
    console.error(`   ❌ Write error: ${e.message}`);
    return { ok: false, removed };
  }

  return { ok: true, removed };
}

function main() {
  const dirArg = process.argv[2];
  const useDist = process.argv[3] === 'dist';
  const root = useDist ? path.join(__dirname, '..', 'dist', 'data') : DATA_ROOT;
  const dirs = dirArg ? [dirArg] : DEFAULT_DIRS;
  const rootLabel = useDist ? 'dist/data' : 'data';

  console.log('🧹 Deduplicating Business Review JSON files (by timestamp + adKind)\n');
  if (dirArg) {
    console.log(`   Target: ${rootLabel}/${dirArg}\n`);
  } else {
    console.log(`   Targets: ${dirs.map((d) => `${rootLabel}/${d}`).join(', ')}\n`);
  }

  let totalFiles = 0;
  let totalRemoved = 0;

  for (const dir of dirs) {
    const dirPath = path.join(root, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`⏭️  ${dirPath} not found, skip`);
      continue;
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.startsWith('business-review-') && f.endsWith('.json'));
    if (files.length === 0) {
      console.log(`⏭️  No business-review-*.json in ${rootLabel}/${dir}`);
      continue;
    }

    console.log(`📁 ${rootLabel}/${dir} (${files.length} file(s))`);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const { removed } = processFile(filePath);
      if (removed > 0) {
        console.log(`   ✅ ${file}: removed ${removed} duplicate(s)`);
        totalRemoved += removed;
      }
      totalFiles += 1;
    }
    console.log('');
  }

  console.log('📊 Summary:');
  console.log(`   Files scanned: ${totalFiles}`);
  console.log(`   Duplicate rows removed: ${totalRemoved}`);
  console.log('\n✅ Done.');
}

main();
