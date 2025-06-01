
console.log("=== Manual Database Cleanup ===");
console.log("This will clean up old game results and sessions to prevent hitting the 5000 key limit.");

// Import dynamically to handle TypeScript
async function runManualCleanup() {
  try {
    const { databaseCleaner } = await import("./server/cleanup.ts");
    await databaseCleaner.runCleanup();
    console.log("✅ Manual cleanup completed!");
  } catch (error) {
    console.error("❌ Manual cleanup failed:", error);
  }
}

runManualCleanup();
