import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Train,
  RotateCcw,
  Crosshair,
  Info,
  Target,
  Eye,
  SkipForward, Trophy
} from "lucide-react";
import type { GameStats } from "@shared/schema";
import { formatDistance, getAccuracyRating } from "@/lib/distance";

interface GameResult {
  distance: number;
  isWin: boolean;
}

interface GameHeaderProps {
  stationName: string;
  attempts: number;
  stats?: GameStats;
  onNewGame: () => void;
  lastResult?: GameResult | null;
  onRevealLocation?: () => void;
  sessionProgress?: {
    current: number;
    total: number;
    totalAttempts: number;
    totalDistance: number;
    totalScore: number;
  };
  currentScore: number;
}

export default function GameHeader({
  stationName,
  attempts,
  stats,
  onNewGame,
  lastResult,
  onRevealLocation,
  sessionProgress,
  currentScore,
}: GameHeaderProps) {
  const displayDistance = lastResult
    ? formatDistance(lastResult.distance)
    : null;
  const resultInfo = lastResult ? getAccuracyRating(lastResult.distance) : null;

  return (
    <div className="absolute top-4 left-4 right-4 z-[1000] md:left-6 md:right-auto md:top-6">
      <Card className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg max-w-md">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Train className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                OVGuesser
              </h1>
              {sessionProgress && (
                <div className="text-xs text-slate-600">
                  <p>Best of 5 - Spel {sessionProgress.current}/5</p>
                  <p className="text-purple-600 font-medium">Score: {sessionProgress.totalScore.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Station Display */}
          <div className="mb-4">
            <p className="text-sm text-slate-600 mb-3">Waar ligt station...</p>
            <div className="bg-blue-600 p-3 rounded-none relative flex items-center gap-3">
              <div className="w-5 h-5 bg-white flex-shrink-0 absolute top-0 left-0"></div>
              <span className="text-lg font-semibold text-white ml-8">
                {stationName}
              </span>
            </div>
          </div>

          {/* Result Display or Initial Tooltip */}
          {lastResult && resultInfo ? (
            <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {/* Icon/text row */}
              <div className="hidden md:flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {lastResult.isWin
                    ? "🎯 Geweldige gok!"
                    : resultInfo.description}
                </span>
              </div>

              {/* Distance and Attempts side by side */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-600">Afstand:</span>
                  <div
                    className="text-lg font-bold"
                    style={{ color: resultInfo.color }}
                  >
                    {displayDistance}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-slate-600">Pogingen:</span>
                  <div
                    className="text-lg font-bold"
                    style={{
                      color:
                        attempts - 1 <= 2
                          ? "#10b981"
                          : attempts - 1 <= 4
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  >
                    {attempts - 1}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-center cursor-help">
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Crosshair className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Klik op de kaart om te gokken
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Klik ergens op de kaart om te raden waar dit treinstation
                    zich bevindt
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Button Row */}
          {lastResult && !lastResult.isWin && onRevealLocation && (
            <div className="flex gap-2 mb-4">
              <Button
                size="sm"
                variant="outline"
                onClick={onRevealLocation}
                className="w-full"
              >
                <Eye className="w-3 h-3 mr-1" />
                Onthul locatie
              </Button>
            </div>
          )}

          {/* Game Stats */}

          {/* Stats Display (Desktop) */}
          {stats && (
            <div className="hidden md:block pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-600">Stations geraden</div>
                  <div className="font-semibold text-slate-900">
                    {stats.totalGames}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Laagste afstand</div>
                  <div className="font-semibold text-slate-900">
                    {stats.bestDistance
                      ? formatDistance(stats.bestDistance)
                      : "∞"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attribution - hidden on mobile */}
          <div className="hidden md:block  pt-4 text-center">
            <p className="text-xs text-slate-300">
              Gemaakt door Anne v/d Veen met Replit en Sonnet 4
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}