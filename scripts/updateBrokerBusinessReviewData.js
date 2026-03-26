/**
 * Script pour mettre à jour les données Business Review d'un broker spécifique
 * 
 * Ce script :
 * 1. Détecte la dernière date enregistrée dans le fichier JSON du broker
 * 2. Met à jour les données depuis cette date jusqu'à aujourd'hui
 * 
 * Usage:
 *   node scripts/updateBrokerBusinessReviewData.js <AUTH_TOKEN> <BROKER_ID>
 * 
 * Or set AUTH_TOKEN environment variable:
 *   AUTH_TOKEN=your_token node scripts/updateBrokerBusinessReviewData.js <BROKER_ID>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_ENDPOINT = 'https://back.platform.gcp.omnitagjs.com/bo-api/druid/search';
const BROKER_ID = process.argv[3] || process.argv[2]; // If only one arg, it's the broker ID
const METRICS = [
  'network_operations_bid_requests',
  'network_operations_bid_responses',
  'network_operations_impressions',
  'network_operations_price_publisher',
  'network_operations_price_advertiser',
  'network_operations_click',
];
const DIMENSIONS = ['adKind'];

// Get auth token from command line argument or environment variable
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;

if (!AUTH_TOKEN || !BROKER_ID) {
  console.error('❌ Error: Auth token et BROKER_ID sont requis');
  console.log('Usage: node scripts/updateBrokerBusinessReviewData.js <auth_token> <broker_id>');
  console.log('Or: AUTH_TOKEN=your_token node scripts/updateBrokerBusinessReviewData.js <broker_id>');
  process.exit(1);
}

/**
 * Resolve brokerId to realmId using the mapping file
 */
function resolveBrokerToRealm(brokerId) {
  const mappingPath = path.join(__dirname, '..', 'src', 'pages', 'Broker', 'placement-broker-mapping.json');
  
  if (!fs.existsSync(mappingPath)) {
    console.error(`❌ Error: Mapping file not found: ${mappingPath}`);
    return null;
  }

  try {
    const mappingContent = fs.readFileSync(mappingPath, 'utf8');
    const mapping = JSON.parse(mappingContent);
    
    // Find the first entry with this brokerId
    const entry = mapping.find(item => item.brokerId === brokerId);
    
    if (!entry || !entry.realmId) {
      console.error(`❌ Error: No realmId found for brokerId: ${brokerId}`);
      return null;
    }
    
    return entry.realmId;
  } catch (error) {
    console.error(`❌ Error reading mapping file:`, error.message);
    return null;
  }
}

// Resolve brokerId to realmId
const REALM_ID = resolveBrokerToRealm(BROKER_ID);
if (!REALM_ID) {
  console.error(`❌ Failed to resolve brokerId ${BROKER_ID} to realmId`);
  process.exit(1);
}

console.log(`📊 Broker ID: ${BROKER_ID}`);
console.log(`🔗 Resolved to Realm ID: ${REALM_ID}`);

// Output directory
const BROKER_DIR = path.join(__dirname, '..', 'data', 'BROKER');
if (!fs.existsSync(BROKER_DIR)) {
  fs.mkdirSync(BROKER_DIR, { recursive: true });
}

/**
 * Generate date ranges by month from start date to end date
 */
function generateMonthlyRanges(startDate, endDate) {
  const ranges = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);

    const rangeEnd = monthEnd > end ? end : monthEnd;

    ranges.push({
      start: new Date(monthStart),
      end: new Date(rangeEnd),
    });

    current.setMonth(current.getMonth() + 1);
    current.setDate(1);
  }

  return ranges;
}

/**
 * Format date to ISO string for API
 */
function formatDateForAPI(date) {
  return date.toISOString();
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
 * Make API request for a specific date range
 */
async function fetchDataForRange(startDate, endDate, index, total) {
  const payload = {
    Datasource: 'network_operations',
    Metrics: METRICS,
    Dimensions: DIMENSIONS,
    Filters: {
      realmId: {
        Value: [REALM_ID],
        Operator: 'in',
      },
    },
    Granularity: {
      type: 'period',
      period: 'P1D',
    },
    Intervals: [
      {
        Begin: formatDateForAPI(startDate),
        End: formatDateForAPI(endDate),
      },
    ],
    TimeZone: 'Etc/GMT',
    Size: 1000,
  };

  console.log(`\n📅 Fetching data for range ${index + 1}/${total}`);
  console.log(`   From: ${startDate.toISOString().split('T')[0]}`);
  console.log(`   To:   ${endDate.toISOString().split('T')[0]}`);

  try {
    const payloadStr = JSON.stringify(payload).replace(/"/g, '\\"');
    const curlCmd =
      `curl -s -k -X POST "${API_ENDPOINT}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "x-ayl-auth-token: ${AUTH_TOKEN}" ` +
      `-d "${payloadStr}"`;

    const stdout = execSync(curlCmd, { encoding: 'utf8' });

    let data;
    try {
      data = JSON.parse(stdout);
    } catch (parseError) {
      console.error('   ❌ Failed to parse JSON response from API');
      console.error('   Raw response (truncated to 500 chars):', stdout.slice(0, 500));
      throw parseError;
    }

    const dataArray = Array.isArray(data?.Data)
      ? data.Data
      : Array.isArray(data)
      ? data
      : [];

    console.log(`   ✅ Retrieved ${dataArray.length} records`);
    return dataArray;
  } catch (error) {
    console.error('   ❌ Error fetching data:', error.message);
    throw error;
  }
}

/**
 * Read existing data from file
 */
function readExistingData() {
  const outputFile = path.join(BROKER_DIR, `business-review-${BROKER_ID}.json`);

  if (!fs.existsSync(outputFile)) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(outputFile, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('⚠️  Error reading existing file:', error.message);
    return null;
  }
}

/**
 * Get the last date from existing data file
 */
function getLastDateFromFile() {
  const outputFile = path.join(BROKER_DIR, `business-review-${BROKER_ID}.json`);

  if (!fs.existsSync(outputFile)) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(outputFile, 'utf8');
    const existingData = JSON.parse(fileContent);

    if (!existingData.data || existingData.data.length === 0) {
      return null;
    }

    let lastDate = null;
    existingData.data.forEach((item) => {
      if (item.timestamp) {
        const date = normalizeTimestamp(item.timestamp);
        if (date && (!lastDate || date > lastDate)) {
          lastDate = date;
        }
      }
    });

    return lastDate;
  } catch (error) {
    console.error('⚠️  Error reading existing file:', error.message);
    return null;
  }
}

/**
 * Main function
 */
async function fetchAllData() {
  console.log('🚀 Starting BROKER Business Review data fetch');
  console.log(`📊 Broker ID: ${BROKER_ID}`);
  console.log(`🔗 Realm ID: ${REALM_ID}`);
  console.log(`📈 Metrics: ${METRICS.join(', ')}`);
  console.log(`🔍 Dimensions: ${DIMENSIONS.join(', ')}`);

  const existingData = readExistingData();

  // Check for last date and determine date range
  const lastDate = getLastDateFromFile();
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  let startDate;
  if (lastDate && !isNaN(lastDate.getTime())) {
    // Start from the day after the last date
    startDate = new Date(lastDate);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    startDate.setUTCHours(0, 0, 0, 0);

    // Check if we're already up to date
    const lastDateOnly = new Date(
      Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate())
    );
    const todayOnly = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );

    if (lastDateOnly >= todayOnly) {
      console.log('\n✅ Data is already up to date!');
      console.log(`   Last date in file: ${lastDate.toISOString().split('T')[0]}`);
      console.log(`   Today: ${today.toISOString().split('T')[0]}`);
      return;
    }

    console.log(`\n📂 Found existing data file`);
    console.log(`   Last date in file: ${lastDate.toISOString().split('T')[0]}`);
    console.log(`   Starting from: ${startDate.toISOString().split('T')[0]}`);
  } else {
    // No existing data, start from November 2023
    startDate = new Date(Date.UTC(2023, 10, 1, 0, 0, 0, 0)); // November 1st, 2023
    console.log(`\n📂 No existing data found, starting from November 2023`);
  }

  const endDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999)
  );

  console.log(
    `📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
  );

  const ranges = generateMonthlyRanges(startDate, endDate);
  console.log(`📦 Total ranges to process: ${ranges.length}`);

  const allData = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    try {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const rangeData = await fetchDataForRange(range.start, range.end, i, ranges.length);
      allData.push(...rangeData);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to fetch data for range ${i + 1}:`, error.message);
      errorCount++;
    }
  }

  let finalData = allData;
  let existingRecordsCount = 0;

  if (existingData && existingData.data && existingData.data.length > 0) {
    existingRecordsCount = existingData.data.length;
    finalData = [...existingData.data, ...allData];
    console.log('\n📊 Merging data:');
    console.log(`   Existing records: ${existingRecordsCount}`);
    console.log(`   New records:      ${allData.length}`);
  }

  const outputData = {
    brokerId: BROKER_ID,
    metrics: METRICS,
    dimensions: DIMENSIONS,
    totalRecords: finalData.length,
    fetchedAt: existingData?.fetchedAt || new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    data: finalData,
  };

  const outputFile = path.join(BROKER_DIR, `business-review-${BROKER_ID}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');

  console.log('\n✅ Data fetch completed!');
  console.log(`   📊 Total records in file: ${finalData.length}`);
  console.log(`   📊 New records added:     ${allData.length}`);
  if (existingRecordsCount > 0) {
    console.log(`   📊 Previous records:      ${existingRecordsCount}`);
  }
  console.log(`   ✅ Successful ranges:     ${successCount}`);
  console.log(`   ❌ Failed ranges:         ${errorCount}`);
  console.log(`   💾 Saved to: ${outputFile}`);

  return outputData;
}

fetchAllData()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

