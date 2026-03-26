/**
 * Script pour mettre à jour les données Business Review d'un realm spécifique
 * 
 * Ce script :
 * 1. Détecte la dernière date enregistrée dans le fichier JSON du realm
 * 2. Met à jour les données depuis cette date jusqu'à aujourd'hui
 * 
 * Usage:
 *   node scripts/updateRealmBusinessReviewData.js <AUTH_TOKEN> <REALM_ID>
 * 
 * Or set AUTH_TOKEN environment variable:
 *   AUTH_TOKEN=your_token node scripts/updateRealmBusinessReviewData.js <REALM_ID>
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get auth token and realm ID from command line
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;
const REALM_ID = process.argv[3] || process.argv[2]; // If only one arg, it's the realm ID

if (!AUTH_TOKEN) {
  console.error('❌ Error: Auth token is required');
  console.log('Usage: node scripts/updateRealmBusinessReviewData.js <auth_token> <realm_id>');
  console.log('Or: AUTH_TOKEN=your_token node scripts/updateRealmBusinessReviewData.js <realm_id>');
  process.exit(1);
}

if (!REALM_ID) {
  console.error('❌ Error: Realm ID is required');
  console.log('Usage: node scripts/updateRealmBusinessReviewData.js <auth_token> <realm_id>');
  process.exit(1);
}

// Paths
const REALM_DIR = path.join(__dirname, '..', 'data', 'REALM');
const FETCH_SCRIPT = path.join(REALM_DIR, 'fetchRealmBusinessReviewData.js');

console.log('🚀 Mise à jour des données Business Review pour un realm');
console.log(`📊 Realm ID: ${REALM_ID}`);
console.log(`🔑 Token: ${AUTH_TOKEN.substring(0, 8)}...`);
console.log(`📅 Date actuelle: ${new Date().toISOString().split('T')[0]}`);

try {
  // Call the fetch script without date parameter for auto-detection
  // The script will automatically detect the last date and update from there
  console.log(`\n📡 Appel du script de récupération...`);
  
  execSync(
    `node "${FETCH_SCRIPT}" "${AUTH_TOKEN}" "${REALM_ID}"`,
    { stdio: 'inherit', encoding: 'utf8' }
  );
  
  console.log(`\n✅ Mise à jour terminée avec succès pour le realm ${REALM_ID}`);
} catch (error) {
  console.error(`\n❌ Erreur lors de la mise à jour:`, error.message);
  process.exit(1);
}

