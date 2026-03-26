/**
 * Update all realms for January 2026
 */
import { execSync } from 'child_process';
import fetch from 'node-fetch';

const AUTH_TOKEN = process.argv[2] || 'c93f70daff2497e0535e9ed2dd4a9e06';
const MONTH = '2026-01';

async function updateAllRealms() {
  console.log('🚀 Fetching realm IDs from API...');
  
  const payload = {
    Filters: [],
    From: 0,
    Order: [{ Field: 'UpdatedAt', Operator: 'desc' }],
    Size: 1000
  };

  const response = await fetch('https://back.platform.gcp.omnitagjs.com/bo-api/realms/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ayl-auth-token': AUTH_TOKEN
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  const realms = Array.isArray(data) ? data : (data.Data || []);
  const realmIds = realms.map(r => r.Uid || r.uid || r.id || r.Id).filter(Boolean);

  console.log(`📊 Found ${realmIds.length} realms`);
  console.log(`📅 Updating for: ${MONTH}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < realmIds.length; i++) {
    const realmId = realmIds[i];
    console.log(`\n[${i + 1}/${realmIds.length}] Processing realm: ${realmId}`);
    
    try {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      execSync(
        `node data/REALM/fetchRealmBusinessReviewData.js "${AUTH_TOKEN}" "${realmId}" "${MONTH}"`,
        { stdio: 'inherit', encoding: 'utf8' }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Failed for realm ${realmId}`);
      errorCount++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ MISE À JOUR TERMINÉE');
  console.log(`   ✅ Successful: ${successCount}/${realmIds.length}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`${'='.repeat(80)}`);
}

updateAllRealms()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
