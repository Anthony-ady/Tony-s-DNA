/**
 * Script to enrich placement-broker-mapping.json with realmId
 * 
 * This script reads placement-broker-mapping.json and for each placementId,
 * fetches the placement data from the API to extract the realmId.
 * 
 * Usage:
 *   node scripts/enrichPlacementBrokerMapping.js <AUTH_TOKEN> [limit]
 * 
 * où:
 *   - <AUTH_TOKEN> : votre token d'authentification
 *   - [limit]      : nombre de placements à traiter (optionnel, pour les tests)
 * 
 * Le script met à jour le fichier:
 *   src/pages/Broker/placement-broker-mapping.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE_URL = 'https://back.platform.gcp.omnitagjs.com/bo-api/placements';
const MAPPING_FILE = path.join(__dirname, '../src/pages/Broker/placement-broker-mapping.json');

// Get auth token from command line argument
const AUTH_TOKEN = process.argv[2];
const LIMIT = process.argv[3] ? parseInt(process.argv[3], 10) : null;

if (!AUTH_TOKEN) {
  console.error('❌ Error: Auth token est requis');
  console.log('Usage: node scripts/enrichPlacementBrokerMapping.js <auth_token> [limit]');
  console.log('Exemple: node scripts/enrichPlacementBrokerMapping.js TOKEN 3');
  process.exit(1);
}

/**
 * Fetch placement data from API
 */
async function fetchPlacementData(placementId) {
  const url = `${API_BASE_URL}/${placementId}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-ayl-auth-token': AUTH_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract realmId from Data.Realm.Uid
    const realmId = data?.Data?.Realm?.Uid;
    
    if (!realmId) {
      console.warn(`   ⚠️  No realmId found for placement ${placementId}`);
      return null;
    }
    
    return realmId;
  } catch (error) {
    console.error(`   ❌ Error fetching placement ${placementId}: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting enrichment of placement-broker-mapping.json...\n');
  
  // Read the mapping file
  if (!fs.existsSync(MAPPING_FILE)) {
    console.error(`❌ Error: File not found: ${MAPPING_FILE}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(MAPPING_FILE, 'utf8');
  let mappings;
  
  try {
    mappings = JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Error parsing JSON file: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(mappings)) {
    console.error('❌ Error: JSON file should contain an array');
    process.exit(1);
  }

  console.log(`📋 Found ${mappings.length} placements in the file`);
  
  // Determine how many to process
  const placementsToProcess = LIMIT ? mappings.slice(0, LIMIT) : mappings;
  const totalToProcess = placementsToProcess.length;
  
  if (LIMIT) {
    console.log(`🧪 Test mode: Processing only ${totalToProcess} placements\n`);
  } else {
    console.log(`🔄 Processing all ${totalToProcess} placements\n`);
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Process each placement
  for (let i = 0; i < placementsToProcess.length; i++) {
    const mapping = placementsToProcess[i];
    const placementId = mapping.placementId;
    
    // Skip if realmId already exists
    if (mapping.realmId) {
      console.log(`[${i + 1}/${totalToProcess}] ⏭️  Placement ${placementId} already has realmId: ${mapping.realmId}`);
      skipCount++;
      continue;
    }

    console.log(`[${i + 1}/${totalToProcess}] 🔍 Fetching realmId for placement ${placementId}...`);
    
    const realmId = await fetchPlacementData(placementId);
    
    if (realmId) {
      mapping.realmId = realmId;
      console.log(`   ✅ Found realmId: ${realmId}`);
      successCount++;
    } else {
      errorCount++;
    }

    // Add a small delay to avoid rate limiting
    if (i < placementsToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Save the updated file
  console.log('\n💾 Saving updated file...');
  
  try {
    // Format JSON with 2-space indentation
    const updatedContent = JSON.stringify(mappings, null, 2);
    fs.writeFileSync(MAPPING_FILE, updatedContent, 'utf8');
    console.log('✅ File saved successfully!\n');
  } catch (error) {
    console.error(`❌ Error saving file: ${error.message}`);
    process.exit(1);
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   ✅ Successfully enriched: ${successCount}`);
  console.log(`   ⏭️  Skipped (already had realmId): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total processed: ${totalToProcess}`);
  
  if (LIMIT && totalToProcess < mappings.length) {
    console.log(`\n💡 Note: Only ${LIMIT} placements were processed (test mode).`);
    console.log(`   Run without limit to process all ${mappings.length} placements.`);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

