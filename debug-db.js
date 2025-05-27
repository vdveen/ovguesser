import Database from "@replit/database";

async function debugDatabase() {
  const db = new Database();
  let allTestsPassed = true;

  console.log("=== Testing Replit Database (Improved Script) ===");

  try {
    // Test basic set/get
    console.log("\n1. Testing basic set/get...");
    const setResponse = await db.set("debug_test_key", "debug_test_value");
    if (!setResponse || (setResponse.ok !== undefined && !setResponse.ok)) {
      // Handle potential direct error or {ok:false}
      console.error("   ERROR: Basic set failed.", setResponse);
      allTestsPassed = false;
    } else {
      const getResponse = await db.get("debug_test_key");
      if (
        getResponse &&
        getResponse.ok &&
        getResponse.value === "debug_test_value"
      ) {
        console.log("   SUCCESS: Basic set/get works.");
      } else {
        console.error(
          "   ERROR: Basic set/get failed. Expected 'debug_test_value'. Got:",
          getResponse,
        );
        allTestsPassed = false;
      }
      await db.delete("debug_test_key"); // Clean up
    }

    // Test list all keys
    console.log("\n2. Testing list all keys...");
    const listAllResponse = await db.list();
    if (
      listAllResponse &&
      listAllResponse.ok &&
      Array.isArray(listAllResponse.value)
    ) {
      console.log(
        `   SUCCESS: Found ${listAllResponse.value.length} total keys.`,
      );
      // console.log("   All keys sample:", listAllResponse.value.slice(0, 10)); // Show a sample
    } else {
      console.error(
        "   ERROR: Listing all keys failed or returned unexpected format.",
        listAllResponse,
      );
      allTestsPassed = false;
    }

    // Test list with prefix (known to be potentially problematic)
    console.log("\n3. Testing list with prefix 'station_'...");
    const listPrefixResponse = await db.list({ prefix: "station_" });
    if (
      listPrefixResponse &&
      listPrefixResponse.ok &&
      Array.isArray(listPrefixResponse.value)
    ) {
      console.log(
        `   INFO: db.list({ prefix: "station_" }) returned ${listPrefixResponse.value.length} keys.`,
      );
      if (listPrefixResponse.value.length > 0) {
        console.log("   SUCCESS: Prefix list returned some keys.");
        // console.log("   Sample prefixed keys:", listPrefixResponse.value.slice(0, 5));
      } else {
        console.warn(
          "   WARNING: Prefix list returned 0 keys. This might be an issue with the DB client's prefix feature if stations actually exist.",
        );
        // We know from manual filtering that stations exist, so this is likely to show 0 and be a warning.
      }
    } else {
      console.error(
        "   ERROR: Listing with prefix failed or returned unexpected format.",
        listPrefixResponse,
      );
      allTestsPassed = false;
    }

    // Manual filtering (as a comparison for prefix list)
    console.log(
      "\n4. Performing manual filtering for 'station_' keys (for comparison)...",
    );
    if (
      listAllResponse &&
      listAllResponse.ok &&
      Array.isArray(listAllResponse.value)
    ) {
      const manualStationKeys = listAllResponse.value.filter((key) =>
        key.startsWith("station_"),
      );
      console.log(
        `   SUCCESS: Manually found ${manualStationKeys.length} station keys.`,
      );
      if (
        manualStationKeys.length === 0 &&
        listPrefixResponse.value.length === 0
      ) {
        console.warn(
          "   WARNING: No station keys found either by prefix list or manual filter. Is station data loaded?",
        );
      } else if (
        manualStationKeys.length > 0 &&
        listPrefixResponse.value.length === 0
      ) {
        console.error(
          "   ISSUE CONFIRMED: Manual filter found stations, but db.list({prefix}) did not. The prefix feature is likely unreliable for 'station_'.",
        );
        allTestsPassed = false; // Or treat as a critical warning depending on how storage.ts handles it
      }
    } else {
      console.warn(
        "   Skipping manual filtering as listing all keys failed earlier.",
      );
    }

    // Test if any stations exist and retrieve one
    console.log(
      "\n5. Checking existing station data (using manual filter results if necessary)...",
    );
    let stationKeysToTest = [];
    if (
      listPrefixResponse &&
      listPrefixResponse.ok &&
      listPrefixResponse.value.length > 0
    ) {
      stationKeysToTest = listPrefixResponse.value;
    } else if (listAllResponse && listAllResponse.ok) {
      // Fallback to manually filtered if prefix failed
      stationKeysToTest = listAllResponse.value.filter((key) =>
        key.startsWith("station_"),
      );
    }

    if (stationKeysToTest.length > 0) {
      const firstStationKey = stationKeysToTest[0];
      console.log(`   Attempting to get station with key: ${firstStationKey}`);
      const stationGetResponse = await db.get(firstStationKey);
      if (
        stationGetResponse &&
        stationGetResponse.ok &&
        typeof stationGetResponse.value === "object"
      ) {
        console.log(
          "   SUCCESS: Retrieved first station object:",
          stationGetResponse.value.name,
        );
        // Add more checks for station object properties if needed
      } else {
        console.error(
          "   ERROR: Failed to get station object or it has unexpected format.",
          stationGetResponse,
        );
        allTestsPassed = false;
      }
    } else {
      console.warn(
        "   WARNING: No station keys found to test station data retrieval.",
      );
      // This could be an error if you expect stations to be loaded.
    }

    // Check ID counter
    console.log("\n6. Checking ID counter 'id_counter_station'...");
    const counterGetResponse = await db.get("id_counter_station");
    if (
      counterGetResponse &&
      counterGetResponse.ok &&
      typeof counterGetResponse.value === "number"
    ) {
      console.log("   SUCCESS: Station ID counter:", counterGetResponse.value);
    } else {
      console.error(
        "   ERROR: Failed to get station ID counter or it's not a number.",
        counterGetResponse,
      );
      allTestsPassed = false;
    }
  } catch (error) {
    console.error(
      "\nFATAL: Database test script encountered an unhandled error:",
      error,
    );
    allTestsPassed = false;
  } finally {
    console.log("\n===================================");
    if (allTestsPassed) {
      console.log(
        "✅ All critical database debug checks passed (or issues are noted as warnings).",
      );
    } else {
      console.log("❌ Some critical database debug checks FAILED.");
    }
    console.log("Review warnings and errors above carefully.");
    console.log("===================================");
  }
}

debugDatabase();
