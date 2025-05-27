
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

  // Game session methods
  createGameSession(): Promise<GameSession>;
  updateGameSession(
    id: number,
    session: Partial<GameSession>,
  ): Promise<GameSession>;
  getCurrentGameSession(): Promise<GameSession | undefined>;
  getGameSessionById(id: number): Promise<GameSession | undefined>;
  completeGameSession(id: number): Promise<GameSession>;
}

export class ReplitDbStorage implements IStorage {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  // Helper methods for ID management
  private async getNextId(type: 'station' | 'result' | 'session'): Promise<number> {
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

  // Train station methods
  async getAllStations(): Promise<TrainStation[]> {
    try {
      // First try to get all keys without prefix, then filter
      const allKeysResponse = await this.db.list();
      let allKeys: string[] = [];
      
      if (allKeysResponse && typeof allKeysResponse === 'object' && 'ok' in allKeysResponse) {
        allKeys = allKeysResponse.ok ? (allKeysResponse.value || []) : [];
      } else {
        allKeys = Array.isArray(allKeysResponse) ? allKeysResponse : [];
      }
      
      // Filter for station keys only
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
          } else {
            console.warn(`Invalid station data for key ${key}:`, station);
          }
        } catch (error) {
          console.warn(`Error retrieving station for key ${key}:`, error);
        }
      }
      
      console.log(`Successfully loaded ${stations.length} stations from database`);
      return stations;
    } catch (error) {
      console.error('Error getting all stations:', error);
      return [];
    }
  }

  async getStationById(id: number): Promise<TrainStation | undefined> {
    const key = `station_${id}`;
    const response = await this.db.get(key);
    
    if (response && typeof response === 'object' && 'ok' in response) {
      return response.ok ? response.value : undefined;
    }
    
    return response || undefined;
  }

  async getRandomStation(): Promise<TrainStation | undefined> {
    const stations = await this.getAllStations();
    if (stations.length === 0) return undefined;

    const randomIndex = Math.floor(Math.random() * stations.length);
    return stations[randomIndex];
  }

  async createStation(insertStation: InsertTrainStation): Promise<TrainStation> {
    const id = await this.getNextId('station');
    const station: TrainStation = { ...insertStation, id };
    const key = `station_${id}`;
    await this.db.set(key, station);
    return station;
  }

  async loadStationsFromGeoJSON(geoJsonData: any): Promise<void> {
    if (!geoJsonData?.features) return;

    // Check if stations are already loaded to avoid duplicates
    const existingStations = await this.getAllStations();
    if (existingStations.length > 0) {
      console.log("Stations already loaded, skipping GeoJSON import");
      return;
    }

    console.log(`Loading ${geoJsonData.features.length} stations from GeoJSON...`);

    for (const feature of geoJsonData.features) {
      if (feature.geometry?.type === "Point" && feature.properties?.name) {
        await this.createStation({
          name: feature.properties.name,
          coordinates: feature.geometry.coordinates,
          properties: feature.properties,
        });
      }
    }

    console.log("Finished loading stations from GeoJSON");
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
    const response = await this.db.list({ prefix: "result_" });
    let keys: string[] = [];
    
    if (response && typeof response === 'object' && 'ok' in response) {
      keys = response.ok ? (response.value || []) : [];
    } else {
      keys = Array.isArray(response) ? response : [];
    }
    
    // Sort keys by ID (assuming higher IDs are more recent)
    const sortedKeys = keys.sort((a, b) => {
      const idA = parseInt(a.replace("result_", ""));
      const idB = parseInt(b.replace("result_", ""));
      return idB - idA; // Descending order
    });

    const recentKeys = sortedKeys.slice(0, limit);
    const results: GameResult[] = [];

    for (const key of recentKeys) {
      const resultResponse = await this.db.get(key);
      let result = null;
      
      if (resultResponse && typeof resultResponse === 'object' && 'ok' in resultResponse) {
        result = resultResponse.ok ? resultResponse.value : null;
      } else {
        result = resultResponse;
      }
      
      if (result) {
        results.push(result);
      }
    }

    return results;
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
    // Get all session keys and find the one with highest ID (most recent)
    const response = await this.db.list({ prefix: "session_" });
    let keys: string[] = [];
    
    if (response && typeof response === 'object' && 'ok' in response) {
      keys = response.ok ? (response.value || []) : [];
    } else {
      keys = Array.isArray(response) ? response : [];
    }
    
    if (keys.length === 0) return undefined;

    const sortedKeys = keys.sort((a, b) => {
      const idA = parseInt(a.replace("session_", ""));
      const idB = parseInt(b.replace("session_", ""));
      return idB - idA; // Descending order
    });

    const mostRecentKey = sortedKeys[0];
    const sessionResponse = await this.db.get(mostRecentKey);
    
    if (sessionResponse && typeof sessionResponse === 'object' && 'ok' in sessionResponse) {
      return sessionResponse.ok ? sessionResponse.value : undefined;
    }
    
    return sessionResponse || undefined;
  }

  async getGameSessionById(id: number): Promise<GameSession | undefined> {
    const key = `session_${id}`;
    const response = await this.db.get(key);
    
    if (response && typeof response === 'object' && 'ok' in response) {
      return response.ok ? response.value : undefined;
    }
    
    return response || undefined;
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
    const attemptPenalty = (attempts - 1) * 300; // 300 points per additional attempt
    const distancePenalty = Math.floor(finalDistance / 100); // 1 point per 100m distance
    return Math.max(0, baseScore - attemptPenalty - distancePenalty);
  }
}

export const storage = new ReplitDbStorage();
