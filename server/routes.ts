import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { gameLogger } from "./logger";
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

const gameSessionAttemptSchema = z.object({
  stationId: z.number(),
  userLat: z.number(),
  userLng: z.number(),
  attempt: z.number(),
  sessionId: z.number(),
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
      const { stationId, userLat, userLng, attempt, sessionId } = gameSessionAttemptSchema.parse(req.body);

      const station = await storage.getStationById(stationId);
      if (!station) {
        return res.status(404).json({ error: "Station not found" });
      }

      console.log(`Processing guess for station: ${station.name} (ID: ${stationId})`);
      console.log(`Station coordinates from storage:`, station.coordinates);

      const stationCoords = station.coordinates as [number, number];
      const stationLat = stationCoords[1];
      const stationLng = stationCoords[0];

      console.log(`Using station coordinates: lat=${stationLat}, lng=${stationLng}`);
      console.log(`User guess coordinates: lat=${userLat}, lng=${userLng}`);

      // Calculate distance using Haversine formula
      const distance = calculateDistance(userLat, userLng, stationLat, stationLng);

      const isWin = distance <= 500;

      console.log(`Calculated distance: ${distance}m, isWin: ${isWin}`);

      // Update session with this attempt
      const session = await storage.getCurrentGameSession();
      if (session && session.id === sessionId) {
        await storage.updateGameSession(sessionId, {
          totalAttempts: session.totalAttempts + 1,
          totalDistance: session.totalDistance + distance,
        });
      }

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
      const { stationId, attempts, finalDistance, totalRoundDistance, completed } = req.body;

      // Get station info for logging
      const station = await storage.getStationById(stationId);
      const stationName = station?.name || "Unknown";

      // Calculate score for this round using final distance (not cumulative)
      const score = storage.calculateRoundScore(attempts, finalDistance);

      const result = {
        stationId,
        attempts,
        finalDistance,
        totalRoundDistance,
        score,
        completed
      };

      await storage.saveGameResult(result);

      // Log to CSV file
      gameLogger.logGameResult({
        stationName,
        attempts,
        finalDistance,
        score,
        completed: completed === 1,
        timestamp: new Date().toISOString()
      });

      // Update global stats
      const currentStats = await storage.getGameStats();
      if (currentStats) {
        const newTotalGames = currentStats.totalGames + 1;
        const newTotalAttempts = currentStats.totalAttempts + result.attempts;
        
        // Update best distance if this is better or first game
        let newBestDistance = currentStats.bestDistance;
        if (result.completed === 1 && (newBestDistance === null || result.finalDistance < newBestDistance)) {
          newBestDistance = result.finalDistance;
        }

        // Calculate new average distance
        const newAverageDistance = (currentStats.averageDistance || 0) * currentStats.totalGames + result.finalDistance;
        const updatedAverageDistance = newAverageDistance / newTotalGames;

        await storage.updateGameStats({
          totalGames: newTotalGames,
          totalAttempts: newTotalAttempts,
          bestDistance: newBestDistance,
          averageDistance: updatedAverageDistance,
        });
      }

      res.json({ success: true, score });
    } catch (error) {
      console.error('Failed to save game result:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
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

  // Create new game session
  app.post("/api/session", async (req, res) => {
    try {
      const session = await storage.createGameSession();
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create game session" });
    }
  });

  // Get current game session
  app.get("/api/session/current", async (req, res) => {
    try {
      const session = await storage.getCurrentGameSession();
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch current session" });
    }
  });

  // Complete game in session
  app.post("/api/session/:id/complete-game", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { roundScore } = req.body;
      const session = await storage.getCurrentGameSession();

      if (!session || session.id !== sessionId) {
        return res.status(404).json({ error: "Session not found" });
      }

      const updatedSession = await storage.updateGameSession(sessionId, {
        gamesCompleted: session.gamesCompleted + 1,
        totalScore: session.totalScore + (roundScore || 0),
        isCompleted: session.gamesCompleted + 1 >= 5
      });

      res.json(updatedSession);
    } catch (error) {
      console.error('Failed to complete game in session:', error);
      res.status(500).json({ error: "Failed to complete game in session" });
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