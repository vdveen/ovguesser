import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import fs from "fs";
import path from "path";

// Load GeoJSON data on startup
async function loadStationData() {
  try {
    const geoJsonPath = path.resolve(import.meta.dirname, "../attached_assets/export(2).geojson");
    const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, "utf-8"));
    await storage.loadStationsFromGeoJSON(geoJsonData);
    console.log("Loaded train station data successfully");
  } catch (error) {
    console.error("Failed to load station data:", error);
  }
}

const guessSchema = z.object({
  stationId: z.number(),
  userLat: z.number(),
  userLng: z.number(),
  attempt: z.number(),
});

const gameResultSchema = z.object({
  stationId: z.number(),
  attempts: z.number(),
  finalDistance: z.number(),
  completed: z.number(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Load station data
  await loadStationData();

  // Get all stations
  app.get("/api/stations", async (req, res) => {
    try {
      const stations = await storage.getAllStations();
      res.json(stations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stations" });
    }
  });

  // Get random station for new game
  app.get("/api/stations/random", async (req, res) => {
    try {
      const station = await storage.getRandomStation();
      if (!station) {
        return res.status(404).json({ error: "No stations available" });
      }
      res.json(station);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch random station" });
    }
  });

  // Get specific station by ID
  app.get("/api/stations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const station = await storage.getStationById(id);
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }
      res.json(station);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch station" });
    }
  });

  // Calculate distance for a guess
  app.post("/api/guess", async (req, res) => {
    try {
      const { stationId, userLat, userLng, attempt } = guessSchema.parse(req.body);
      
      const station = await storage.getStationById(stationId);
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      const stationCoords = station.coordinates as [number, number];
      const stationLat = stationCoords[1];
      const stationLng = stationCoords[0];

      // Calculate distance using Haversine formula
      const distance = calculateDistance(userLat, userLng, stationLat, stationLng);
      
      const isWin = distance <= 500;
      
      res.json({
        distance: Math.round(distance),
        isWin,
        stationLocation: {
          lat: stationLat,
          lng: stationLng,
        },
        attempt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to process guess" });
    }
  });

  // Save game result
  app.post("/api/game-result", async (req, res) => {
    try {
      const resultData = gameResultSchema.parse(req.body);
      const result = await storage.createGameResult(resultData);
      
      // Update game statistics
      const stats = await storage.getGameStats();
      const newTotalGames = (stats?.totalGames || 0) + 1;
      const newTotalAttempts = (stats?.totalAttempts || 0) + resultData.attempts;
      const newBestDistance = stats?.bestDistance 
        ? Math.min(stats.bestDistance, resultData.finalDistance)
        : resultData.finalDistance;
      
      await storage.updateGameStats({
        totalGames: newTotalGames,
        totalAttempts: newTotalAttempts,
        bestDistance: newBestDistance,
        averageDistance: newTotalAttempts / newTotalGames,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid result data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save game result" });
    }
  });

  // Get game statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getGameStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch game statistics" });
    }
  });

  // Get recent game results
  app.get("/api/results", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const results = await storage.getRecentResults(limit);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch game results" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Haversine formula for calculating distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
