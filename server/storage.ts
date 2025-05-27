
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
    const currentId = await this.db.get(counterKey) || 0;
    const nextId = currentId + 1;
    await this.db.set(counterKey, nextId);
    return nextId;
  }

  // Train station methods
  async getAllStations(): Promise<TrainStation[]> {
    const keys = await this.db.list("station_");
    const stations: TrainStation[] = [];
    
    for (const key of keys) {
      const station = await this.db.get(key);
      if (station) {
        stations.push(station);
      }
    }
    
    return stations;
  }

  async getStationById(id: number): Promise<TrainStation | undefined> {
    const key = `station_${id}`;
    return await this.db.get(key);
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
    let stats = await this.db.get(key);
    
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
    const keys = await this.db.list("result_");
    
    // Sort keys by ID (assuming higher IDs are more recent)
    const sortedKeys = keys.sort((a, b) => {
      const idA = parseInt(a.replace("result_", ""));
      const idB = parseInt(b.replace("result_", ""));
      return idB - idA; // Descending order
    });

    const recentKeys = sortedKeys.slice(0, limit);
    const results: GameResult[] = [];

    for (const key of recentKeys) {
      const result = await this.db.get(key);
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
    const session = await this.db.get(key);
    if (!session) throw new Error("Session not found");

    const updatedSession = { ...session, ...sessionUpdate };
    await this.db.set(key, updatedSession);
    return updatedSession;
  }

  async getCurrentGameSession(): Promise<GameSession | undefined> {
    // Get all session keys and find the one with highest ID (most recent)
    const keys = await this.db.list("session_");
    
    if (keys.length === 0) return undefined;

    const sortedKeys = keys.sort((a, b) => {
      const idA = parseInt(a.replace("session_", ""));
      const idB = parseInt(b.replace("session_", ""));
      return idB - idA; // Descending order
    });

    const mostRecentKey = sortedKeys[0];
    return await this.db.get(mostRecentKey);
  }

  async getGameSessionById(id: number): Promise<GameSession | undefined> {
    const key = `session_${id}`;
    return await this.db.get(key);
  }

  async completeGameSession(id: number): Promise<GameSession> {
    const key = `session_${id}`;
    const session = await this.db.get(key);
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
