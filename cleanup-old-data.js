
import Database from "@replit/database";

async function cleanupOldData() {
  const db = new Database();
  
  console.log("=== Cleaning up old data to stay under 5000 key limit ===");
  
  try {
    // Get all keys first
    const response = await db.list();
    let allKeys = [];
    
    if (response && typeof response === 'object' && 'ok' in response) {
      allKeys = response.ok ? (response.value || []) : [];
    } else {
      allKeys = Array.isArray(response) ? response : [];
    }
    
    console.log(`Total keys in database: ${allKeys.length}`);
    
    // Separate keys by type
    const resultKeys = allKeys.filter(key => key.startsWith('result_')).sort();
    const sessionKeys = allKeys.filter(key => key.startsWith('session_')).sort();
    const stationKeys = allKeys.filter(key => key.startsWith('station_'));
    const otherKeys = allKeys.filter(key => 
      !key.startsWith('result_') && 
      !key.startsWith('session_') && 
      !key.startsWith('station_') &&
      !key.includes('[object Object]')
    );
    
    console.log(`Results: ${resultKeys.length}, Sessions: ${sessionKeys.length}, Stations: ${stationKeys.length}, Other: ${otherKeys.length}`);
    
    let keysToDelete = [];
    
    // Delete old individual station keys (we have all_stations_data_v2 now)
    if (stationKeys.length > 0) {
      console.log(`Deleting ${stationKeys.length} old individual station keys...`);
      keysToDelete.push(...stationKeys);
    }
    
    // Keep only the latest 500 game results (delete older ones)
    if (resultKeys.length > 500) {
      const oldResults = resultKeys.slice(0, resultKeys.length - 500);
      console.log(`Deleting ${oldResults.length} old game results (keeping latest 500)...`);
      keysToDelete.push(...oldResults);
    }
    
    // Keep only the latest 100 sessions (delete older ones)
    if (sessionKeys.length > 100) {
      const oldSessions = sessionKeys.slice(0, sessionKeys.length - 100);
      console.log(`Deleting ${oldSessions.length} old game sessions (keeping latest 100)...`);
      keysToDelete.push(...oldSessions);
    }
    
    // Delete any corrupted keys
    const corruptedKeys = allKeys.filter(key => key.includes('[object Object]'));
    if (corruptedKeys.length > 0) {
      console.log(`Deleting ${corruptedKeys.length} corrupted keys...`);
      keysToDelete.push(...corruptedKeys);
    }
    
    console.log(`Total keys to delete: ${keysToDelete.length}`);
    
    // Delete keys in batches to avoid overwhelming the database
    for (let i = 0; i < keysToDelete.length; i += 50) {
      const batch = keysToDelete.slice(i, i + 50);
      console.log(`Deleting batch ${Math.floor(i/50) + 1}/${Math.ceil(keysToDelete.length/50)} (${batch.length} keys)...`);
      
      for (const key of batch) {
        try {
          await db.delete(key);
        } catch (error) {
          console.warn(`Failed to delete key ${key}:`, error.message);
        }
      }
      
      // Small delay between batches
      if (i + 50 < keysToDelete.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Check final count
    const finalResponse = await db.list();
    let finalKeys = [];
    if (finalResponse && typeof finalResponse === 'object' && 'ok' in finalResponse) {
      finalKeys = finalResponse.ok ? (finalResponse.value || []) : [];
    } else {
      finalKeys = Array.isArray(finalResponse) ? finalResponse : [];
    }
    
    console.log(`Cleanup complete! Final key count: ${finalKeys.length}`);
    console.log(`Space freed: ${allKeys.length - finalKeys.length} keys`);
    
    if (finalKeys.length < 4500) {
      console.log("✅ Database is now well under the 5000 key limit!");
    } else if (finalKeys.length < 5000) {
      console.log("⚠️  Database is close to the limit. Consider more aggressive cleanup if needed.");
    } else {
      console.log("❌ Database is still over the limit. Manual intervention may be required.");
    }
    
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}

cleanupOldData();
