
import { storage } from "./storage";
import Database from "@replit/database";

interface CleanupConfig {
  maxKeys: number;
  targetKeys: number;
  maxResultsToKeep: number;
  maxSessionsToKeep: number;
  batchSize: number;
}

const DEFAULT_CONFIG: CleanupConfig = {
  maxKeys: 4500, // Trigger cleanup before hitting 5000 limit
  targetKeys: 2000, // Clean down to this many keys
  maxResultsToKeep: 500, // Keep latest 500 game results
  maxSessionsToKeep: 100, // Keep latest 100 sessions
  batchSize: 50, // Delete in batches of 50
};

class DatabaseCleaner {
  private db: Database;
  private config: CleanupConfig;
  private isCleanupRunning = false;

  constructor(config: CleanupConfig = DEFAULT_CONFIG) {
    this.db = new Database();
    this.config = config;
  }

  async shouldRunCleanup(): Promise<boolean> {
    if (this.isCleanupRunning) return false;
    
    try {
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }
      
      console.log(`Database check: ${allKeys.length} keys (cleanup threshold: ${this.config.maxKeys})`);
      return allKeys.length >= this.config.maxKeys;
    } catch (error) {
      console.error('Error checking database size:', error);
      return false;
    }
  }

  async runCleanup(): Promise<void> {
    if (this.isCleanupRunning) {
      console.log('Cleanup already running, skipping...');
      return;
    }

    this.isCleanupRunning = true;
    console.log('=== Starting automatic database cleanup ===');

    try {
      // Get all keys
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }

      console.log(`Total keys before cleanup: ${allKeys.length}`);

      // Categorize keys
      const resultKeys = allKeys.filter(key => key.startsWith('result_') && !key.includes('[object Object]'));
      const sessionKeys = allKeys.filter(key => key.startsWith('session_') && !key.includes('[object Object]'));
      const stationKeys = allKeys.filter(key => key.startsWith('station_'));
      const otherKeys = allKeys.filter(key => 
        !key.startsWith('result_') && 
        !key.startsWith('session_') && 
        !key.startsWith('station_') &&
        !key.startsWith('all_stations_data') &&
        !key.startsWith('gameStats_') &&
        !key.startsWith('id_counter_')
      );

      console.log(`Results: ${resultKeys.length}, Sessions: ${sessionKeys.length}, Stations: ${stationKeys.length}, Other: ${otherKeys.length}`);

      let totalDeleted = 0;

      // Clean up old results (keep newest)
      if (resultKeys.length > this.config.maxResultsToKeep) {
        const sortedResultKeys = resultKeys.sort((a, b) => {
          const idA = parseInt(a.replace("result_", ""));
          const idB = parseInt(b.replace("result_", ""));
          return idB - idA; // Newest first
        });
        
        const keysToDelete = sortedResultKeys.slice(this.config.maxResultsToKeep);
        console.log(`Deleting ${keysToDelete.length} old game results (keeping latest ${this.config.maxResultsToKeep})...`);
        totalDeleted += await this.deleteBatch(keysToDelete);
      }

      // Clean up old sessions (keep newest)
      if (sessionKeys.length > this.config.maxSessionsToKeep) {
        const sortedSessionKeys = sessionKeys.sort((a, b) => {
          const idA = parseInt(a.replace("session_", ""));
          const idB = parseInt(b.replace("session_", ""));
          return idB - idA; // Newest first
        });
        
        const keysToDelete = sortedSessionKeys.slice(this.config.maxSessionsToKeep);
        console.log(`Deleting ${keysToDelete.length} old game sessions (keeping latest ${this.config.maxSessionsToKeep})...`);
        totalDeleted += await this.deleteBatch(keysToDelete);
      }

      // Clean up corrupted/old station keys (we use single key storage now)
      if (stationKeys.length > 0) {
        console.log(`Deleting ${stationKeys.length} old individual station keys...`);
        totalDeleted += await this.deleteBatch(stationKeys);
      }

      // Clean up any other suspicious keys
      const suspiciousKeys = otherKeys.filter(key => 
        key.includes('[object Object]') || 
        key.length > 100 ||
        key.includes('undefined')
      );
      
      if (suspiciousKeys.length > 0) {
        console.log(`Deleting ${suspiciousKeys.length} corrupted keys...`);
        totalDeleted += await this.deleteBatch(suspiciousKeys);
      }

      const finalKeyCount = allKeys.length - totalDeleted;
      console.log(`Cleanup complete! Deleted ${totalDeleted} keys. Final count: ${finalKeyCount}`);
      
      if (finalKeyCount > this.config.targetKeys) {
        console.warn(`Still above target (${this.config.targetKeys}). Consider adjusting cleanup parameters.`);
      }

    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      this.isCleanupRunning = false;
    }
  }

  private async deleteBatch(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    const batches = Math.ceil(keys.length / this.config.batchSize);
    let deleted = 0;

    for (let i = 0; i < batches; i++) {
      const start = i * this.config.batchSize;
      const end = start + this.config.batchSize;
      const batch = keys.slice(start, end);
      
      console.log(`Deleting batch ${i + 1}/${batches} (${batch.length} keys)...`);
      
      for (const key of batch) {
        try {
          await this.db.delete(key);
          deleted++;
        } catch (error) {
          console.warn(`Failed to delete key ${key}:`, error);
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return deleted;
  }
}

export const databaseCleaner = new DatabaseCleaner();

// Function to check and run cleanup if needed
export async function checkAndCleanup(): Promise<void> {
  try {
    if (await databaseCleaner.shouldRunCleanup()) {
      console.log('Database size threshold reached, starting cleanup...');
      await databaseCleaner.runCleanup();
    }
  } catch (error) {
    console.error('Error in cleanup check:', error);
  }
}
