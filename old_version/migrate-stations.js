
import Database from "@replit/database";
import fs from "fs";
import path from "path";

async function migrateStations() {
  const db = new Database();
  const ALL_STATIONS_KEY = "all_stations_data_v2";
  
  console.log("=== Station Storage Migration ===");
  
  try {
    // Check if new format already exists
    const existingResponse = await db.get(ALL_STATIONS_KEY);
    if (existingResponse && 
        ((existingResponse.ok && Array.isArray(existingResponse.value)) || 
         Array.isArray(existingResponse))) {
      console.log("Stations already migrated to new format. Skipping migration.");
      return;
    }

    // Get all existing individual station keys
    const allKeysResponse = await db.list();
    let allKeys = [];
    
    if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
      allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
    } else {
      allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
    }
    
    const stationKeys = allKeys.filter(key => 
      key.startsWith('station_') && 
      !key.includes('[object Object]') && 
      key.length <= 50
    );
    
    console.log(`Found ${stationKeys.length} individual station keys to migrate`);
    
    if (stationKeys.length === 0) {
      console.log("No individual station keys found. Loading from GeoJSON instead...");
      // Load from GeoJSON if no individual keys exist
      const geoJsonPath = path.resolve(import.meta.dirname, "attached_assets/export(2).geojson");
      const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, "utf-8"));
      
      const stationsToLoad = [];
      let nextStationId = 1;

      for (const feature of geoJsonData.features) {
        if (feature.geometry?.type === "Point" && feature.properties?.name) {
          stationsToLoad.push({
            id: nextStationId++,
            name: feature.properties.name,
            coordinates: feature.geometry.coordinates,
            properties: feature.properties,
          });
        }
      }
      
      if (stationsToLoad.length > 0) {
        console.log(`Saving ${stationsToLoad.length} stations from GeoJSON to new format`);
        await db.set(ALL_STATIONS_KEY, stationsToLoad);
        console.log("Migration complete!");
      }
      return;
    }
    
    // Migrate existing individual keys to single array
    const stations = [];
    let migratedCount = 0;
    
    for (const key of stationKeys) {
      try {
        const stationResponse = await db.get(key);
        let station = null;
        
        if (stationResponse && typeof stationResponse === 'object' && 'ok' in stationResponse) {
          station = stationResponse.ok ? stationResponse.value : null;
        } else {
          station = stationResponse;
        }
        
        if (station && typeof station === 'object' && typeof station.id === 'number' && station.name) {
          stations.push(station);
          migratedCount++;
        }
      } catch (error) {
        console.warn(`Error migrating station for key ${key}:`, error);
      }
    }
    
    if (stations.length > 0) {
      console.log(`Migrating ${stations.length} stations to new single-key format...`);
      await db.set(ALL_STATIONS_KEY, stations);
      console.log("Migration successful!");
      
      // Clean up old individual keys
      console.log("Cleaning up old individual station keys...");
      for (const key of stationKeys) {
        await db.delete(key);
      }
      
      // Delete old station ID counter
      await db.delete('id_counter_station');
      console.log("Cleanup complete!");
    }
    
    console.log(`Migration finished. ${migratedCount} stations migrated.`);
    
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

migrateStations();
