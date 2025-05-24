import { pgTable, text, serial, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const trainStations = pgTable("train_stations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  coordinates: jsonb("coordinates").notNull(), // [longitude, latitude]
  properties: jsonb("properties"), // additional station properties
});

export const gameStats = pgTable("game_stats", {
  id: serial("id").primaryKey(),
  totalGames: integer("total_games").notNull().default(0),
  totalAttempts: integer("total_attempts").notNull().default(0),
  bestDistance: real("best_distance"), // in meters
  averageDistance: real("average_distance"), // in meters
});

export const gameResults = pgTable("game_results", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").references(() => trainStations.id),
  attempts: integer("attempts").notNull(),
  finalDistance: real("final_distance").notNull(), // in meters
  completed: integer("completed").notNull().default(0), // boolean as integer
});

export const insertTrainStationSchema = createInsertSchema(trainStations).omit({
  id: true,
});

export const insertGameStatsSchema = createInsertSchema(gameStats).omit({
  id: true,
});

export const insertGameResultSchema = createInsertSchema(gameResults).omit({
  id: true,
});

export type TrainStation = typeof trainStations.$inferSelect;
export type InsertTrainStation = z.infer<typeof insertTrainStationSchema>;

export type GameStats = typeof gameStats.$inferSelect;
export type InsertGameStats = z.infer<typeof insertGameStatsSchema>;

export type GameResult = typeof gameResults.$inferSelect;
export type InsertGameResult = z.infer<typeof insertGameResultSchema>;

// GeoJSON types for frontend
export interface StationFeature {
  type: "Feature";
  properties: {
    name: string;
    [key: string]: any;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  id?: string;
}

export interface StationCollection {
  type: "FeatureCollection";
  features: StationFeature[];
}
