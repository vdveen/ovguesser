import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Train, RotateCcw, Crosshair, Info, Target, Eye, SkipForward } from "lucide-react";
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
  onTryAgain?: () => void;
  onRevealLocation?: () => void;
}

export default function GameHeader({ stationName, attempts, stats, onNewGame, lastResult, onTryAgain, onRevealLocation }: GameHeaderProps) {
  const displayDistance = lastResult ? formatDistance(lastResult.distance) : null;
  const resultInfo = lastResult ? getAccuracyRating(lastResult.distance) : null;

  return (
    <div className="absolute top-4 left-4 right-4 z-[1000] md:left-6 md:right-auto md:top-6">
      <Card className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg max-w-md">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Train className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">OVGuesser</h1>
            <Button
              onClick={onNewGame}
              variant="outline"
              size="sm"
              className="ml-auto"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
          
          {/* Station Display */}
          <div className="mb-4">
            <p className="text-sm text-slate-600 mb-1">Find this train station:</p>
            <div className="bg-slate-100 rounded-lg p-3">
              <span className="text-lg font-semibold text-slate-900">{stationName}</span>
            </div>
          </div>

          {/* Result Display */}
          {lastResult && resultInfo && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border-l-4" style={{ borderLeftColor: resultInfo.color }}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {lastResult.isWin ? '🎯 Great guess!' : resultInfo.description}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-600">Distance:</span>
                  <div className="text-lg font-bold" style={{ color: resultInfo.color }}>
                    {displayDistance}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!lastResult.isWin && onTryAgain && (
                    <Button size="sm" variant="outline" onClick={onTryAgain}>
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Try Again
                    </Button>
                  )}
                  {!lastResult.isWin && onRevealLocation && (
                    <Button size="sm" variant="outline" onClick={onRevealLocation}>
                      <Eye className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Game Stats */}
          {!lastResult && (
            <div className="flex items-center justify-between text-sm mb-4">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-blue-600" />
                <span className="text-slate-600">Attempt <span className="font-medium">{attempts}</span></span>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <Info className="w-3 h-3" />
                <span className="text-xs">Click to place pin</span>
              </div>
            </div>
          )}
          
          {/* Stats Display (Desktop) */}
          {stats && (
            <div className="hidden md:block pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-600">Games Played</div>
                  <div className="font-semibold text-slate-900">{stats.totalGames}</div>
                </div>
                <div>
                  <div className="text-slate-600">Best Distance</div>
                  <div className="font-semibold text-slate-900">
                    {stats.bestDistance ? formatDistance(stats.bestDistance) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
