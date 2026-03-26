/**
 * Script master pour mettre à jour toutes les données Business Review
 * 
 * Ce script met à jour automatiquement :
 * - DSP (tous les partenaires)
 * - REALM (tous les realms)
 * - DEAL (tous les deals)
 * - COMPANY (toutes les companies)
 * - General (données générales)
 * 
 * Pour chaque type, le script :
 * 1. Détecte la dernière date enregistrée
 * 2. Met à jour jusqu'à la date du jour
 * 
 * Usage:
 *   node scripts/updateAllBusinessReviewData.js <AUTH_TOKEN> [phase]
 *
 * phase optionnelle : all (défaut) | dsp | realm | deal | company | general
 *
 * Or set AUTH_TOKEN environment variable:
 *   AUTH_TOKEN=your_token node scripts/updateAllBusinessReviewData.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {number} */
let jobStartTime = 0;

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/**
 * Affiche une ligne de statut lisible dans le terminal : phase globale, sous-tâche, %, barre, durée.
 */
function printPhaseStatus({ phase, phaseNum, label, current, total, entityId }) {
  const elapsed = (Date.now() - jobStartTime) / 1000;
  const pct = total > 0 ? ((current / total) * 100).toFixed(1) : '0';
  const barLen = 24;
  const filled = total > 0 ? Math.min(barLen, Math.round((current / total) * barLen)) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
  console.log('\n' + '─'.repeat(78));
  console.log(`📊 STATUS  [${phaseNum}/5] ${phase}  |  ${label}  ${current}/${total} (${pct}%)`);
  console.log(`   ${bar}`);
  if (entityId) console.log(`   └─ ${entityId}`);
  console.log(`   ⏱️  écoulé: ${formatDuration(elapsed)}`);
  console.log('─'.repeat(78) + '\n');
}

function printPipelineBanner() {
  console.log('\n' + '═'.repeat(78));
  console.log('  Pipeline Business Review  —  [1] DSP  →  [2] REALM  →  [3] DEAL  →  [4] COMPANY  →  [5] GENERAL');
  console.log('═'.repeat(78) + '\n');
}

// Get auth token from command line or environment variable
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('❌ Error: Auth token is required');
  console.log('Usage: node scripts/updateAllBusinessReviewData.js <auth_token> [dsp|realm|deal|company|general|all]');
  console.log('Or set AUTH_TOKEN environment variable');
  process.exit(1);
}

const PHASE = (process.argv[3] || 'all').toLowerCase();
const VALID_PHASES = new Set(['all', 'dsp', 'realm', 'deal', 'company', 'general']);
if (!VALID_PHASES.has(PHASE)) {
  console.error(`❌ Error: phase inconnue "${process.argv[3]}" (attendu: all, dsp, realm, deal, company, general)`);
  process.exit(1);
}

/** @param {'dsp'|'realm'|'deal'|'company'|'general'} name */
function shouldRunPhase(name) {
  return PHASE === 'all' || PHASE === name;
}

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const DSP_DIR = path.join(DATA_DIR, 'DSP');
const REALM_DIR = path.join(DATA_DIR, 'REALM');
const DEAL_DIR = path.join(DATA_DIR, 'DEAL');
const COMPANY_DIR = path.join(DATA_DIR, 'COMPANY');

// API endpoints for fetching entity lists
const API_BASE = 'https://back.platform.gcp.omnitagjs.com/bo-api';
const PARTNERS_API = `${API_BASE}/partners/search`;
const REALMS_API = `${API_BASE}/realms/search`;
const DEALS_API = `${API_BASE}/deals/search`;
const COMPANIES_API = `${API_BASE}/companies/search`;

/**
 * Fetch entity IDs from API
 */
async function fetchIdsFromAPI(apiEndpoint, entityType) {
  try {
    // All search APIs use POST with a body
    const payload = {
      Filters: [],
      From: 0,
      Order: [{ Field: "UpdatedAt", Operator: "desc" }],
      Size: 1000 // Get up to 1000 entities
    };

    const response = await fetch(apiEndpoint, {
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
    
    // Handle different response formats
    let entities = [];
    if (Array.isArray(data)) {
      entities = data;
    } else if (data.Data && Array.isArray(data.Data)) {
      entities = data.Data;
    } else if (data.data && Array.isArray(data.data)) {
      entities = data.data;
    } else if (data.items && Array.isArray(data.items)) {
      entities = data.items;
    } else {
      console.warn(`⚠️  Unexpected response format for ${entityType}`);
      return [];
    }

    // Extract ID field from each entity
    // For DEAL, use DealId; for others, use Uid
    const ids = entities
      .map(entity => {
        if (entityType === 'deals') {
          return entity.DealId || entity.dealId || entity.Uid || entity.uid || entity.id || entity.Id;
        } else {
          return entity.Uid || entity.uid || entity.id || entity.Id;
        }
      })
      .filter(id => id);

    return ids;
  } catch (error) {
    console.error(`❌ Error fetching ${entityType} IDs from API:`, error.message);
    return null;
  }
}

/**
 * Normalize timestamp format
 */
function normalizeTimestamp(timestamp) {
  if (!timestamp) return null;
  try {
    let normalized = timestamp.toString().trim();
    normalized = normalized.replace(/\.\d{6}/g, '');
    if (!normalized.endsWith('Z') && !normalized.includes('+')) {
      normalized += 'Z';
    }
    const date = new Date(normalized);
    return !isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Get the last date from a JSON file
 */
function getLastDateFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      return null;
    }

    let lastDate = null;
    data.data.forEach(item => {
      if (item.timestamp) {
        const date = normalizeTimestamp(item.timestamp);
        if (date && (!lastDate || date > lastDate)) {
          lastDate = date;
        }
      }
    });

    return lastDate;
  } catch (error) {
    return null;
  }
}

/**
 * Get date range string from last date to today
 * Returns null if already up to date or if no last date (script will use default)
 * Returns date range string if update needed from last date
 */
function getDateRangeString(lastDate) {
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  
  if (!lastDate || isNaN(lastDate.getTime())) {
    // No last date - return null to let script use default logic (fetch from beginning)
    return null;
  }

  const startDate = new Date(lastDate);
  startDate.setUTCDate(startDate.getUTCDate() + 1);
  startDate.setUTCHours(0, 0, 0, 0);

  // Check if we're already up to date
  const lastDateOnly = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
  const todayOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  
  if (lastDateOnly >= todayOnly) {
    return null; // Already up to date
  }

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = today.toISOString().split('T')[0];
  
  return `${startStr},${endStr}`;
}

/**
 * Update all DSP partners
 */
async function updateDSP() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔄 MISE À JOUR DSP');
  console.log(`${'='.repeat(80)}`);

  console.log('📡 Fetching partner IDs from API...');
  let partnerIds = await fetchIdsFromAPI(PARTNERS_API, 'partners');

  if (!partnerIds || partnerIds.length === 0) {
    console.log(`⚠️  No partner IDs found from API!`);
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`📊 Found ${partnerIds.length} partners from API`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < partnerIds.length; i++) {
    const partnerId = partnerIds[i];
    printPhaseStatus({
      phase: 'DSP',
      phaseNum: 1,
      label: 'partenaire',
      current: i + 1,
      total: partnerIds.length,
      entityId: partnerId
    });
    
    try {
      // Wait between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Call script without date parameter for auto-detection
      execSync(
        `node "${path.join(DSP_DIR, 'fetchBusinessReviewData.js')}" "${AUTH_TOKEN}" "${partnerId}"`,
        { stdio: 'inherit', encoding: 'utf8' }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to fetch data for partner ${partnerId}`);
      errorCount++;
    }
  }

  console.log(`\n✅ DSP update completed!`);
  console.log(`   ✅ Successful: ${successCount}/${partnerIds.length}`);
  console.log(`   ❌ Failed: ${errorCount}`);

  return { success: successCount, failed: errorCount, total: partnerIds.length };
}

/**
 * Update all REALM
 */
async function updateREALM() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔄 MISE À JOUR REALM');
  console.log(`${'='.repeat(80)}`);

  console.log('📡 Fetching realm IDs from API...');
  let realmIds = await fetchIdsFromAPI(REALMS_API, 'realms');

  if (!realmIds || realmIds.length === 0) {
    console.log(`⚠️  No realm IDs found from API!`);
    return { success: 0, failed: 0, skipped: 0, total: 0 };
  }

  console.log(`📊 Found ${realmIds.length} realms from API`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < realmIds.length; i++) {
    const realmId = realmIds[i];
    const filePath = path.join(REALM_DIR, `business-review-${realmId}.json`);
    const lastDate = getLastDateFromFile(filePath);
    const dateRange = getDateRangeString(lastDate);

    if (!dateRange) {
      if (lastDate) {
        console.log(`\n⏭️  Skipping realm ${i + 1}/${realmIds.length}: ${realmId} (already up to date)`);
        skippedCount++;
        continue;
      }
      // No date range means no last date, script will use default
    }

    printPhaseStatus({
      phase: 'REALM',
      phaseNum: 2,
      label: 'realm',
      current: i + 1,
      total: realmIds.length,
      entityId: realmId
    });
    
    try {
      // Wait between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const cmd = dateRange 
        ? `node "${path.join(REALM_DIR, 'fetchRealmBusinessReviewData.js')}" "${AUTH_TOKEN}" "${realmId}" "${dateRange}"`
        : `node "${path.join(REALM_DIR, 'fetchRealmBusinessReviewData.js')}" "${AUTH_TOKEN}" "${realmId}"`;
      
      execSync(cmd, { stdio: 'inherit', encoding: 'utf8' });
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to fetch data for realm ${realmId}`);
      errorCount++;
    }
  }

  console.log(`\n✅ REALM update completed!`);
  console.log(`   ✅ Successful: ${successCount}/${realmIds.length}`);
  console.log(`   ⏭️  Skipped (up to date): ${skippedCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);

  return { success: successCount, failed: errorCount, skipped: skippedCount, total: realmIds.length };
}

/**
 * Update all DEAL
 */
async function updateDEAL() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔄 MISE À JOUR DEAL');
  console.log(`${'='.repeat(80)}`);

  console.log('📡 Fetching deal IDs from API...');
  let dealIds = await fetchIdsFromAPI(DEALS_API, 'deals');

  if (!dealIds || dealIds.length === 0) {
    console.log(`⚠️  No deal IDs found from API!`);
    return { success: 0, failed: 0, total: 0 };
  }

  console.log(`📊 Found ${dealIds.length} deals from API`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < dealIds.length; i++) {
    const dealId = dealIds[i];
    printPhaseStatus({
      phase: 'DEAL',
      phaseNum: 3,
      label: 'deal',
      current: i + 1,
      total: dealIds.length,
      entityId: dealId
    });
    
    try {
      // Wait between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Call script without date parameter for auto-detection
      execSync(
        `node "${path.join(DEAL_DIR, 'fetchDealBusinessReviewData.js')}" "${AUTH_TOKEN}" "${dealId}"`,
        { stdio: 'inherit', encoding: 'utf8' }
      );
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to fetch data for deal ${dealId}`);
      errorCount++;
    }
  }

  console.log(`\n✅ DEAL update completed!`);
  console.log(`   ✅ Successful: ${successCount}/${dealIds.length}`);
  console.log(`   ❌ Failed: ${errorCount}`);

  return { success: successCount, failed: errorCount, total: dealIds.length };
}

/**
 * Update all COMPANY
 */
async function updateCOMPANY() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔄 MISE À JOUR COMPANY');
  console.log(`${'='.repeat(80)}`);

  console.log('📡 Fetching company IDs from API...');
  let companyIds = await fetchIdsFromAPI(COMPANIES_API, 'companies');

  if (!companyIds || companyIds.length === 0) {
    console.log(`⚠️  No company IDs found from API!`);
    return { success: 0, failed: 0, skipped: 0, total: 0 };
  }

  console.log(`📊 Found ${companyIds.length} companies from API`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < companyIds.length; i++) {
    const companyId = companyIds[i];
    const filePath = path.join(COMPANY_DIR, `business-review-${companyId}.json`);
    const lastDate = getLastDateFromFile(filePath);
    const dateRange = getDateRangeString(lastDate);

    if (!dateRange) {
      if (lastDate) {
        console.log(`\n⏭️  Skipping company ${i + 1}/${companyIds.length}: ${companyId} (already up to date)`);
        skippedCount++;
        continue;
      }
      // No date range means no last date, script will use default
    }

    printPhaseStatus({
      phase: 'COMPANY',
      phaseNum: 4,
      label: 'company',
      current: i + 1,
      total: companyIds.length,
      entityId: companyId
    });
    
    try {
      // Wait between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const cmd = dateRange 
        ? `node "${path.join(COMPANY_DIR, 'fetchCompanyBusinessReviewData.js')}" "${AUTH_TOKEN}" "${companyId}" "${dateRange}"`
        : `node "${path.join(COMPANY_DIR, 'fetchCompanyBusinessReviewData.js')}" "${AUTH_TOKEN}" "${companyId}"`;
      
      execSync(cmd, { stdio: 'inherit', encoding: 'utf8' });
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to fetch data for company ${companyId}`);
      errorCount++;
    }
  }

  console.log(`\n✅ COMPANY update completed!`);
  console.log(`   ✅ Successful: ${successCount}/${companyIds.length}`);
  console.log(`   ⏭️  Skipped (up to date): ${skippedCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);

  return { success: successCount, failed: errorCount, skipped: skippedCount, total: companyIds.length };
}

/**
 * Update General data
 */
async function updateGeneral() {
  console.log(`\n${'='.repeat(80)}`);
  console.log('🔄 MISE À JOUR GENERAL');
  console.log(`${'='.repeat(80)}`);

  printPhaseStatus({
    phase: 'GENERAL',
    phaseNum: 5,
    label: 'fichier agrégé',
    current: 1,
    total: 1,
    entityId: 'data/DSP/business-review-general.json'
  });

  try {
    // Call script without date parameter for auto-detection
    execSync(
      `node "${path.join(DSP_DIR, 'fetchGeneralBusinessReviewData.js')}" "${AUTH_TOKEN}"`,
      { stdio: 'inherit', encoding: 'utf8' }
    );
    console.log(`\n✅ General data update completed!`);
    return { success: true };
  } catch (error) {
    console.error(`\n❌ Failed to fetch general data`);
    return { success: false };
  }
}

/**
 * Main function
 */
async function updateAll() {
  jobStartTime = Date.now();
  console.log('🚀 DÉMARRAGE DE LA MISE À JOUR DE TOUTES LES DONNÉES BUSINESS REVIEW');
  console.log(`📅 Date actuelle: ${new Date().toISOString().split('T')[0]}`);
  console.log(`🔑 Token: ${AUTH_TOKEN.substring(0, 8)}...`);
  if (PHASE !== 'all') {
    console.log(`🎯 Phase seule: ${PHASE.toUpperCase()}`);
  }
  printPipelineBanner();

  const results = {
    dsp: null,
    realm: null,
    deal: null,
    company: null,
    general: null
  };

  try {
    if (shouldRunPhase('dsp')) {
      results.dsp = await updateDSP();
    }
    if (shouldRunPhase('realm')) {
      results.realm = await updateREALM();
    }
    if (shouldRunPhase('deal')) {
      results.deal = await updateDEAL();
    }
    if (shouldRunPhase('company')) {
      results.company = await updateCOMPANY();
    }
    if (shouldRunPhase('general')) {
      results.general = await updateGeneral();
    }
  } catch (error) {
    console.error('\n❌ Error during update:', error);
  }

  // Final summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 RÉSUMÉ FINAL');
  console.log(`${'='.repeat(80)}`);
  
  if (results.dsp) {
    console.log(`\n✅ DSP: ${results.dsp.success}/${results.dsp.total} réussis, ${results.dsp.failed} échoués`);
  }
  
  if (results.realm) {
    console.log(`✅ REALM: ${results.realm.success}/${results.realm.total} réussis, ${results.realm.skipped} ignorés, ${results.realm.failed} échoués`);
  }
  
  if (results.deal) {
    console.log(`✅ DEAL: ${results.deal.success}/${results.deal.total} réussis, ${results.deal.failed} échoués`);
  }
  
  if (results.company) {
    console.log(`✅ COMPANY: ${results.company.success}/${results.company.total} réussis, ${results.company.skipped} ignorés, ${results.company.failed} échoués`);
  }
  
  if (results.general) {
    console.log(`✅ General: ${results.general.success ? 'réussi' : 'échoué'}`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('🎉 MISE À JOUR TERMINÉE');
  console.log(`${'='.repeat(80)}`);
}

// Run the script
updateAll()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

