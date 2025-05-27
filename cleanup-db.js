
import Database from "@replit/database";

async function cleanupDatabase() {
  const db = new Database();
  
  console.log("=== Cleaning up corrupted database entries ===");
  
  try {
    // Get all keys
    const response = await db.list();
    let allKeys = [];
    
    if (response && typeof response === 'object' && 'ok' in response) {
      allKeys = response.ok ? (response.value || []) : [];
    } else {
      allKeys = Array.isArray(response) ? response : [];
    }
    
    console.log("All keys found:", allKeys);
    
    // Delete corrupted station keys
    for (const key of allKeys) {
      if (key.includes('[object Object]')) {
        console.log(`Deleting corrupted key: ${key}`);
        await db.delete(key);
      }
    }
    
    // Reset ID counters to 0
    console.log("Resetting ID counters...");
    await db.set("id_counter_station", 0);
    await db.set("id_counter_session", 0);
    await db.set("id_counter_result", 0);
    
    console.log("Database cleanup completed!");
    
  } catch (error) {
    console.error("Database cleanup failed:", error);
  }
}

cleanupDatabase();
