
import Database from "@replit/database";

async function debugDatabase() {
  const db = new Database();
  
  console.log("=== Testing Replit Database ===");
  
  try {
    // Test basic connection
    console.log("1. Testing basic connection...");
    await db.set("test_key", "test_value");
    const testValue = await db.get("test_key");
    console.log("   Basic set/get works:", testValue === "test_value");
    
    // Test list method
    console.log("2. Testing list method...");
    const allKeys = await db.list();
    console.log("   All keys:", allKeys);
    console.log("   Keys type:", typeof allKeys);
    console.log("   Is array:", Array.isArray(allKeys));
    
    // Test list with prefix
    console.log("3. Testing list with prefix...");
    const stationKeys = await db.list({ prefix: "station_" });
    console.log("   Station keys:", stationKeys);
    console.log("   Station keys type:", typeof stationKeys);
    console.log("   Station keys is array:", Array.isArray(stationKeys));
    
    // Test if any stations exist
    console.log("4. Checking existing stations...");
    if (Array.isArray(stationKeys) && stationKeys.length > 0) {
      const firstStation = await db.get(stationKeys[0]);
      console.log("   First station:", firstStation);
    } else {
      console.log("   No stations found");
    }
    
    // Check ID counter
    console.log("5. Checking ID counter...");
    const stationCounter = await db.get("id_counter_station");
    console.log("   Station ID counter:", stationCounter);
    
  } catch (error) {
    console.error("Database test failed:", error);
  }
}

debugDatabase();
