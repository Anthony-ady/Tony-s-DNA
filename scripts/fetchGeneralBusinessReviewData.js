/**
 * Script to fetch general Business Review data from network_operations API
 * This script fetches data for ALL partners (no partnerId filter)
 * 
 * Usage:
 *   node scripts/fetchGeneralBusinessReviewData.js <AUTH_TOKEN>
 * 
 * Or set AUTH_TOKEN environment variable:
 *   AUTH_TOKEN=your_token node scripts/fetchGeneralBusinessReviewData.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_ENDPOINT = "https://back.platform.gcp.omnitagjs.com/bo-api/druid/search";
const METRICS = [
  "network_operations_bid_requests",
  "network_operations_bid_responses",
  "network_operations_impressions",
  "network_operations_price_publisher",
  "network_operations_price_advertiser",
  "network_operations_click"
];
const DIMENSIONS = ["adKind"];
const GRANULARITY = { "type": "period", "period": "P1D" };
const DATASOURCE = "network_operations";

// Get auth token from command line or environment variable
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('❌ Error: AUTH_TOKEN is required');
  console.error('   Usage: node scripts/fetchGeneralBusinessReviewData.js <AUTH_TOKEN>');
  console.error('   Or: AUTH_TOKEN=your_token node scripts/fetchGeneralBusinessReviewData.js');
  process.exit(1);
}

// Output file path
const outputDir = path.join(__dirname, '..', 'data', 'DSP');
const outputFile = path.join(outputDir, 'business-review-general.json');

// Ensure data directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Format date for API (YYYY-MM-DD)
 */
function formatDateForAPI(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Generate monthly date ranges from start to end date
 */
function generateMonthlyRanges(startDate, endDate) {
  const ranges = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    
    // Adjust to actual start/end dates
    const rangeStart = monthStart < startDate ? startDate : monthStart;
    const rangeEnd = monthEnd > end ? end : monthEnd;

    ranges.push({
      start: rangeStart,
      end: rangeEnd
    });

    // Move to next month
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
  }

  return ranges;
}

/**
 * Fetch data for a specific date range
 */
async function fetchDataForRange(startDate, endDate, monthIndex, totalMonths) {
  const beginDate = startDate.toISOString();
  const endDateValue = endDate.toISOString();

  const payload = {
    "Datasource": DATASOURCE,
    "Metrics": METRICS,
    "Dimensions": DIMENSIONS,
    "Granularity": GRANULARITY,
    "Intervals": [{
      "Begin": beginDate,
      "End": endDateValue
    }],
    "TimeZone": "Etc/GMT",
    "Size": 1000
  };

  console.log(`\n📅 Fetching data for month ${monthIndex + 1}/${totalMonths}`);
  console.log(`   From: ${formatDateForAPI(startDate)}`);
  console.log(`   To: ${formatDateForAPI(endDate)}`);
  console.log(`   📤 API Payload:`, JSON.stringify(payload, null, 2));

  // Retry logic for 500 errors
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = attempt * 2000; // 2s, 4s, 6s
        console.log(`   ⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': AUTH_TOKEN
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        
        // If it's a 500 error and we have retries left, continue to retry
        if (response.status === 500 && attempt < maxRetries - 1) {
          continue;
        }
        
        throw lastError;
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      console.log(`   ✅ Retrieved ${dataArray.length} records`);
      return dataArray;
    } catch (error) {
      lastError = error;
      // If it's not a 500 error or we're out of retries, throw immediately
      if (error.message && !error.message.includes('500') || attempt === maxRetries - 1) {
        console.error(`   ❌ Error fetching data: ${error.message}`);
        throw error;
      }
    }
  }
  
  // If we get here, all retries failed
  throw lastError || new Error('Failed after all retries');
}

/**
 * Normalize timestamp format (handle invalid formats like "2025-09-01T00:00:00.000000.000Z")
 */
function normalizeTimestamp(timestamp) {
  if (!timestamp) return null;
  
  // Replace double microseconds format with single
  let normalized = timestamp.toString().replace(/\.000000\.000Z$/, '.000Z');
  
  // If still invalid, try to extract just the date part
  try {
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Fallback: extract date part directly
    const dateMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return new Date(dateMatch[1] + 'T00:00:00.000Z');
    }
  } catch (e) {
    // Try fallback
    const dateMatch = timestamp.toString().match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return new Date(dateMatch[1] + 'T00:00:00.000Z');
    }
  }
  
  return null;
}

/**
 * Get the last date from existing file
 */
function getLastDateFromFile() {
  if (!fs.existsSync(outputFile)) {
    return null;
  }

  try {
    const fileContent = fs.readFileSync(outputFile, 'utf8');
    const data = JSON.parse(fileContent);
    
    if (!data.data || data.data.length === 0) {
      return null;
    }

    // Find the latest timestamp
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
    console.error('⚠️  Error reading existing file:', error.message);
    return null;
  }
}

/**
 * Read existing data from file
 */
function readExistingData() {
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
  console.log('🚀 Starting General Business Review data fetch');
  console.log(`📊 Metrics: ${METRICS.join(', ')}`);
  console.log(`🔍 Dimensions: ${DIMENSIONS.join(', ')}`);
  console.log(`📝 No partner filter - fetching all data`);

  // Check for existing data
  const existingData = readExistingData();
  const lastDate = getLastDateFromFile();
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  // Get the first date in the file to check for missing data at the beginning
  let firstDateInFile = null;
  if (existingData && existingData.data && existingData.data.length > 0) {
    const timestamps = existingData.data
      .map(item => item.timestamp)
      .filter(Boolean)
      .map(ts => normalizeTimestamp(ts))
      .filter(d => d && !isNaN(d.getTime()))
      .sort((a, b) => a - b);
    
    if (timestamps.length > 0) {
      firstDateInFile = timestamps[0];
    }
  }

  const targetStartDate = new Date(Date.UTC(2023, 0, 1, 0, 0, 0, 0)); // January 1st, 2023
  let startDate;

  if (lastDate && !isNaN(lastDate.getTime())) {
    // Check if we need to fill data before the first date in file
    if (firstDateInFile && firstDateInFile > targetStartDate) {
      // We have data but missing from 2023-01-01 to firstDateInFile
      startDate = targetStartDate;
      console.log(`\n📂 Found existing data file`);
      console.log(`   First date in file: ${firstDateInFile.toISOString().split('T')[0]}`);
      console.log(`   Last date in file: ${lastDate.toISOString().split('T')[0]}`);
      console.log(`   ⚠️  Missing data from ${targetStartDate.toISOString().split('T')[0]} to ${firstDateInFile.toISOString().split('T')[0]}`);
      console.log(`   Starting from: ${startDate.toISOString().split('T')[0]} to fill the gap`);
    } else {
      // Start from the day after the last date
      startDate = new Date(lastDate);
      startDate.setUTCDate(startDate.getUTCDate() + 1);
      startDate.setUTCHours(0, 0, 0, 0);
      
      // Check if we're already up to date
      const lastDateOnly = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
      const todayOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      
      if (lastDateOnly >= todayOnly && (!firstDateInFile || firstDateInFile <= targetStartDate)) {
        console.log('\n✅ Data is already up to date!');
        console.log(`   First date in file: ${firstDateInFile ? firstDateInFile.toISOString().split('T')[0] : 'N/A'}`);
        console.log(`   Last date in file: ${lastDate.toISOString().split('T')[0]}`);
        console.log(`   Today: ${today.toISOString().split('T')[0]}`);
        return;
      }
      
      console.log(`\n📂 Found existing data file`);
      console.log(`   Last date in file: ${lastDate.toISOString().split('T')[0]}`);
      console.log(`   Starting from: ${startDate.toISOString().split('T')[0]}`);
    }
  } else {
    // No existing data, start from January 2023
    startDate = targetStartDate;
    console.log(`\n📂 No existing data found, starting from January 2023`);
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
      // Wait 3 seconds between requests to avoid rate limiting and 500 errors
      if (i > 0) {
        console.log(`\n⏳ Waiting 3 seconds before next request...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
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
    
    // Create a Set to track unique records (by timestamp + adKind)
    const existingKeys = new Set();
    existingData.data.forEach(item => {
      if (item.timestamp && item.adKind) {
        existingKeys.add(`${item.timestamp}_${item.adKind}`);
      }
    });
    
    // Filter out duplicates from new data
    const newDataFiltered = allData.filter(item => {
      if (!item.timestamp || !item.adKind) return true;
      const key = `${item.timestamp}_${item.adKind}`;
      return !existingKeys.has(key);
    });
    
    // Merge: existing data + new filtered data
    finalData = [...existingData.data, ...newDataFiltered];
    
    console.log(`\n📊 Merging data:`);
    console.log(`   Existing records: ${existingRecordsCount}`);
    console.log(`   New records: ${newDataFiltered.length}`);
    console.log(`   Duplicates filtered: ${allData.length - newDataFiltered.length}`);
  }

  // Prepare output data
  const outputData = {
    type: "general",
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

  // Save to file
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2), 'utf8');

  console.log(`\n✅ Data fetch completed!`);
  console.log(`   📊 Total records in file: ${finalData.length.toLocaleString()}`);
  console.log(`   📊 New records added: ${(finalData.length - existingRecordsCount).toLocaleString()}`);
  console.log(`   📊 Previous records: ${existingRecordsCount.toLocaleString()}`);
  console.log(`   ✅ Successful months: ${successCount}`);
  console.log(`   ❌ Failed months: ${errorCount}`);
  console.log(`   💾 Saved to: ${outputFile}`);
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

