
import Database from "@replit/database";
import {
  trainStations,
  gameStats,
  gameResults,
  gameSessions,
  type TrainStation,
  type InsertTrainStation,
  type GameStats,
  type InsertGameStats,
  type GameResult,
  type InsertGameResult,
  type GameSession,
  type InsertGameSession,
  type StationFeature,
} from "@shared/schema";

export interface IStorage {
  // Train station methods
  getAllStations(): Promise<TrainStation[]>;
  getStationById(id: number): Promise<TrainStation | undefined>;
  getRandomStation(): Promise<TrainStation | undefined>;
  createStation(station: InsertTrainStation): Promise<TrainStation>;
  loadStationsFromGeoJSON(geoJsonData: any): Promise<void>;

  // Game stats methods
  getGameStats(): Promise<GameStats | undefined>;
  updateGameStats(stats: Partial<GameStats>): Promise<GameStats>;

  // Game results methods
  createGameResult(result: InsertGameResult): Promise<GameResult>;
  getRecentResults(limit?: number): Promise<GameResult[]>;
  getAllGameResults(): Promise<GameResult[]>;

  // Game session methods
  createGameSession(): Promise<GameSession>;
  updateGameSession(
    id: number,
    session: Partial<GameSession>,
  ): Promise<GameSession>;
  getCurrentGameSession(): Promise<GameSession | undefined>;
  getGameSessionById(id: number): Promise<GameSession | undefined>;
  getAllGameSessions(): Promise<GameSession[]>;
  completeGameSession(id: number): Promise<GameSession>;
}

const ALL_STATIONS_KEY = "all_stations_data_v2";

export class ReplitDbStorage implements IStorage {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  // Helper methods for ID management (no longer needed for stations)
  private async getNextId(type: 'result' | 'session'): Promise<number> {
    const counterKey = `id_counter_${type}`;
    const response = await this.db.get(counterKey);
    let currentId = 0;
    
    if (response && typeof response === 'object' && 'ok' in response) {
      // Handle response object format
      const rawValue = response.ok ? response.value : null;
      if (typeof rawValue === 'number') {
        currentId = rawValue;
      } else if (typeof rawValue === 'string') {
        const parsed = parseInt(rawValue, 10);
        currentId = isNaN(parsed) ? 0 : parsed;
      } else {
        currentId = 0;
      }
    } else {
      // Handle direct value format (fallback)
      if (typeof response === 'number') {
        currentId = response;
      } else if (typeof response === 'string') {
        const parsed = parseInt(response, 10);
        currentId = isNaN(parsed) ? 0 : parsed;
      } else {
        currentId = 0;
      }
    }
    
    // Ensure currentId is a valid number
    if (!Number.isInteger(currentId) || currentId < 0) {
      console.warn(`Invalid ID counter for ${type}:`, currentId, 'resetting to 0');
      currentId = 0;
    }
    
    const nextId = currentId + 1;
    await this.db.set(counterKey, nextId);
    return nextId;
  }

  // Train station methods - OPTIMIZED FOR SINGLE KEY STORAGE
  async getAllStations(): Promise<TrainStation[]> {
    console.log(`Attempting to fetch all stations from single key: ${ALL_STATIONS_KEY}`);
    try {
      const response = await this.db.get(ALL_STATIONS_KEY);
      let stations: TrainStation[] = [];

      if (response && typeof response === 'object' && 'ok' in response) {
        if (response.ok && Array.isArray(response.value)) {
          stations = response.value;
        }
      } else if (Array.isArray(response)) {
        stations = response; // Fallback for direct value
      }
      
      if (!stations || stations.length === 0) {
        console.log("No stations found under the single key, checking for legacy individual keys...");
        // Fallback to old method if new key doesn't exist
        return await this.getAllStationsLegacy();
      }
      
      console.log(`Successfully loaded ${stations.length} stations from single key in one operation.`);
      return stations;
    } catch (error) {
      console.error(`Error getting all stations from key ${ALL_STATIONS_KEY}:`, error);
      console.log("Falling back to legacy individual key method...");
      return await this.getAllStationsLegacy();
    }
  }

  // Keep legacy method as fallback during migration
  private async getAllStationsLegacy(): Promise<TrainStation[]> {
    try {
      console.log("Using legacy individual key method (slow)...");
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
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
      
      console.log(`Found ${stationKeys.length} station keys out of ${allKeys.length} total keys`);
      
      const stations: TrainStation[] = [];
      
      for (const key of stationKeys) {
        try {
          const stationResponse = await this.db.get(key);
          let station = null;
          
          if (stationResponse && typeof stationResponse === 'object' && 'ok' in stationResponse) {
            station = stationResponse.ok ? stationResponse.value : null;
          } else {
            station = stationResponse;
          }
          
          if (station && typeof station === 'object' && typeof station.id === 'number' && station.name) {
            stations.push(station);
          }
        } catch (error) {
          console.warn(`Error retrieving station for key ${key}:`, error);
        }
      }
      
      console.log(`Successfully loaded ${stations.length} stations from legacy method`);
      return stations;
    } catch (error) {
      console.error('Error getting all stations (legacy method):', error);
      return [];
    }
  }

  async getStationById(id: number): Promise<TrainStation | undefined> {
    const stations = await this.getAllStations();
    return stations.find(station => station.id === id);
  }

  async getRandomStation(): Promise<TrainStation | undefined> {
    const stations = await this.getAllStations();
    if (stations.length === 0) return undefined;
    const randomIndex = Math.floor(Math.random() * stations.length);
    return stations[randomIndex];
  }

  async createStation(insertStation: InsertTrainStation): Promise<TrainStation> {
    console.warn("createStation is not optimal for single-key station storage approach.");
    // For individual station creation, we'd need to read entire array, modify, and write back
    // For now, we'll assume stations are only loaded via GeoJSON in bulk
    throw new Error("Individual station creation not supported in optimized storage model. Use loadStationsFromGeoJSON for bulk loading.");
  }

  async loadStationsFromGeoJSON(geoJsonData: any): Promise<void> {
    console.log("Attempting to load stations from GeoJSON into single key...");
    
    // Check if stations already exist in the new format
    const existingStations = await this.getAllStations();
    if (existingStations.length > 0) {
      console.log("Stations already exist. Skipping GeoJSON import.");
      return;
    }

    if (!geoJsonData?.features) {
      console.log("No features in GeoJSON data.");
      return;
    }

    const stationsToLoad: TrainStation[] = [];
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
      console.log(`Saving ${stationsToLoad.length} stations to single key ${ALL_STATIONS_KEY}`);
      await this.db.set(ALL_STATIONS_KEY, stationsToLoad);
      console.log("Finished loading stations from GeoJSON into single key.");
      
      // Clean up old individual station keys if they exist
      await this.deleteAllIndividualStationKeys();
    } else {
      console.log("No valid stations found in GeoJSON to load.");
    }
  }

  // Helper for migration - cleanup old individual station keys
  private async deleteAllIndividualStationKeys(): Promise<void> {
    console.log("Cleaning up old individual station keys...");
    try {
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }

      const stationKeysToDelete = allKeys.filter(key => key.startsWith('station_'));
      
      if (stationKeysToDelete.length === 0) {
        console.log("No old individual station keys found to delete.");
        return;
      }
      
      console.log(`Deleting ${stationKeysToDelete.length} old individual station keys...`);
      
      for (const key of stationKeysToDelete) {
        await this.db.delete(key);
      }
      
      // Also delete the old station ID counter
      await this.db.delete('id_counter_station');
      console.log("Finished cleaning up old station keys.");
    } catch (error) {
      console.error("Error during cleanup of old station keys:", error);
    }
  }

  // Game stats methods
  async getGameStats(): Promise<GameStats | undefined> {
    const key = "gameStats_main";
    const response = await this.db.get(key);
    let stats = null;
    
    if (response && typeof response === 'object' && 'ok' in response) {
      stats = response.ok ? response.value : null;
    } else {
      stats = response;
    }
    
    if (!stats) {
      stats = {
        id: 1,
        totalGames: 0,
        totalAttempts: 0,
        bestDistance: null,
        averageDistance: null,
      };
      await this.db.set(key, stats);
    }
    
    return stats;
  }

  async updateGameStats(statsUpdate: Partial<GameStats>): Promise<GameStats> {
    const currentStats = await this.getGameStats();
    const updatedStats = { ...currentStats!, ...statsUpdate };
    const key = "gameStats_main";
    await this.db.set(key, updatedStats);
    return updatedStats;
  }

  // Game results methods
  async createGameResult(insertResult: InsertGameResult): Promise<GameResult> {
    const id = await this.getNextId('result');
    const result: GameResult = { ...insertResult, id };
    const key = `result_${id}`;
    await this.db.set(key, result);
    return result;
  }

  async getRecentResults(limit: number = 10): Promise<GameResult[]> {
    try {
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }
      
      const resultKeys = allKeys.filter(key => 
        key.startsWith('result_') && 
        !key.includes('[object Object]') && 
        key.length <= 50
      );
      
      const sortedKeys = resultKeys.sort((a, b) => {
        const idA = parseInt(a.replace("result_", ""));
        const idB = parseInt(b.replace("result_", ""));
        return idB - idA;
      });

      const recentKeys = sortedKeys.slice(0, limit);
      const results: GameResult[] = [];

      for (const key of recentKeys) {
        try {
          const resultResponse = await this.db.get(key);
          let result = null;
          
          if (resultResponse && typeof resultResponse === 'object' && 'ok' in resultResponse) {
            result = resultResponse.ok ? resultResponse.value : null;
          } else {
            result = resultResponse;
          }
          
          if (result && typeof result === 'object' && typeof result.id === 'number') {
            results.push(result);
          }
        } catch (error) {
          console.warn(`Error retrieving result for key ${key}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Error getting recent results:', error);
      return [];
    }
  }

  // Game session methods
  async createGameSession(): Promise<GameSession> {
    const id = await this.getNextId('session');
    const session: GameSession = {
      id,
      totalAttempts: 0,
      totalDistance: 0,
      gamesCompleted: 0,
      isCompleted: 0,
      totalScore: 0,
    };
    const key = `session_${id}`;
    await this.db.set(key, session);
    return session;
  }

  async updateGameSession(
    id: number,
    sessionUpdate: Partial<GameSession>,
  ): Promise<GameSession> {
    const key = `session_${id}`;
    const response = await this.db.get(key);
    let session = null;
    
    if (response && typeof response === 'object' && 'ok' in response) {
      session = response.ok ? response.value : null;
    } else {
      session = response;
    }
    
    if (!session) throw new Error("Session not found");

    const updatedSession = { ...session, ...sessionUpdate };
    await this.db.set(key, updatedSession);
    return updatedSession;
  }

  async getCurrentGameSession(): Promise<GameSession | undefined> {
    try {
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }
      
      const sessionKeys = allKeys.filter(key => 
        key.startsWith('session_') && 
        !key.includes('[object Object]') && 
        key.length <= 50
      );
      
      if (sessionKeys.length === 0) return undefined;

      const sortedKeys = sessionKeys.sort((a, b) => {
        const idA = parseInt(a.replace("session_", ""));
        const idB = parseInt(b.replace("session_", ""));
        return idB - idA;
      });

      const mostRecentKey = sortedKeys[0];
      const sessionResponse = await this.db.get(mostRecentKey);
      
      if (sessionResponse && typeof sessionResponse === 'object' && 'ok' in sessionResponse) {
        const session = sessionResponse.ok ? sessionResponse.value : null;
        if (session && typeof session === 'object' && typeof session.id === 'number') {
          return session;
        }
      }
      
      return sessionResponse || undefined;
    } catch (error) {
      console.error('Error getting current game session:', error);
      return undefined;
    }
  }

  async getGameSessionById(id: number): Promise<GameSession | undefined> {
    const key = `session_${id}`;
    const response = await this.db.get(key);
    
    if (response && typeof response === 'object' && 'ok' in response) {
      return response.ok ? response.value : undefined;
    }
    
    return response || undefined;
  }

  async getAllGameSessions(): Promise<GameSession[]> {
    try {
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }
      
      const sessionKeys = allKeys.filter(key => 
        key.startsWith('session_') && 
        !key.includes('[object Object]') && 
        key.length <= 50
      );
      
      const sessions: GameSession[] = [];
      
      for (const key of sessionKeys) {
        try {
          const sessionResponse = await this.db.get(key);
          let session = null;
          
          if (sessionResponse && typeof sessionResponse === 'object' && 'ok' in sessionResponse) {
            session = sessionResponse.ok ? sessionResponse.value : null;
          } else {
            session = sessionResponse;
          }
          
          if (session && typeof session === 'object' && typeof session.id === 'number') {
            sessions.push(session);
          }
        } catch (error) {
          console.warn(`Error retrieving session for key ${key}:`, error);
        }
      }
      
      sessions.sort((a, b) => b.id - a.id);
      return sessions;
    } catch (error) {
      console.error('Error getting all game sessions:', error);
      return [];
    }
  }

  async getAllGameResults(): Promise<GameResult[]> {
    try {
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }
      
      const resultKeys = allKeys.filter(key => 
        key.startsWith('result_') && 
        !key.includes('[object Object]') && 
        key.length <= 50
      );
      
      const results: GameResult[] = [];
      
      for (const key of resultKeys) {
        try {
          const resultResponse = await this.db.get(key);
          let result = null;
          
          if (resultResponse && typeof resultResponse === 'object' && 'ok' in resultResponse) {
            result = resultResponse.ok ? resultResponse.value : null;
          } else {
            result = resultResponse;
          }
          
          if (result && typeof result === 'object' && typeof result.id === 'number') {
            results.push(result);
          }
        } catch (error) {
          console.warn(`Error retrieving result for key ${key}:`, error);
        }
      }
      
      results.sort((a, b) => b.id - a.id);
      return results;
    } catch (error) {
      console.error('Error getting all game results:', error);
      return [];
    }
  }

  async completeGameSession(id: number): Promise<GameSession> {
    const key = `session_${id}`;
    const response = await this.db.get(key);
    let session = null;
    
    if (response && typeof response === 'object' && 'ok' in response) {
      session = response.ok ? response.value : null;
    } else {
      session = response;
    }
    
    if (!session) throw new Error("Session not found");

    const completedSession = { ...session, isCompleted: 1 };
    await this.db.set(key, completedSession);
    return completedSession;
  }

  // Legacy methods for compatibility
  async saveGameResult(result: InsertGameResult): Promise<GameResult> {
    return await this.createGameResult(result);
  }

  calculateRoundScore(attempts: number, finalDistance: number): number {
    const baseScore = 5000;
    const attemptPenalty = (attempts - 1) * 300;
    const distancePenalty = Math.floor(finalDistance / 100);
    return Math.max(0, baseScore - attemptPenalty - distancePenalty);
  }
}

export const storage = new ReplitDbStorage();
