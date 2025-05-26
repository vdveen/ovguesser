
import fs from "fs";
import path from "path";

interface GameLogEntry {
  stationName: string;
  attempts: number;
  finalDistance: number;
  score: number;
  completed: boolean;
  timestamp: string;
}

export class GameLogger {
  private logFilePath: string;

  constructor() {
    this.logFilePath = path.resolve(import.meta.dirname, "../game_results.csv");
    this.initializeLogFile();
  }

  private initializeLogFile() {
    // Check if file exists, if not create it with headers
    if (!fs.existsSync(this.logFilePath)) {
      const headers = "Timestamp,Station,Attempts,Distance_m,Score,Completed\n";
      fs.writeFileSync(this.logFilePath, headers, "utf8");
      console.log("Game results log file created:", this.logFilePath);
    }
  }

  logGameResult(entry: GameLogEntry) {
    try {
      const csvLine = `${entry.timestamp},"${entry.stationName}",${entry.attempts},${entry.finalDistance},${entry.score},${entry.completed}\n`;
      fs.appendFileSync(this.logFilePath, csvLine, "utf8");
      console.log(`Logged game result: ${entry.stationName} - ${entry.attempts} attempts`);
    } catch (error) {
      console.error("Failed to log game result:", error);
    }
  }
}

export const gameLogger = new GameLogger();
