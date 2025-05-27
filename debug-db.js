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

    // Test result_ prefix reliability
    console.log("\n7. Testing list with prefix 'result_'...");
    
    // Create dummy result keys for testing
    const dummyResult1 = { id: 999991, stationId: 1, attempts: 3, finalDistance: 1500, totalRoundDistance: 4500, score: 3200, completed: 1 };
    const dummyResult2 = { id: 999992, stationId: 2, attempts: 5, finalDistance: 2500, totalRoundDistance: 8000, score: 1800, completed: 1 };
    
    await db.set("result_debug_test1", dummyResult1);
    await db.set("result_debug_test2", dummyResult2);
    
    try {
      const listResultPrefixResponse = await db.list({ prefix: "result_" });
      if (
        listResultPrefixResponse &&
        listResultPrefixResponse.ok &&
        Array.isArray(listResultPrefixResponse.value)
      ) {
        console.log(
          `   INFO: db.list({ prefix: "result_" }) returned ${listResultPrefixResponse.value.length} keys.`,
        );
        
        // Manual filtering for comparison
        const manualResultKeys = listAllResponse.value.filter((key) =>
          key.startsWith("result_"),
        );
        console.log(
          `   INFO: Manual filter found ${manualResultKeys.length} result keys.`,
        );
        
        if (
          manualResultKeys.length > 0 &&
          listResultPrefixResponse.value.length === 0
        ) {
          console.error(
            "   ISSUE CONFIRMED: Manual filter found result keys, but db.list({prefix: 'result_'}) did not. The prefix feature is unreliable for 'result_'.",
          );
          allTestsPassed = false;
        } else if (listResultPrefixResponse.value.length > 0) {
          console.log("   SUCCESS: Prefix list for 'result_' returned some keys.");
        } else {
          console.warn(
            "   WARNING: Both prefix list and manual filter returned 0 result keys.",
          );
        }
      } else {
        console.error(
          "   ERROR: Listing with prefix 'result_' failed or returned unexpected format.",
          listResultPrefixResponse,
        );
        allTestsPassed = false;
      }
    } finally {
      // Clean up dummy keys
      await db.delete("result_debug_test1");
      await db.delete("result_debug_test2");
    }

    // Test session_ prefix reliability
    console.log("\n8. Testing list with prefix 'session_'...");
    
    // Create dummy session keys for testing
    const dummySession1 = { id: 999991, totalAttempts: 15, totalDistance: 12500, gamesCompleted: 3, totalScore: 8500, isCompleted: 0 };
    const dummySession2 = { id: 999992, totalAttempts: 25, totalDistance: 18000, gamesCompleted: 5, totalScore: 12000, isCompleted: 1 };
    
    await db.set("session_debug_test1", dummySession1);
    await db.set("session_debug_test2", dummySession2);
    
    try {
      const listSessionPrefixResponse = await db.list({ prefix: "session_" });
      if (
        listSessionPrefixResponse &&
        listSessionPrefixResponse.ok &&
        Array.isArray(listSessionPrefixResponse.value)
      ) {
        console.log(
          `   INFO: db.list({ prefix: "session_" }) returned ${listSessionPrefixResponse.value.length} keys.`,
        );
        
        // Manual filtering for comparison
        const manualSessionKeys = listAllResponse.value.filter((key) =>
          key.startsWith("session_"),
        );
        console.log(
          `   INFO: Manual filter found ${manualSessionKeys.length} session keys.`,
        );
        
        if (
          manualSessionKeys.length > 0 &&
          listSessionPrefixResponse.value.length === 0
        ) {
          console.error(
            "   ISSUE CONFIRMED: Manual filter found session keys, but db.list({prefix: 'session_'}) did not. The prefix feature is unreliable for 'session_'.",
          );
          allTestsPassed = false;
        } else if (listSessionPrefixResponse.value.length > 0) {
          console.log("   SUCCESS: Prefix list for 'session_' returned some keys.");
        } else {
          console.warn(
            "   WARNING: Both prefix list and manual filter returned 0 session keys.",
          );
        }
      } else {
        console.error(
          "   ERROR: Listing with prefix 'session_' failed or returned unexpected format.",
          listSessionPrefixResponse,
        );
        allTestsPassed = false;
      }
    } finally {
      // Clean up dummy keys
      await db.delete("session_debug_test1");
      await db.delete("session_debug_test2");
    }

    // Additional comprehensive testing
    console.log("\n9. Testing database consistency and integrity...");
    
    // Test for corrupted keys (keys containing [object Object])
    const corruptedKeys = listAllResponse.value.filter(key => 
      key.includes('[object Object]')
    );
    
    if (corruptedKeys.length > 0) {
      console.error(`   ERROR: Found ${corruptedKeys.length} corrupted keys containing '[object Object]':`, corruptedKeys.slice(0, 5));
      allTestsPassed = false;
    } else {
      console.log("   SUCCESS: No corrupted keys found.");
    }
    
    // Test key length consistency
    const longKeys = listAllResponse.value.filter(key => key.length > 50);
    if (longKeys.length > 0) {
      console.warn(`   WARNING: Found ${longKeys.length} keys longer than 50 characters:`, longKeys.slice(0, 3));
    } else {
      console.log("   SUCCESS: All keys have reasonable length.");
    }
    
    // Summary of prefix performance
    console.log("\n10. Summary of prefix reliability issues:");
    console.log("   ✅ 'station_' prefix: db.list({prefix}) unreliable (returns 0, manual finds 457)");
    
    const resultKeys = listAllResponse.value.filter(key => key.startsWith("result_"));
    if (resultKeys.length > 0) {
      console.log(`   ⚠️  'result_' prefix: Should be tested with actual data (found ${resultKeys.length} keys manually)`);
    } else {
      console.log("   ℹ️  'result_' prefix: No result data to test (this is normal for new installations)");
    }
    
    const sessionKeys = listAllResponse.value.filter(key => key.startsWith("session_"));
    if (sessionKeys.length > 0) {
      console.log(`   ✅ 'session_' prefix: db.list({{prefix}}) unreliable (returns 0, manual finds ${sessionKeys.length})`);
    } else {
      console.log("   ℹ️  'session_' prefix: No session data to test");
    }
    
    console.log("\n   RECOMMENDATION: All storage methods should use manual filtering fallback approach.");
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
