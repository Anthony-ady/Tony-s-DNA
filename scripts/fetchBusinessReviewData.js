/**
 * Script to fetch Business Review data from network_operations API
 * 
 * This script fetches data for a specific partner ID from January 1st to today,
 * making sequential requests by month to avoid large API calls.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_ENDPOINT = "https://back.platform.gcp.omnitagjs.com/bo-api/druid/search";
const PARTNER_ID = "2a62ca3297af454b8f19eb7922ed945f"; // Test partner ID
const METRICS = [
  "network_operations_bid_requests",
  "network_operations_bid_responses",
  "network_operations_impressions",
  "network_operations_price_publisher",
  "network_operations_price_advertiser",
  "network_operations_click"
];
const DIMENSIONS = ["adKind"];

// Get auth token from command line argument or environment variable
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('❌ Error: Auth token is required');
  console.log('Usage: node scripts/fetchBusinessReviewData.js <auth_token>');
  console.log('Or set AUTH_TOKEN environment variable');
  process.exit(1);
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
    
    // Adjust if monthEnd exceeds endDate
    const rangeEnd = monthEnd > end ? end : monthEnd;
    
    ranges.push({
      start: new Date(monthStart),
      end: new Date(rangeEnd)
    });
    
    // Move to next month
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
 * Make API request for a specific date range
 */
async function fetchDataForRange(startDate, endDate, monthIndex, totalMonths) {
  const payload = {
    "Datasource": "network_operations",
    "Metrics": METRICS,
    "Dimensions": DIMENSIONS,
    "Filters": {
      "partnerId": {
        "Value": [PARTNER_ID],
        "Operator": "in"
      }
    },
    "Granularity": {
      "type": "period",
      "period": "P1D" // Daily granularity (one day per record)
    },
    "Intervals": [{
      "Begin": formatDateForAPI(startDate),
      "End": formatDateForAPI(endDate)
    }],
    "TimeZone": "Etc/GMT",
    "Size": 1000
  };

  console.log(`\n📅 Fetching data for month ${monthIndex + 1}/${totalMonths}`);
  console.log(`   From: ${startDate.toISOString().split('T')[0]}`);
  console.log(`   To: ${endDate.toISOString().split('T')[0]}`);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ayl-auth-token": AUTH_TOKEN
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    const dataArray = Array.isArray(data?.Data) ? data.Data : Array.isArray(data) ? data : [];
    
    console.log(`   ✅ Retrieved ${dataArray.length} records`);
    
    return dataArray;
  } catch (error) {
    console.error(`   ❌ Error fetching data:`, error.message);
    throw error;
  }
}

/**
 * Read existing data file and get the last date
 */
function getLastDateFromFile() {
  const outputDir = path.join(__dirname, '..', 'data', 'DSP');
  const outputFile = path.join(outputDir, `business-review-${PARTNER_ID}.json`);
  
  if (!fs.existsSync(outputFile)) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(outputFile, 'utf8');
    const existingData = JSON.parse(fileContent);
    
    if (!existingData.data || existingData.data.length === 0) {
      return null;
    }

    // Find the latest timestamp in the data
    let lastDate = null;
    existingData.data.forEach(item => {
      if (item.timestamp) {
        try {
          // Handle different timestamp formats
          let timestampStr = item.timestamp;
          // Remove extra .000000 if present
          timestampStr = timestampStr.replace(/\.\d{6}/g, '');
          // Ensure it ends with Z if not already
          if (!timestampStr.endsWith('Z') && !timestampStr.includes('+')) {
            timestampStr += 'Z';
          }
          const itemDate = new Date(timestampStr);
          if (!isNaN(itemDate.getTime()) && (!lastDate || itemDate > lastDate)) {
            lastDate = itemDate;
          }
        } catch (e) {
          // Skip invalid dates
          console.warn('⚠️  Invalid timestamp:', item.timestamp);
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
 * Read existing data from file
 */
function readExistingData() {
  const outputDir = path.join(__dirname, '..', 'data', 'DSP');
  const outputFile = path.join(outputDir, `business-review-${PARTNER_ID}.json`);
  
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
 * Main function to fetch all data
 */
async function fetchAllData() {
  console.log('🚀 Starting Business Review data fetch');
  console.log(`📊 Partner ID: ${PARTNER_ID}`);
  console.log(`📈 Metrics: ${METRICS.join(', ')}`);
  console.log(`🔍 Dimensions: ${DIMENSIONS.join(', ')}`);

  // Check for existing data
  const existingData = readExistingData();
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
    const lastDateOnly = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
    const todayOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    
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

  const endDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999));

  console.log(`📅 Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  // Generate monthly ranges from start date to today
  const monthlyRanges = generateMonthlyRanges(startDate, endDate);
  console.log(`📦 Total months to process: ${monthlyRanges.length}`);

  const allData = [];
  let successCount = 0;
  let errorCount = 0;

  // Fetch data sequentially (one month at a time)
  for (let i = 0; i < monthlyRanges.length; i++) {
    const range = monthlyRanges[i];
    
    try {
      // Wait a bit between requests to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }

      const monthData = await fetchDataForRange(range.start, range.end, i, monthlyRanges.length);
      allData.push(...monthData);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to fetch data for month ${i + 1}:`, error.message);
      errorCount++;
      // Continue with next month even if one fails
    }
  }

  // Merge with existing data if it exists
  let finalData = allData;
  let existingRecordsCount = 0;
  
  if (existingData && existingData.data && existingData.data.length > 0) {
    existingRecordsCount = existingData.data.length;
    // Merge: existing data + new data
    finalData = [...existingData.data, ...allData];
    console.log(`\n📊 Merging data:`);
    console.log(`   Existing records: ${existingRecordsCount}`);
    console.log(`   New records: ${allData.length}`);
  }

  // Prepare output data
  const outputData = {
    partnerId: PARTNER_ID,
    dateRange: {
      start: existingData?.dateRange?.start || startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    },
    metrics: METRICS,
    dimensions: DIMENSIONS,
    totalRecords: finalData.length,
    fetchedAt: existingData?.fetchedAt || new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    data: finalData
  };

  // Save to JSON file
  const outputDir = path.join(__dirname, '..', 'data', 'DSP');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, `business-review-${PARTNER_ID}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');

  console.log('\n✅ Data fetch completed!');
  console.log(`   📊 Total records in file: ${finalData.length}`);
  console.log(`   📊 New records added: ${allData.length}`);
  if (existingRecordsCount > 0) {
    console.log(`   📊 Previous records: ${existingRecordsCount}`);
  }
  console.log(`   ✅ Successful months: ${successCount}`);
  console.log(`   ❌ Failed months: ${errorCount}`);
  console.log(`   💾 Saved to: ${outputFile}`);

  return outputData;
}

// Run the script
fetchAllData()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

