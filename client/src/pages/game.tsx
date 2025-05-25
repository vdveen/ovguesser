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
  const [currentStation, setCurrentStation] = useState<TrainStation | null>(null);
  const [attempts, setAttempts] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [lastGuess, setLastGuess] = useState<GuessResult | null>(null);
  const [userMarkerPosition, setUserMarkerPosition] = useState<{lat: number, lng: number} | null>(null);
  const [stationMarkerPosition, setStationMarkerPosition] = useState<{lat: number, lng: number} | null>(null);
  const [locationRevealed, setLocationRevealed] = useState(false);
  const [previousGuesses, setPreviousGuesses] = useState<PreviousGuess[]>([]);
  const [currentSession, setCurrentSession] = useState<GameSession | null>(null);
  const [showSessionComplete, setShowSessionComplete] = useState(false);

  // Fetch game statistics
  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch new random station mutation
  const fetchStationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/stations/random");
      return response.json();
    },
    onSuccess: (station) => {
      console.log('Fetched new station:', station.name, station.id);
      console.log('Station coordinates:', station.coordinates);
      setCurrentStation(station);
    },
    onError: (error) => {
      console.error('Failed to fetch station:', error);
    }
  });

  // Submit guess mutation
  const guessMutation = useMutation({
    mutationFn: async (data: { stationId: number; userLat: number; userLng: number; attempt: number; sessionId: number }) => {
      console.log('Sending guess to server with stationId:', data.stationId);
      const response = await apiRequest("POST", "/api/guess", data);
      const result = await response.json();
      console.log('Server response:', result);
      return result;
    },
    onSuccess: (result: GuessResult) => {
      setLastGuess(result);
      
      // Add current guess to previous guesses if not winning
      if (!result.isWin && userMarkerPosition) {
        setPreviousGuesses(prev => [...prev, {
          lat: userMarkerPosition.lat,
          lng: userMarkerPosition.lng,
          distance: result.distance,
          attempt: result.attempt
        }]);
        
        // Increment attempts for next guess only if not winning
        setAttempts(prev => prev + 1);
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
    mutationFn: async (data: { stationId: number; attempts: number; finalDistance: number; completed: number }) => {
      const response = await apiRequest("POST", "/api/game-result", data);
      return response.json();
    },
    onSuccess: () => {
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
    },
  });

  // Complete game in session mutation
  const completeGameMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await apiRequest("POST", `/api/session/${sessionId}/complete-game`);
      return response.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session);
      if (session.gamesCompleted >= 5) {
        setShowSessionComplete(true);
      }
    },
  });

  // Start new game
  const startNewGame = () => {
    setShowResult(false);
    setShowWin(false);
    setLastGuess(null);
    setAttempts(1);
    setUserMarkerPosition(null);
    setStationMarkerPosition(null);
    setLocationRevealed(false);
    setPreviousGuesses([]);
    setCurrentStation(null); // Clear current station immediately
    
    console.log('Starting new game...');
    
    // Create new session if none exists or if current session is completed
    if (!currentSession || currentSession.gamesCompleted >= 5) {
      createSessionMutation.mutate();
    }
    
    // Fetch new station
    fetchStationMutation.mutate();
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
    
    console.log('=== MAKING GUESS ===');
    console.log('Current station in state:', currentStation.name, currentStation.id);
    console.log('Current station coordinates:', currentStation.coordinates);
    console.log('User clicked at:', lat, lng);
    console.log('Attempt number:', attempts);
    
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
    }
  };

  // Handle game completion
  const handleGameComplete = () => {
    if (currentStation && lastGuess && currentSession) {
      saveResultMutation.mutate({
        stationId: currentStation.id,
        attempts,
        finalDistance: lastGuess.distance,
        completed: lastGuess.isWin ? 1 : 0,
      });
      
      // Complete game in session
      completeGameMutation.mutate(currentSession.id);
    }
    
    // Only start new game if session isn't complete
    if (!currentSession || currentSession.gamesCompleted < 4) {
      startNewGame();
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
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Loading OVGuesser</h3>
          <p className="text-slate-600">Preparing Dutch train stations...</p>
        </div>
      </div>
    );
  }

  if (!currentStation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No stations available</h3>
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
        stats={stats}
        onNewGame={startNewGame}
        lastResult={showResult ? lastGuess : null}
        onRevealLocation={handleRevealLocation}
        sessionProgress={currentSession ? {
          current: currentSession.gamesCompleted + 1,
          total: 5,
          totalAttempts: currentSession.totalAttempts,
          totalDistance: currentSession.totalDistance
        } : undefined}
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
          onNewGame={handleGameComplete}
          onClose={() => setShowWin(false)}
        />
      )}

      {/* Session Complete Modal */}
      {showSessionComplete && currentSession && (
        <SessionCompleteModal
          totalAttempts={currentSession.totalAttempts}
          totalDistance={currentSession.totalDistance}
          gamesCompleted={currentSession.gamesCompleted}
          onNewSession={startNewSession}
          onClose={() => setShowSessionComplete(false)}
        />
      )}
    </div>
  );
}
