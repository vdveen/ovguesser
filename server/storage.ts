import { 
  trainStations, 
  gameStats, 
  gameResults,
  type TrainStation, 
  type InsertTrainStation,
  type GameStats,
  type InsertGameStats,
  type GameResult,
  type InsertGameResult,
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
}

export class MemStorage implements IStorage {
  private stations: Map<number, TrainStation>;
  private gameStats: GameStats | null;
  private gameResults: Map<number, GameResult>;
  private currentStationId: number;
  private currentResultId: number;

  constructor() {
    this.stations = new Map();
    this.gameStats = null;
    this.gameResults = new Map();
    this.currentStationId = 1;
    this.currentResultId = 1;
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
}

export const storage = new MemStorage();
