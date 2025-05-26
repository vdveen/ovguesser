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
  type StationFeature 
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
  updateGameSession(id: number, session: Partial<GameSession>): Promise<GameSession>;
  getCurrentGameSession(): Promise<GameSession | undefined>;
  completeGameSession(id: number): Promise<GameSession>;
}

export class MemStorage implements IStorage {
  private stations: Map<number, TrainStation>;
  private gameStats: GameStats | null;
  private gameResults: Map<number, GameResult>;
  private gameSessions: Map<number, GameSession>;
  private currentStationId: number;
  private currentResultId: number;
  private currentSessionId: number;
  private activeSessionId: number | null;

  constructor() {
    this.stations = new Map();
    this.gameStats = null;
    this.gameResults = new Map();
    this.gameSessions = new Map();
    this.currentStationId = 1;
    this.currentResultId = 1;
    this.currentSessionId = 1;
    this.activeSessionId = null;
  }

  async getAllStations(): Promise<TrainStation[]> {
    return Array.from(this.stations.values());
  }

  async getStationById(id: number): Promise<TrainStation | undefined> {
    return this.stations.get(id);
  }

  async getRandomStation(): Promise<TrainStation | undefined> {
    const stations = Array.from(this.stations.values());
    if (stations.length === 0) return undefined;

    const randomIndex = Math.floor(Math.random() * stations.length);
    return stations[randomIndex];
  }

  async createStation(insertStation: InsertTrainStation): Promise<TrainStation> {
    const id = this.currentStationId++;
    const station: TrainStation = { ...insertStation, id };
    this.stations.set(id, station);
    return station;
  }

  async loadStationsFromGeoJSON(geoJsonData: any): Promise<void> {
    if (!geoJsonData?.features) return;

    for (const feature of geoJsonData.features) {
      if (feature.geometry?.type === "Point" && feature.properties?.name) {
        await this.createStation({
          name: feature.properties.name,
          coordinates: feature.geometry.coordinates,
          properties: feature.properties,
        });
      }
    }
  }

  async getGameStats(): Promise<GameStats | undefined> {
    if (!this.gameStats) {
      this.gameStats = {
        id: 1,
        totalGames: 0,
        totalAttempts: 0,
        bestDistance: null,
        averageDistance: null,
      };
    }
    return this.gameStats;
  }

  async updateGameStats(statsUpdate: Partial<GameStats>): Promise<GameStats> {
    const currentStats = await this.getGameStats();
    this.gameStats = { ...currentStats!, ...statsUpdate };
    return this.gameStats;
  }

  async createGameResult(insertResult: InsertGameResult): Promise<GameResult> {
    const id = this.currentResultId++;
    const result: GameResult = { ...insertResult, id };
    this.gameResults.set(id, result);
    return result;
  }

  async getRecentResults(limit: number = 10): Promise<GameResult[]> {
    const results = Array.from(this.gameResults.values());
    return results.slice(-limit).reverse();
  }

  async createGameSession(): Promise<GameSession> {
    const id = this.currentSessionId++;
    const session: GameSession = {
      id,
      totalAttempts: 0,
      totalDistance: 0,
      gamesCompleted: 0,
      isCompleted: 0,
      totalScore: 0,
    };
    this.gameSessions.set(id, session);
    this.activeSessionId = id;
    return session;
  }

  async updateGameSession(id: number, sessionUpdate: Partial<GameSession>): Promise<GameSession> {
    const session = this.gameSessions.get(id);
    if (!session) throw new Error("Session not found");

    const updatedSession = { ...session, ...sessionUpdate };
    this.gameSessions.set(id, updatedSession);
    return updatedSession;
  }

  async getCurrentGameSession(): Promise<GameSession | undefined> {
    if (!this.activeSessionId) return undefined;
    return this.gameSessions.get(this.activeSessionId);
  }

  async completeGameSession(id: number): Promise<GameSession> {
    const session = this.gameSessions.get(id);
    if (!session) throw new Error("Session not found");

    const completedSession = { ...session, isCompleted: 1 };
    this.gameSessions.set(id, completedSession);
    this.activeSessionId = null;
    return completedSession;
  }

  async saveGameResult(result: InsertGameResult): Promise<GameResult> {
    return await this.createGameResult(result);
  }

  calculateRoundScore(attempts: number, totalRoundDistance: number): number {
    const baseScore = 5000;

    // Deduct 750 points for each extra attempt beyond the first
    const attemptPenalty = (attempts - 1) * 750;

    // Deduct points based on total distance (meters / 50)
    const distancePenalty = Math.floor(totalRoundDistance / 50);

    // Calculate final score, minimum 0
    const finalScore = Math.max(0, baseScore - attemptPenalty - distancePenalty);

    return finalScore;
  }
}

export const storage = new MemStorage();