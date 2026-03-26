/**
 * Script pour mettre à jour les données Business Review de plusieurs brokers
 * 
 * Usage:
 *   node scripts/updateMultipleBrokersBusinessReviewData.js <AUTH_TOKEN> <BROKER_ID1> <BROKER_ID2> <BROKER_ID3>
 * 
 * Or set AUTH_TOKEN environment variable:
 *   AUTH_TOKEN=your_token node scripts/updateMultipleBrokersBusinessReviewData.js <BROKER_ID1> <BROKER_ID2> <BROKER_ID3>
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get auth token and broker IDs from command line
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;
const brokerIds = process.argv.slice(3);

if (!AUTH_TOKEN) {
  console.error('❌ Error: Auth token is required');
  console.log('Usage: node scripts/updateMultipleBrokersBusinessReviewData.js <auth_token> <broker_id1> <broker_id2> <broker_id3>');
  console.log('Or: AUTH_TOKEN=your_token node scripts/updateMultipleBrokersBusinessReviewData.js <broker_id1> <broker_id2> <broker_id3>');
  process.exit(1);
}

if (brokerIds.length === 0) {
  console.error('❌ Error: At least one broker ID is required');
  console.log('Usage: node scripts/updateMultipleBrokersBusinessReviewData.js <auth_token> <broker_id1> [broker_id2] [broker_id3]');
  process.exit(1);
}

// Limit to 3 brokers
const brokersToProcess = brokerIds.slice(0, 3);
if (brokerIds.length > 3) {
  console.log(`⚠️  Limiting to first 3 brokers (${brokerIds.length} provided)`);
}

// Paths
const UPDATE_SCRIPT = path.join(__dirname, 'updateBrokerBusinessReviewData.js');

console.log('🚀 Mise à jour des données Business Review pour plusieurs brokers');
console.log(`📊 Nombre de brokers: ${brokersToProcess.length}`);
console.log(`🔑 Token: ${AUTH_TOKEN.substring(0, 8)}...`);
console.log(`📅 Date actuelle: ${new Date().toISOString().split('T')[0]}`);

const results = {
  success: 0,
  failed: 0,
  total: brokersToProcess.length
};

for (let i = 0; i < brokersToProcess.length; i++) {
  const brokerId = brokersToProcess[i];
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Traitement du broker ${i + 1}/${brokersToProcess.length}: ${brokerId}`);
  console.log(`${'='.repeat(80)}`);

  try {
    execSync(
      `node "${UPDATE_SCRIPT}" "${AUTH_TOKEN}" "${brokerId}"`,
      { stdio: 'inherit', encoding: 'utf8' }
    );
    results.success++;
    console.log(`✅ Broker ${i + 1}/${brokersToProcess.length} terminé avec succès`);
  } catch (error) {
    results.failed++;
    console.error(`❌ Erreur lors du traitement du broker ${brokerId}:`, error.message);
  }

  // Wait between brokers
  if (i < brokersToProcess.length - 1) {
    console.log(`\n⏳ Attente de 2 secondes avant le prochain broker...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

console.log(`\n${'='.repeat(80)}`);
console.log('📊 RÉSUMÉ');
console.log(`${'='.repeat(80)}`);
console.log(`   Total: ${results.total}`);
console.log(`   ✅ Réussis: ${results.success}`);
console.log(`   ❌ Échoués: ${results.failed}`);
console.log(`${'='.repeat(80)}`);

process.exit(results.failed > 0 ? 1 : 0);

