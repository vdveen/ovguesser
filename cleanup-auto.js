
import { databaseCleaner } from "./server/cleanup.js";

console.log("=== Manual Database Cleanup ===");
console.log("This will clean up old game results and sessions to prevent hitting the 5000 key limit.");

async function runManualCleanup() {
  try {
    await databaseCleaner.runCleanup();
    console.log("✅ Manual cleanup completed!");
  } catch (error) {
    console.error("❌ Manual cleanup failed:", error);
  }
}

runManualCleanup();
