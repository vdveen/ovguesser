import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import GameHeader from "@/components/game-header";
import GameMap from "@/components/game-map";
import ResultModal from "@/components/result-modal";
import WinModal, { SessionCompleteModal } from "@/components/win-modal";
import { Loader2 } from "lucide-react";
import type { TrainStation, GameSession } from "@shared/schema";

interface GuessResult {
  distance: number;
  isWin: boolean;
  stationLocation: {
    lat: number;
    lng: number;
  };
  attempt: number;
}

interface PreviousGuess {
  lat: number;
  lng: number;
  distance: number;
  attempt: number;
}

export default function Game() {
  const [currentStation, setCurrentStation] = useState<TrainStation | null>(
    null,
  );
  const [attempts, setAttempts] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [lastGuess, setLastGuess] = useState<GuessResult | null>(null);
  const [userMarkerPosition, setUserMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [stationMarkerPosition, setStationMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationRevealed, setLocationRevealed] = useState(false);
  const [previousGuesses, setPreviousGuesses] = useState<PreviousGuess[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(
    null,
  );
  const [showSessionComplete, setShowSessionComplete] = useState(false);
  const [currentRoundDistance, setCurrentRoundDistance] = useState(0);
  const [currentRoundScore, setCurrentRoundScore] = useState<number | null>(
    null,
  );
  const [currentScore, setCurrentScore] = useState(5000);

  // Fetch new random station mutation
  const fetchStationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/stations/random");
      return response.json();
    },
    onSuccess: (station) => {
      console.log("Fetched new station:", station.name, station.id);
      console.log("Station coordinates:", station.coordinates);
      setCurrentStation(station);
    },
    onError: (error) => {
      console.error("Failed to fetch station:", error);
    },
  });

  // Submit guess mutation
  const guessMutation = useMutation({
    mutationFn: async (data: {
      stationId: number;
      userLat: number;
      userLng: number;
      attempt: number;
      sessionId: number;
    }) => {
      console.log("Sending guess to server with stationId:", data.stationId);
      const response = await apiRequest("POST", "/api/guess", data);
      const result = await response.json();
      console.log("Server response:", result);
      return result;
    },
    onSuccess: (result: GuessResult) => {
      setLastGuess(result);

      // Calculate current score: start with 5000, deduct based on attempts and distance
      const attemptPenalty = (result.attempt - 1) * 500; // 500 points per additional attempt
      const distancePenalty = Math.floor(result.distance / 100); // 1 point per 100m distance
      const newScore = Math.max(0, 5000 - attemptPenalty - distancePenalty);
      setCurrentScore(newScore);

      // Update round distance (cumulative for session tracking)
      const newRoundDistance = currentRoundDistance + result.distance;
      setCurrentRoundDistance(newRoundDistance);

      // Add current guess to previous guesses if not winning
      if (!result.isWin && userMarkerPosition) {
        setPreviousGuesses((prev) => [
          ...prev,
          {
            lat: userMarkerPosition.lat,
            lng: userMarkerPosition.lng,
            distance: result.distance,
            attempt: result.attempt,
          },
        ]);

        // Increment attempts for next guess only if not winning
        setAttempts((prev) => prev + 1);
      }

      if (result.isWin) {
        setStationMarkerPosition(result.stationLocation);
        setLocationRevealed(true);
        setShowWin(true);
      } else {
        setShowResult(true);
      }
    },
  });

  // Save game result mutation
  const saveResultMutation = useMutation({
    mutationFn: async (data: {
      stationId: number;
      attempts: number;
      finalDistance: number;
      totalRoundDistance: number;
      completed: number;
    }) => {
      const response = await apiRequest("POST", "/api/game-result", data);
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentRoundScore(result.score);
      // Invalidate stats to refresh them
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/session");
      return response.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session);
      // Fetch new station after session is created
      fetchStationMutation.mutate();
    },
  });

  // Complete game in session mutation
  const completeGameMutation = useMutation({
    mutationFn: async (data: { sessionId: number; roundScore: number }) => {
      const response = await apiRequest(
        "POST",
        `/api/session/${data.sessionId}/complete-game`,
        { roundScore: data.roundScore },
      );
      return response.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session);
      if (session.gamesCompleted >= 5) {
        setShowSessionComplete(true);
      } else {
        // Continue to next game if session isn't complete
        setTimeout(() => {
          startNewGame();
        }, 100); // Small delay to ensure UI state is clean
      }
    },
  });

  // Start new game
  const startNewGame = () => {
    console.log("Starting new game...");
    
    // Reset all game state
    setShowResult(false);
    setShowWin(false);
    setShowSessionComplete(false);
    setLastGuess(null);
    setAttempts(1);
    setUserMarkerPosition(null);
    setStationMarkerPosition(null);
    setLocationRevealed(false);
    setPreviousGuesses([]);
    setCurrentStation(null); // Clear current station immediately
    setCurrentRoundDistance(0);
    setCurrentRoundScore(null);
    // Always start new rounds with 5000 points (fresh start per round)
    setCurrentScore(5000);

    // Create new session if none exists or if current session is completed
    if (!currentSession || currentSession.gamesCompleted >= 5) {
      createSessionMutation.mutate();
    } else {
      // If session exists and is not complete, just fetch new station
      fetchStationMutation.mutate();
    }
  };

  // Start new session
  const startNewSession = () => {
    setShowSessionComplete(false);
    setCurrentSession(null);
    startNewGame();
  };

  // Handle map click
  const handleMapClick = (lat: number, lng: number) => {
    if (!currentStation || !currentSession || guessMutation.isPending) return;

    console.log("=== MAKING GUESS ===");
    console.log(
      "Current station in state:",
      currentStation.name,
      currentStation.id,
    );
    console.log("Current station coordinates:", currentStation.coordinates);
    console.log("User clicked at:", lat, lng);
    console.log("Attempt number:", attempts);

    setUserMarkerPosition({ lat, lng });

    guessMutation.mutate({
      stationId: currentStation.id,
      userLat: lat,
      userLng: lng,
      attempt: attempts,
      sessionId: currentSession.id,
    });
  };

  // Handle reveal location
  const handleRevealLocation = () => {
    if (lastGuess) {
      setStationMarkerPosition(lastGuess.stationLocation);
      setLocationRevealed(true);
      setShowResult(false);
      // Set current score to 0 when location is revealed
      setCurrentScore(0);
      // Don't automatically proceed to next game - let user click "Next Station" button
    }
  };

  // Handle proceeding to next game after location reveal
  const handleProceedAfterReveal = () => {
    if (currentStation && currentSession && lastGuess) {
      const totalRoundDistance = currentRoundDistance + lastGuess.distance;
      
      // Save result first
      saveResultMutation.mutate({
        stationId: currentStation.id,
        attempts,
        finalDistance: lastGuess.distance,
        totalRoundDistance,
        completed: 0, // Not a win since location was revealed
      });
      
      // Complete the game in session with 0 score
      completeGameMutation.mutate({
        sessionId: currentSession.id,
        roundScore: 0,
      });
    }
  };

  // Handle game completion
  const handleGameComplete = () => {
    if (currentStation && lastGuess && currentSession) {
      const totalRoundDistance = currentRoundDistance + lastGuess.distance;

      // Save result first
      saveResultMutation.mutate({
        stationId: currentStation.id,
        attempts,
        finalDistance: lastGuess.distance,
        totalRoundDistance,
        completed: lastGuess.isWin ? 1 : 0,
      });

      // Complete the game in session with current score
      completeGameMutation.mutate({
        sessionId: currentSession.id,
        roundScore: currentScore,
      });
    }
  };

  // Initialize first game
  useEffect(() => {
    startNewGame();
  }, []);

  if (fetchStationMutation.isPending && !currentStation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-blue-600" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Loading OVGuesser
          </h3>
          <p className="text-slate-600">Preparing Dutch train stations...</p>
        </div>
      </div>
    );
  }

  if (!currentStation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            No stations available
          </h3>
          <p className="text-slate-600">Failed to load train station data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Game Header */}
      <GameHeader
        stationName={currentStation.name}
        attempts={attempts}
        onNewGame={locationRevealed ? handleProceedAfterReveal : startNewGame}
        lastResult={showResult || locationRevealed ? lastGuess : null}
        onRevealLocation={handleRevealLocation}
        locationRevealed={locationRevealed}
        currentScore={currentScore}
        sessionProgress={
          currentSession
            ? {
                current: currentSession.gamesCompleted + 1,
                total: 5,
                totalAttempts: currentSession.totalAttempts,
                totalDistance: currentSession.totalDistance,
                totalScore: currentSession.totalScore,
              }
            : undefined
        }
      />

      {/* Game Map */}
      <GameMap
        onMapClick={handleMapClick}
        userMarker={userMarkerPosition}
        stationMarker={stationMarkerPosition}
        previousGuesses={previousGuesses}
        isLoading={guessMutation.isPending}
      />

      {/* Win Modal */}
      {showWin && lastGuess && currentStation && (
        <WinModal
          stationName={currentStation.name}
          finalDistance={lastGuess.distance}
          attempts={attempts}
          roundScore={currentScore}
          onNewGame={handleGameComplete}
          onClose={() => setShowWin(false)}
        />
      )}

      {/* Session Complete Modal */}
      {showSessionComplete && currentSession && (
        <SessionCompleteModal
          totalAttempts={currentSession.totalAttempts}
          totalDistance={currentSession.totalDistance}
          totalScore={currentSession.totalScore}
          gamesCompleted={currentSession.gamesCompleted}
          onNewSession={startNewSession}
          onClose={() => setShowSessionComplete(false)}
        />
      )}
    </div>
  );
}
