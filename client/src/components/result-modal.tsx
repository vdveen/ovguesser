import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, RotateCcw, SkipForward, X, Eye } from "lucide-react";

interface ResultModalProps {
  distance: number;
  onTryAgain: () => void;
  onNewGame: () => void;
  onRevealLocation: () => void;
  onClose: () => void;
}

export default function ResultModal({ distance, onTryAgain, onNewGame, onRevealLocation, onClose }: ResultModalProps) {
  const distanceKm = distance / 1000;
  const displayDistance = distance > 1000 
    ? `${distanceKm.toFixed(1)} km` 
    : `${distance}m`;

  const getResultInfo = () => {
    if (distance <= 500) {
      return {
        icon: "🎉",
        title: "Uitstekend!",
        message: "Je hebt het station gevonden!",
        color: "text-emerald-600",
        bgColor: "bg-emerald-100",
      };
    } else if (distance <= 2000) {
      return {
        icon: "🎯",
        title: "Heel Dichtbij!",
        message: "Je komt warmer!",
        color: "text-amber-600",
        bgColor: "bg-amber-100",
      };
    } else if (distance <= 10000) {
      return {
        icon: "🧭",
        title: "Getting Closer",
        message: "Try a different area!",
        color: "text-blue-600",
        bgColor: "bg-blue-100",
      };
    } else {
      return {
        icon: "📍",
        title: "Far Away",
        message: "Think about the region!",
        color: "text-red-600",
        bgColor: "bg-red-100",
      };
    }
  };

  const resultInfo = getResultInfo();

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[1001] p-4">
      <Card className="w-full max-w-sm mx-auto shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-between items-start mb-2">
            <div></div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${resultInfo.bgColor}`}>
            <span className="text-3xl">{resultInfo.icon}</span>
          </div>
          
          <CardTitle className="text-xl">{resultInfo.title}</CardTitle>
          <p className="text-slate-600 text-sm">{resultInfo.message}</p>
        </CardHeader>
        
        <CardContent className="text-center">
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">Distance from target:</span>
            </div>
            <div className={`text-3xl font-bold ${resultInfo.color}`}>
              {displayDistance}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={onTryAgain}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            
            <Button 
              onClick={onRevealLocation}
              variant="outline"
              className="border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              <Eye className="w-4 h-4 mr-2" />
              Reveal Location
            </Button>
            
            <Button 
              onClick={onNewGame}
              variant="outline"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip Station
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
