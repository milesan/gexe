import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

// --- Configuration ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the .env file."
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// This map translates OLD keys found in application.data (which were stringified order_numbers)
// to the STABLE UUID (id) of the question they represented AT THAT TIME.
const HISTORICAL_ORDER_NUMBER_TO_QUESTION_ID_MAP: Record<string, string> = {
  "15000": "0397b9b1-39b9-4fee-914f-25c16f3ddd9a",
  "26000": "0d216f74-ad4c-4d02-bba7-d54853a6b07b",
  "14000": "0efef050-aedb-4f28-8380-f5e09f20c4c6",
  "28000": "1346d368-b560-44c8-b026-14776c1b9a79",
  "27000": "18fdf65b-a5c9-414d-bbfa-3057a7e2fba7",
  "30000": "241d9c89-0323-4003-9a20-7c19309ba488",
  "5000":  "246d0acf-25cd-4e4e-9434-765e6ea679cb",
  "24000": "36d8768e-938c-4287-b434-b7d3da6dd8d8",
  "33000": "3744486e-edf6-460b-9021-2450743da2d9",
  "4000":  "39f455d1-0de8-438f-8f34-10818eaec15e",
  "9000":  "3ccd4d31-f706-4715-b6a3-134e7beaf85d",
  "32000": "4b108d7c-d05e-4036-b060-cd18323a0f6f",
  "25000": "54d02288-6d35-46e2-884b-f2479fb93e75",
  "7000":  "5d9383fa-0f22-46d1-b612-76a5df303d29",
  "8000":  "6787be22-08cf-457a-ad15-a9880a9e1e12",
  "19000": "6a15976b-c98e-49e2-874a-ce1a7239d4c9",
  "20500": "6f317606-7f4e-4ea7-ae97-bd728a85f2f5",
  "22000": "702ae994-6f64-4e81-a2b3-2593fbc0c937",
  "3000":  "73d367b8-2238-452b-83eb-808e96e2be21",
  "11000": "74edfb7a-458e-4dca-bed5-90dd5ccc1bb7",
  "12000": "790d2581-67ff-40a0-b59e-fab7aaf3e55e",
  "23000": "8039351b-c928-46bc-9389-3ca354033580",
  "10000": "862413b2-5753-4020-bffc-4c8fd71b0568",
  "21000": "91c501fe-954e-47bf-823e-106637b96194",
  "35000": "b146ae72-bae4-4f02-903a-d99ed268db94",
  "16000": "b57ef1b4-612f-4e1c-b88b-eefe0211ba5e",
  "34000": "bfde0ed9-319a-45e4-8b0d-5c694ca2c850",
  "17000": "d2565ce6-c5b8-4969-b17d-b1232f270f18",
  "13000": "e0e50caf-fdc0-4476-a424-c250ada6d962",
  "20000": "ea59d026-9f24-4b22-b06e-8a3221d9b95c",
  "18000": "ee251d40-6354-44f7-b1eb-4245c04d1de6",
};

const APPLICATIONS_TABLE_NAME = 'applications';
const ID_COLUMN = 'id';
const DATA_COLUMN = 'data';

interface Application {
  [ID_COLUMN]: string; // Assuming UUID as string
  [DATA_COLUMN]: Record<string, any> | null;
  [key: string]: any; // Allow other columns
}

async function migrateData() {
  const isDryRun = process.argv.includes('--dry-run');
  const isLiveRun = process.argv.includes('--live');

  if (isDryRun) {
    console.log("Running in DRY-RUN mode. No changes will be saved.");
  } else if (isLiveRun) {
    console.log("Running in LIVE mode. Changes WILL be saved to the database.");
    // Add a small delay and a confirmation step for live runs as a safety measure
    console.warn("WARNING: This will modify data in the database!");
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second pause
    // You might want a more interactive confirmation here for production scripts
  } else {
    console.error("Error: Please specify --dry-run or --live mode.");
    process.exit(1);
  }

  let { data: applications, error } = await supabase
    .from(APPLICATIONS_TABLE_NAME)
    .select(`${ID_COLUMN}, ${DATA_COLUMN}`);

  if (error) {
    console.error("Error fetching applications:", error);
    return;
  }

  if (!applications || applications.length === 0) {
    console.log("No applications found to process.");
    return;
  }

  console.log(`Fetched ${applications.length} applications.`);

  let processedCount = 0;
  let changedCount = 0;
  const unmappedNumericKeyLogs: string[] = [];

  for (const app of applications as Application[]) {
    if (!app[DATA_COLUMN] || typeof app[DATA_COLUMN] !== 'object') {
      // console.log(`Skipping application ${app[ID_COLUMN]} due to missing or invalid data column.`);
      continue;
    }

    const originalData = app[DATA_COLUMN]!;
    const newData: Record<string, any> = {};
    let hasChanged = false;

    for (const oldKey in originalData) {
      if (Object.prototype.hasOwnProperty.call(originalData, oldKey)) {
        const value = originalData[oldKey];
        if (HISTORICAL_ORDER_NUMBER_TO_QUESTION_ID_MAP[oldKey]) {
          const newKey = HISTORICAL_ORDER_NUMBER_TO_QUESTION_ID_MAP[oldKey];
          newData[newKey] = value;
          if (newKey !== oldKey) {
            hasChanged = true;
            if (isDryRun) {
              console.log(
                `  [APP_ID: ${app[ID_COLUMN]}] DRY-RUN: Would map '${oldKey}' to '${newKey}'`
              );
            }
          }
        } else {
          // Key not in map, carry it over.
          // Check if it looks like an old numeric key that *should* have been mapped.
          if (/^\d+$/.test(oldKey)) { // Simple check if key is all digits
            const logMessage = 
                `  [APP_ID: ${app[ID_COLUMN]}] WARNING: Numeric key '${oldKey}' not found in map. Carried over.`;
            unmappedNumericKeyLogs.push(logMessage);
            if (isDryRun) console.warn(logMessage);
          }
          newData[oldKey] = value;
        }
      }
    }

    if (hasChanged) {
      changedCount++;
      if (isLiveRun) {
        console.log(`  [APP_ID: ${app[ID_COLUMN]}] Updating data...`);
        const { error: updateError } = await supabase
          .from(APPLICATIONS_TABLE_NAME)
          .update({ [DATA_COLUMN]: newData })
          .eq(ID_COLUMN, app[ID_COLUMN]);

        if (updateError) {
          console.error(
            `    Error updating application ${app[ID_COLUMN]}:`, updateError
          );
        } else {
          console.log(`    Successfully updated application ${app[ID_COLUMN]}`);
        }
      }
    }
    processedCount++;
  }

  console.log("\n--- Migration Summary ---");
  console.log(`Total applications processed: ${processedCount}`);
  console.log(`Applications with data changes: ${changedCount}`);
  
  if (unmappedNumericKeyLogs.length > 0) {
    console.warn("\nWarnings for unmapped numeric keys (carried over):");
    unmappedNumericKeyLogs.forEach(log => console.warn(log));
  } else {
    console.log("\nNo unmapped numeric keys found.");
  }

  if (isDryRun) {
    console.log("\nDRY-RUN COMPLETE. No actual changes were made.");
  }
   if (isLiveRun && changedCount > 0) {
    console.log("\nLIVE RUN COMPLETE. Data was modified.");
  }
   if (isLiveRun && changedCount === 0) {
    console.log("\nLIVE RUN COMPLETE. No data needed modification.");
  }
}

migrateData().catch(console.error); 